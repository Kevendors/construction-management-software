"use server";

import { getAuthContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { logActivity } from "@/lib/activity/log";
import {
  isValidPosition,
  judgeSpotCheck,
  spotCheckDeadline,
  type SpotCheckFence,
} from "@/lib/attendance/spot-checks";
import { mapSpotCheck, type SpotCheckRow } from "@/lib/data/mappers";
import type { SpotCheck, SpotCheckStatus } from "@/lib/types";

const TABLE = "attendance_spot_checks";
/** Server-side grace on top of the 15-min window (clock skew / slow network). */
const CONFIRM_GRACE_MS = 60_000;

export async function confirmSpotCheckAction(
  id: string,
  pos: { lat: number; lng: number; accuracy: number }
): Promise<{ status?: SpotCheckStatus; distanceM?: number | null; error?: string }> {
  if (!isSupabaseConfigured()) return { status: "confirmed", distanceM: null };
  const ctx = await getAuthContext();
  if (!ctx?.orgId) return { error: "You must be signed in." };
  if (!isValidPosition(pos.lat, pos.lng, pos.accuracy)) {
    return { error: "Could not read a valid location. Enable location access and retry." };
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from(TABLE)
    .select("id, user_id, project_id, attendance_id, status, notified_at")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.user_id !== ctx.userId) return { error: "Location check not found." };
  if (row.status !== "pending" || !row.notified_at) return { error: "This location check is no longer open." };
  if (Date.now() > spotCheckDeadline(row.notified_at as string) + CONFIRM_GRACE_MS) {
    return { error: "Time's up — this location check has expired." };
  }

  let fence: SpotCheckFence | null = null;
  if (row.project_id) {
    const { data: p } = await admin
      .from("projects")
      .select("geofence_lat, geofence_lng, geofence_radius_m")
      .eq("id", row.project_id)
      .maybeSingle();
    if (p) fence = { lat: p.geofence_lat, lng: p.geofence_lng, radiusM: p.geofence_radius_m };
  }
  const verdict = judgeSpotCheck(pos, fence);

  const { data: updated, error } = await admin
    .from(TABLE)
    .update({
      status: verdict.status,
      responded_at: new Date().toISOString(),
      lat: pos.lat,
      lng: pos.lng,
      accuracy: pos.accuracy,
      distance_m: verdict.distanceM,
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  if (error) return { error: error.message };
  if (!updated?.length) return { error: "This location check is no longer open." };

  await logActivity({
    action: "updated",
    entityType: "attendance",
    entityId: row.attendance_id as string,
    summary:
      verdict.status === "off_site"
        ? `${ctx.name} answered a location check — off site (~${verdict.distanceM}m away)`
        : `${ctx.name} answered a location check — ${verdict.status === "on_site" ? "on site" : "confirmed"}`,
    meta: { spotCheckId: id, lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy },
  });

  return verdict;
}

export async function excuseSpotCheckAction(id: string, note: string): Promise<{ id?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { id };
  const ctx = await getAuthContext();
  if (!ctx?.orgId) return { error: "You must be signed in." };
  if (ctx.role !== "super_admin" && ctx.role !== "hr") return { error: "Only Super Admin or HR can excuse a check." };

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from(TABLE)
    .update({ status: "excused", excused_by: ctx.userId, excuse_note: note.trim() || null })
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .eq("status", "missed")
    .select("id, attendance_id");
  if (error) return { error: error.message };
  if (!updated?.length) return { error: "Only a missed check can be excused." };

  await logActivity({
    action: "updated",
    entityType: "attendance",
    entityId: updated[0].attendance_id as string,
    summary: `${ctx.name} excused a missed location check${note.trim() ? ` — ${note.trim()}` : ""}`,
    meta: { spotCheckId: id },
  });
  return { id };
}

/** Fired checks for one shift (RLS: self or super_admin/hr). Never returns future times. */
export async function getSpotChecksAction(attendanceId: string): Promise<SpotCheck[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("attendance_id", attendanceId)
    .not("status", "in", "(scheduled,cancelled)")
    .order("notified_at", { ascending: true });
  if (error) return [];
  return ((data ?? []) as SpotCheckRow[]).map(mapSpotCheck);
}

/** Per-shift tallies for the admin table's "Checks" column. */
export async function getSpotCheckSummaryAction(
  attendanceIds: string[]
): Promise<Record<string, { total: number; ok: number; missed: number }>> {
  const out: Record<string, { total: number; ok: number; missed: number }> = {};
  if (!isSupabaseConfigured() || attendanceIds.length === 0) return out;
  const ctx = await getAuthContext();
  if (ctx?.role !== "super_admin" && ctx?.role !== "hr") return out;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("attendance_id, status")
    .in("attendance_id", attendanceIds)
    .in("status", ["on_site", "off_site", "confirmed", "missed", "excused"]);
  if (error) return out;
  for (const r of data ?? []) {
    const k = r.attendance_id as string;
    const s = (out[k] ??= { total: 0, ok: 0, missed: 0 });
    s.total += 1;
    if (r.status === "missed") s.missed += 1;
    else if (r.status !== "off_site") s.ok += 1;
  }
  return out;
}
