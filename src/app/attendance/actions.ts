"use server";

import { getAuthContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { logActivity } from "@/lib/activity/log";
import {
  haversineMeters,
  minutesBetween,
  orgToday,
  overtimeOf,
} from "@/lib/attendance/compute";

const BUCKET = "attendance-selfies";
const SIGNED_TTL = 60 * 60 * 24 * 7; // 1 week
const MAX_SELFIE_BYTES = 2 * 1024 * 1024;

export interface ActionResult {
  id?: string;
  error?: string;
}

export interface CheckInInput {
  projectId: string;
  lat: number;
  lng: number;
  accuracy: number;
  selfieDataUrl: string;
}

export interface CheckOutInput {
  lat: number;
  lng: number;
  accuracy: number;
  selfieDataUrl: string;
}

function decodeDataUrl(dataUrl: string): { buffer: Buffer; contentType: string } | null {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([\s\S]*)$/.exec(dataUrl);
  if (!m) return null;
  return { buffer: Buffer.from(m[2], "base64"), contentType: m[1] };
}

function validCoords(lat: number, lng: number, accuracy: number): boolean {
  return (
    Number.isFinite(lat) && Math.abs(lat) <= 90 &&
    Number.isFinite(lng) && Math.abs(lng) <= 180 &&
    Number.isFinite(accuracy) && accuracy >= 0
  );
}

interface GeofenceRow {
  geofence_lat: number | null;
  geofence_lng: number | null;
  geofence_radius_m: number | null;
}

/**
 * Server-authoritative fence check. Subtracting the reported GPS accuracy
 * gives honest slack for poor signal; the fence only applies when all three
 * values are configured on the project.
 */
function fenceError(
  fence: GeofenceRow | null,
  lat: number,
  lng: number,
  accuracy: number
): string | null {
  if (!fence || fence.geofence_lat == null || fence.geofence_lng == null || !fence.geofence_radius_m) {
    return null;
  }
  const distance = haversineMeters(lat, lng, fence.geofence_lat, fence.geofence_lng);
  if (distance - accuracy <= fence.geofence_radius_m) return null;
  return `You are ~${distance}m from the site (allowed ${fence.geofence_radius_m}m). Move inside the project area and try again.`;
}

/** Upload a selfie to the private bucket; returns the storage path or null. */
async function uploadSelfie(
  orgId: string,
  userId: string,
  date: string,
  suffix: "in" | "out",
  selfieDataUrl: string
): Promise<string | null> {
  const decoded = decodeDataUrl(selfieDataUrl);
  if (!decoded || decoded.buffer.length === 0 || decoded.buffer.length > MAX_SELFIE_BYTES) {
    return null;
  }
  const path = `${orgId}/${userId}/${date}-${suffix}.jpg`;
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, decoded.buffer, { contentType: decoded.contentType, upsert: true });
  if (error) {
    console.error("[attendance] selfie upload failed", path, error.message);
    return null;
  }
  return path;
}

export async function checkInAction(input: CheckInInput): Promise<ActionResult> {
  // Mock mode: the UI keeps its own optimistic state (lost on reload — demo only).
  if (!isSupabaseConfigured()) return { id: "mock" };

  const ctx = await getAuthContext();
  if (!ctx?.orgId) return { error: "You must be signed in." };
  if (!input.projectId) return { error: "Choose a project first." };
  if (!validCoords(input.lat, input.lng, input.accuracy)) {
    return { error: "Could not read a valid GPS location. Enable location access and retry." };
  }

  const supabase = await createClient();

  // Project must be visible to the caller; non-super-admins must be on its roster.
  const { data: project } = await supabase
    .from("projects")
    .select("name, geofence_lat, geofence_lng, geofence_radius_m")
    .eq("id", input.projectId)
    .maybeSingle();
  if (!project) return { error: "Project not found." };
  if (ctx.role !== "super_admin") {
    const { data: assignment } = await supabase
      .from("project_members")
      .select("id")
      .eq("project_id", input.projectId)
      .eq("user_id", ctx.userId)
      .maybeSingle();
    if (!assignment) return { error: "You are not assigned to this project." };
  }

  const fenceMsg = fenceError(project as GeofenceRow, input.lat, input.lng, input.accuracy);
  if (fenceMsg) return { error: fenceMsg };

  const date = orgToday();
  const { data: existing } = await supabase
    .from("employee_attendance")
    .select("id")
    .eq("user_id", ctx.userId)
    .eq("date", date)
    .maybeSingle();
  if (existing) return { error: "Already checked in today." };

  const { data: row, error } = await supabase
    .from("employee_attendance")
    .insert({
      org_id: ctx.orgId,
      user_id: ctx.userId,
      project_id: input.projectId,
      date,
      check_in_at: new Date().toISOString(),
      check_in_lat: input.lat,
      check_in_lng: input.lng,
      check_in_accuracy: input.accuracy,
      status: "present",
    })
    .select("id")
    .single();
  if (error) {
    // 23505 = the unique (org,user,date) index caught a concurrent check-in.
    if (error.code === "23505") return { error: "Already checked in today." };
    return { error: error.message };
  }

  const selfiePath = await uploadSelfie(ctx.orgId, ctx.userId, date, "in", input.selfieDataUrl);
  if (!selfiePath) {
    // Selfie is mandatory — roll the row back (file-actions convention).
    await createAdminClient().from("employee_attendance").delete().eq("id", row.id);
    return { error: "Selfie upload failed — please try again." };
  }
  await supabase.from("employee_attendance").update({ check_in_selfie_path: selfiePath }).eq("id", row.id);

  await logActivity({
    action: "created",
    entityType: "attendance",
    entityId: row.id,
    summary: `${ctx.name} checked in — ${(project as { name: string }).name}`,
    meta: { projectId: input.projectId, lat: input.lat, lng: input.lng },
  });
  return { id: row.id };
}

export async function checkOutAction(input: CheckOutInput): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { id: "mock" };

  const ctx = await getAuthContext();
  if (!ctx?.orgId) return { error: "You must be signed in." };
  if (!validCoords(input.lat, input.lng, input.accuracy)) {
    return { error: "Could not read a valid GPS location. Enable location access and retry." };
  }

  const supabase = await createClient();
  const date = orgToday();
  const { data: row } = await supabase
    .from("employee_attendance")
    .select("id, project_id, check_in_at, check_out_at")
    .eq("user_id", ctx.userId)
    .eq("date", date)
    .maybeSingle();
  if (!row) return { error: "Check in first." };
  if (row.check_out_at) return { error: "Already checked out today." };

  if (row.project_id) {
    const { data: project } = await supabase
      .from("projects")
      .select("geofence_lat, geofence_lng, geofence_radius_m")
      .eq("id", row.project_id)
      .maybeSingle();
    const fenceMsg = fenceError(project as GeofenceRow | null, input.lat, input.lng, input.accuracy);
    if (fenceMsg) return { error: fenceMsg };
  }

  // Deterministic path → upload first; the row is untouched on failure.
  const selfiePath = await uploadSelfie(ctx.orgId, ctx.userId, date, "out", input.selfieDataUrl);
  if (!selfiePath) return { error: "Selfie upload failed — please try again." };

  const nowIso = new Date().toISOString();
  const totalMinutes = minutesBetween(row.check_in_at as string, nowIso);
  const { error } = await supabase
    .from("employee_attendance")
    .update({
      check_out_at: nowIso,
      check_out_lat: input.lat,
      check_out_lng: input.lng,
      check_out_accuracy: input.accuracy,
      check_out_selfie_path: selfiePath,
      total_minutes: totalMinutes,
      overtime_minutes: overtimeOf(totalMinutes),
    })
    .eq("id", row.id);
  if (error) return { error: error.message };

  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  await logActivity({
    action: "updated",
    entityType: "attendance",
    entityId: row.id as string,
    summary: `${ctx.name} checked out — ${h}h ${m}m worked`,
    meta: { lat: input.lat, lng: input.lng, totalMinutes },
  });
  return { id: row.id as string };
}

/**
 * Signed selfie URLs for attendance records, keyed by record id. RLS scopes
 * the row read (employees resolve only their own records; super_admin/hr any
 * org record); the admin client only signs paths read from those rows.
 */
export async function getAttendanceSelfieUrls(
  recordIds: string[]
): Promise<Record<string, { in?: string; out?: string }>> {
  if (!isSupabaseConfigured() || recordIds.length === 0) return {};
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("employee_attendance")
    .select("id, check_in_selfie_path, check_out_selfie_path")
    .in("id", recordIds.slice(0, 100));
  if (!rows?.length) return {};

  const paths: { id: string; kind: "in" | "out"; path: string }[] = [];
  for (const r of rows) {
    if (r.check_in_selfie_path) paths.push({ id: r.id, kind: "in", path: r.check_in_selfie_path });
    if (r.check_out_selfie_path) paths.push({ id: r.id, kind: "out", path: r.check_out_selfie_path });
  }
  if (!paths.length) return {};

  const admin = createAdminClient();
  const { data: signed } = await admin.storage
    .from(BUCKET)
    .createSignedUrls(paths.map((p) => p.path), SIGNED_TTL);

  const out: Record<string, { in?: string; out?: string }> = {};
  (signed ?? []).forEach((s, idx) => {
    if (!s.signedUrl || s.error) return;
    const { id, kind } = paths[idx];
    (out[id] ??= {})[kind] = s.signedUrl;
  });
  return out;
}
