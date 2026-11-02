"use server";

import { logActivity } from "@/lib/activity/log";
import { getAuthContext } from "@/lib/auth/context";
import { ATTENDANCE_EMPLOYEES_ONLY, isExternalRole } from "@/lib/auth/roles";
import { haversineMeters, orgToday } from "@/lib/attendance/compute";
import {
  CLIENT_VISITS_PENDING_MSG,
  MAX_CLIENT_NAME,
  MAX_CLIENT_VISITS_PER_DAY,
  MAX_VISIT_PURPOSE,
} from "@/lib/attendance/client-visits";
import { isMissingTableError } from "@/lib/attendance/site-visits";
import { mapClientVisit, type ClientVisitRow } from "@/lib/data/mappers";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { ClientVisit } from "@/lib/types";

const TABLE = "attendance_client_visits";
const NOT_ALLOWED = "Client visits aren't enabled for you. Ask your admin to tick \"Client visits allowed\".";

export interface ClientVisitResult {
  id?: string;
  error?: string;
}

interface VisitPoint {
  lat: number;
  lng: number;
  accuracy: number;
}

function validPoint({ lat, lng, accuracy }: VisitPoint): boolean {
  return (
    Number.isFinite(lat) && Math.abs(lat) <= 90 &&
    Number.isFinite(lng) && Math.abs(lng) <= 180 &&
    Number.isFinite(accuracy) && accuracy >= 0
  );
}

/** Distance from the office and whether that's inside its fence; null distance = no office location set. */
async function fromOffice(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  { lat, lng }: VisitPoint
): Promise<{ distanceM: number | null; inOffice: boolean }> {
  const { data } = await supabase
    .from("orgs")
    .select("office_lat, office_lng, office_radius_m")
    .eq("id", orgId)
    .maybeSingle();
  const org = data as { office_lat: number | null; office_lng: number | null; office_radius_m: number | null } | null;
  if (org?.office_lat == null || org.office_lng == null) return { distanceM: null, inOffice: false };
  const distanceM = haversineMeters(lat, lng, org.office_lat, org.office_lng);
  return { distanceM, inOffice: Boolean(org.office_radius_m) && distanceM <= (org.office_radius_m as number) };
}

/** Log arriving at a client, during today's open office shift. */
export async function startClientVisitAction(
  input: VisitPoint & { clientName: string; purpose: string }
): Promise<ClientVisitResult> {
  if (!isSupabaseConfigured()) return { id: "mock" };

  const ctx = await getAuthContext();
  if (!ctx?.orgId) return { error: "You must be signed in." };
  if (isExternalRole(ctx.role)) return { error: ATTENDANCE_EMPLOYEES_ONLY };
  if (!validPoint(input)) return { error: "Could not read a valid GPS location. Enable location access and retry." };
  const clientName = (input.clientName ?? "").trim().slice(0, MAX_CLIENT_NAME);
  const purpose = (input.purpose ?? "").trim().slice(0, MAX_VISIT_PURPOSE);
  if (!clientName) return { error: "Enter the client's name." };
  if (!purpose) return { error: "Choose the purpose of the visit." };

  const supabase = await createClient();
  const { data: member, error: memberErr } = await supabase
    .from("memberships")
    .select("is_office, client_visits_allowed")
    .eq("user_id", ctx.userId)
    .eq("org_id", ctx.orgId)
    .limit(1)
    .maybeSingle();
  const m = member as { is_office?: boolean | null; client_visits_allowed?: boolean | null } | null;
  if (memberErr || m?.client_visits_allowed !== true || m.is_office === false) return { error: NOT_ALLOWED };

  const date = orgToday();
  const { data: shift } = await supabase
    .from("employee_attendance")
    .select("id, check_out_at, source, project_id")
    .eq("user_id", ctx.userId)
    .eq("date", date)
    .maybeSingle();
  if (!shift || shift.source !== "self") return { error: "Punch in first." };
  if (shift.check_out_at) return { error: "You have already punched out today." };
  if (shift.project_id) return { error: NOT_ALLOWED };

  const admin = createAdminClient();
  const { data: existing, error: existingErr } = await admin
    .from(TABLE)
    .select("id, ended_at")
    .eq("attendance_id", shift.id);
  if (existingErr) return { error: isMissingTableError(existingErr) ? CLIENT_VISITS_PENDING_MSG : existingErr.message };
  const rows = (existing ?? []) as { id: string; ended_at: string | null }[];
  if (rows.some((r) => !r.ended_at)) return { error: "End your current visit first." };
  if (rows.length >= MAX_CLIENT_VISITS_PER_DAY) {
    return { error: `You can log at most ${MAX_CLIENT_VISITS_PER_DAY} visits a day.` };
  }

  const { distanceM, inOffice } = await fromOffice(supabase, ctx.orgId, input);
  const { data: visit, error } = await admin
    .from(TABLE)
    .insert({
      org_id: ctx.orgId,
      attendance_id: shift.id,
      user_id: ctx.userId,
      date,
      client_name: clientName,
      purpose,
      start_lat: input.lat,
      start_lng: input.lng,
      start_accuracy: input.accuracy,
      start_distance_m: distanceM,
      start_in_office: inOffice,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "End your current visit first." };
    return { error: isMissingTableError(error) ? CLIENT_VISITS_PENDING_MSG : error.message };
  }

  await logActivity({
    action: "created",
    entityType: "attendance",
    entityId: shift.id as string,
    summary: `${ctx.name} started a client visit — ${clientName} (${purpose})`,
    meta: { clientVisitId: visit.id, lat: input.lat, lng: input.lng, distanceM, inOffice },
  });

  return { id: visit.id as string };
}

/** Log leaving the client. Only the visit's own employee, only while it's open. */
export async function endClientVisitAction(input: VisitPoint & { visitId: string }): Promise<ClientVisitResult> {
  if (!isSupabaseConfigured()) return { id: "mock" };

  const ctx = await getAuthContext();
  if (!ctx?.orgId) return { error: "You must be signed in." };
  if (isExternalRole(ctx.role)) return { error: ATTENDANCE_EMPLOYEES_ONLY };
  if (!validPoint(input)) return { error: "Could not read a valid GPS location. Enable location access and retry." };

  const supabase = await createClient();
  const { distanceM } = await fromOffice(supabase, ctx.orgId, input);
  const { data: visit, error } = await createAdminClient()
    .from(TABLE)
    .update({
      ended_at: new Date().toISOString(),
      end_lat: input.lat,
      end_lng: input.lng,
      end_accuracy: input.accuracy,
      end_distance_m: distanceM,
    })
    .eq("id", input.visitId)
    .eq("user_id", ctx.userId)
    .eq("org_id", ctx.orgId)
    .is("ended_at", null)
    .select("id, attendance_id, client_name")
    .maybeSingle();
  if (error) return { error: isMissingTableError(error) ? CLIENT_VISITS_PENDING_MSG : error.message };
  if (!visit) return { error: "This visit has already ended." };

  await logActivity({
    action: "updated",
    entityType: "attendance",
    entityId: visit.attendance_id as string,
    summary: `${ctx.name} ended a client visit — ${visit.client_name as string}`,
    meta: { clientVisitId: visit.id, lat: input.lat, lng: input.lng, distanceM },
  });

  return { id: visit.id as string };
}

/** One attendance day's visits, oldest first (RLS: self + super_admin/hr). Missing table = none. */
export async function getClientVisitsForDayAction(attendanceId: string): Promise<ClientVisit[]> {
  if (!isSupabaseConfigured()) return [];
  const ctx = await getAuthContext();
  if (!ctx?.orgId) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("attendance_id", attendanceId)
    .order("started_at", { ascending: true });
  if (error) return [];
  return ((data ?? []) as ClientVisitRow[]).map(mapClientVisit);
}

/** Super_admin/hr: one employee's visits in a date range, newest first. Missing table = none. */
export async function getClientVisitsForEmployeeAction(userId: string, from: string, to: string): Promise<ClientVisit[]> {
  if (!isSupabaseConfigured()) return [];
  const ctx = await getAuthContext();
  if (!ctx?.orgId || (ctx.role !== "super_admin" && ctx.role !== "hr")) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("org_id", ctx.orgId)
    .eq("user_id", userId)
    .gte("date", from)
    .lte("date", to)
    .order("started_at", { ascending: false })
    .limit(500);
  if (error) return [];
  return ((data ?? []) as ClientVisitRow[]).map(mapClientVisit);
}
