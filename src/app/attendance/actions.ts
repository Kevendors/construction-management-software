"use server";

import { getAuthContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { logActivity } from "@/lib/activity/log";
import { dispatchNotification } from "@/lib/notifications/dispatch";
import {
  ALLOWED_LATE_ARRIVALS,
  formatDuration,
  formatTime,
  haversineMeters,
  isAfterLateGrace,
  isLateArrival,
  minutesBetween,
  orgToday,
  ORG_UTC_OFFSET,
  overtimeOf,
  SHIFT_END_TIME,
  STANDARD_WORKDAY_MINUTES,
} from "@/lib/attendance/compute";

const BUCKET = "attendance-selfies";
const SIGNED_TTL = 60 * 60 * 24 * 7; // 1 week
const MAX_SELFIE_BYTES = 2 * 1024 * 1024;

export interface ActionResult {
  id?: string;
  error?: string;
}

export interface CheckInResult extends ActionResult {
  lateMessage?: string;
  creditType?: "on_time" | "late_grace" | "late_half_day" | "late_cutoff_half_day";
  lateIndex?: number;
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

export interface OfficePunchInput {
  lat: number;
  lng: number;
  accuracy: number;
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
  let { error } = await admin.storage
    .from(BUCKET)
    .upload(path, decoded.buffer, { contentType: decoded.contentType, upsert: true });

  if (error && (error.message?.toLowerCase().includes("bucket") || (error as { statusCode?: string }).statusCode === "404")) {
    try {
      await admin.storage.createBucket(BUCKET, { public: false });
      const retry = await admin.storage
        .from(BUCKET)
        .upload(path, decoded.buffer, { contentType: decoded.contentType, upsert: true });
      if (!retry.error) return path;
      error = retry.error;
    } catch {
      // Continue to error logging below
    }
  }

  if (error) {
    console.error("[attendance] selfie upload failed", path, error.message);
    return null;
  }
  return path;
}

export async function checkInAction(input: CheckInInput): Promise<CheckInResult> {
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

  // Project must be valid; supervisors, engineers, PMs, and super_admins can check in to any site.
  // For other roles, ensure they are assigned, or if they have no assignments yet, allow them.
  if (
    ctx.role !== "super_admin" &&
    ctx.role !== "pm" &&
    ctx.role !== "supervisor" &&
    ctx.role !== "engineer"
  ) {
    const { data: assignment } = await supabase
      .from("project_members")
      .select("id")
      .eq("project_id", input.projectId)
      .eq("user_id", ctx.userId)
      .maybeSingle();

    if (!assignment) {
      const { data: anyAssign } = await supabase
        .from("project_members")
        .select("id")
        .eq("user_id", ctx.userId)
        .limit(1);
      if (anyAssign && anyAssign.length > 0) {
        return { error: "You are not assigned to this project." };
      }
    }
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

  const nowIso = new Date().toISOString();
  let lateMsg = "";
  let creditType: "on_time" | "late_grace" | "late_half_day" | "late_cutoff_half_day" = "on_time";
  let lateNum = 0;
  let userNotificationTitle = "Attendance Marked (On Time)";
  let userNotificationBody = `Checked in on time at ${formatTime(nowIso)} (${(project as { name: string }).name}). Full Day (1.0d) credited.`;

  if (isLateArrival(nowIso)) {
    const curMonth = date.slice(0, 7);
    const { data: monthRows } = await supabase
      .from("employee_attendance")
      .select("check_in_at")
      .eq("user_id", ctx.userId)
      .like("date", `${curMonth}%`)
      .not("check_in_at", "is", null);

    let priorLates = 0;
    for (const mr of monthRows ?? []) {
      if (mr.check_in_at && isLateArrival(mr.check_in_at) && mr.check_in_at !== nowIso) {
        priorLates += 1;
      }
    }
    lateNum = priorLates + 1;
    if (isAfterLateGrace(nowIso)) {
      creditType = "late_cutoff_half_day";
      lateMsg = ` [Half Day — checked in after 10:15 AM]`;
      userNotificationTitle = "Attendance Marked (Half Day — Late Cutoff)";
      userNotificationBody = `Checked in at ${formatTime(nowIso)} (after 10:15 AM cutoff). Counted as Half Day (0.5 paid day).`;
    } else if (lateNum > ALLOWED_LATE_ARRIVALS) {
      creditType = "late_half_day";
      lateMsg = ` [Half Day — late #${lateNum} exceeds allowed 3]`;
      userNotificationTitle = "Attendance Marked (Half Day — Grace Exceeded)";
      userNotificationBody = `Checked in at ${formatTime(nowIso)} (late #${lateNum} this month, exceeds 3 allowed). Counted as Half Day (0.5 paid day).`;
    } else {
      creditType = "late_grace";
      lateMsg = ` [Late #${lateNum} of ${ALLOWED_LATE_ARRIVALS} allowed]`;
      userNotificationTitle = `Attendance Marked (Late Grace ${lateNum}/${ALLOWED_LATE_ARRIVALS})`;
      userNotificationBody = `Checked in at ${formatTime(nowIso)}. Late arrival ${lateNum} of ${ALLOWED_LATE_ARRIVALS} allowed grace. Full Day (1.0d) credited.`;
    }
  }

  await logActivity({
    action: "created",
    entityType: "attendance",
    entityId: row.id,
    summary: `${ctx.name} checked in — ${(project as { name: string }).name}${lateMsg}`,
    meta: { projectId: input.projectId, lat: input.lat, lng: input.lng },
  });

  // Admin notification (In-app + Web Push)
  await dispatchNotification({
    orgId: ctx.orgId,
    roles: ["super_admin"],
    excludeUserId: ctx.userId,
    kind: isLateArrival(nowIso) ? "delay" : "info",
    title: `${ctx.name} Checked In${lateMsg ? " (Late)" : ""}`,
    body: `${ctx.name} checked in at ${(project as { name: string }).name} (${formatTime(nowIso)})${lateMsg}`,
    href: "/attendance",
  });

  // Employee notification (In-app + Web Push)
  await dispatchNotification({
    orgId: ctx.orgId,
    userIds: [ctx.userId],
    kind: creditType.includes("half_day") ? "delay" : "info",
    title: userNotificationTitle,
    body: userNotificationBody,
    href: "/attendance",
  });

  return {
    id: row.id,
    lateMessage: lateMsg.trim(),
    creditType,
    lateIndex: lateNum > 0 ? lateNum : undefined,
  };
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

  await dispatchNotification({
    orgId: ctx.orgId,
    roles: ["super_admin"],
    excludeUserId: ctx.userId,
    kind: "info",
    title: `${ctx.name} Checked Out`,
    body: `${ctx.name} checked out — ${h}h ${m}m worked`,
    href: "/payroll",
  });

  return { id: row.id as string };
}

/** The org's shared office location (office flow's geofence). Readable by any signed-in member. */
export async function getOfficeGeofenceAction(): Promise<{ lat: number | null; lng: number | null; radiusM: number | null }> {
  if (!isSupabaseConfigured()) return { lat: null, lng: null, radiusM: null };
  const ctx = await getAuthContext();
  if (!ctx?.orgId) return { lat: null, lng: null, radiusM: null };
  const supabase = await createClient();
  const { data } = await supabase
    .from("orgs")
    .select("office_lat, office_lng, office_radius_m")
    .eq("id", ctx.orgId)
    .maybeSingle();
  return {
    lat: (data?.office_lat as number | null | undefined) ?? null,
    lng: (data?.office_lng as number | null | undefined) ?? null,
    radiusM: (data?.office_radius_m as number | null | undefined) ?? null,
  };
}

/** Super_admin only: set or clear the org's shared office geofence. Pass all three null to disable it. */
export async function setOfficeGeofenceAction(
  lat: number | null,
  lng: number | null,
  radiusM: number | null
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { id: "mock" };
  const ctx = await getAuthContext();
  if (!ctx?.orgId || ctx.role !== "super_admin") return { error: "Not authorized." };
  if (lat != null && (lat < -90 || lat > 90)) return { error: "Latitude must be between -90 and 90." };
  if (lng != null && (lng < -180 || lng > 180)) return { error: "Longitude must be between -180 and 180." };
  if (radiusM != null && radiusM <= 0) return { error: "Radius must be a positive number of meters." };

  // orgs has no authenticated write policy (read-only for members) — same
  // admin-client pattern as every other super_admin-only write in this app.
  const admin = createAdminClient();
  const { error } = await admin
    .from("orgs")
    .update({ office_lat: lat, office_lng: lng, office_radius_m: radiusM })
    .eq("id", ctx.orgId);
  if (error) return { error: error.message };

  await logActivity({
    action: "updated",
    entityType: "org",
    entityId: ctx.orgId,
    summary:
      lat != null && lng != null && radiusM != null
        ? `${ctx.name} set the office location (${lat}, ${lng}), radius ${radiusM}m`
        : `${ctx.name} disabled the office location fence`,
  });
  return { id: ctx.orgId };
}

/**
 * One-tap office punch-in: no project, no selfie — just GPS. Mirrors
 * checkInAction's late-arrival evaluation and notifications exactly; the
 * only differences are no project/selfie and the office geofence instead
 * of a project's.
 */
export async function officeCheckInAction(input: OfficePunchInput): Promise<CheckInResult> {
  if (!isSupabaseConfigured()) return { id: "mock" };

  const ctx = await getAuthContext();
  if (!ctx?.orgId) return { error: "You must be signed in." };
  if (!validCoords(input.lat, input.lng, input.accuracy)) {
    return { error: "Could not read a valid GPS location. Enable location access and retry." };
  }

  const supabase = await createClient();
  const { data: org } = await supabase
    .from("orgs")
    .select("office_lat, office_lng, office_radius_m")
    .eq("id", ctx.orgId)
    .maybeSingle();
  const fenceMsg = fenceError(
    org
      ? {
          geofence_lat: org.office_lat as number | null,
          geofence_lng: org.office_lng as number | null,
          geofence_radius_m: org.office_radius_m as number | null,
        }
      : null,
    input.lat,
    input.lng,
    input.accuracy
  );
  if (fenceMsg) return { error: fenceMsg.replace("the site", "the office").replace("project area", "office premises") };

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
      project_id: null,
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
    if (error.code === "23505") return { error: "Already checked in today." };
    return { error: error.message };
  }

  const nowIso = new Date().toISOString();
  let lateMsg = "";
  let creditType: "on_time" | "late_grace" | "late_half_day" | "late_cutoff_half_day" = "on_time";
  let lateNum = 0;
  let userNotificationTitle = "Punched In (On Time)";
  let userNotificationBody = `Punched in on time at ${formatTime(nowIso)}. Full Day (1.0d) credited.`;

  if (isLateArrival(nowIso)) {
    const curMonth = date.slice(0, 7);
    const { data: monthRows } = await supabase
      .from("employee_attendance")
      .select("check_in_at")
      .eq("user_id", ctx.userId)
      .like("date", `${curMonth}%`)
      .not("check_in_at", "is", null);

    let priorLates = 0;
    for (const mr of monthRows ?? []) {
      if (mr.check_in_at && isLateArrival(mr.check_in_at) && mr.check_in_at !== nowIso) {
        priorLates += 1;
      }
    }
    lateNum = priorLates + 1;
    if (isAfterLateGrace(nowIso)) {
      creditType = "late_cutoff_half_day";
      lateMsg = ` [Half Day — checked in after 10:15 AM]`;
      userNotificationTitle = "Punched In (Half Day — Late Cutoff)";
      userNotificationBody = `Punched in at ${formatTime(nowIso)} (after 10:15 AM cutoff). Counted as Half Day (0.5 paid day).`;
    } else if (lateNum > ALLOWED_LATE_ARRIVALS) {
      creditType = "late_half_day";
      lateMsg = ` [Half Day — late #${lateNum} exceeds allowed 3]`;
      userNotificationTitle = "Punched In (Half Day — Grace Exceeded)";
      userNotificationBody = `Punched in at ${formatTime(nowIso)} (late #${lateNum} this month, exceeds 3 allowed). Counted as Half Day (0.5 paid day).`;
    } else {
      creditType = "late_grace";
      lateMsg = ` [Late #${lateNum} of ${ALLOWED_LATE_ARRIVALS} allowed]`;
      userNotificationTitle = `Punched In (Late Grace ${lateNum}/${ALLOWED_LATE_ARRIVALS})`;
      userNotificationBody = `Punched in at ${formatTime(nowIso)}. Late arrival ${lateNum} of ${ALLOWED_LATE_ARRIVALS} allowed grace. Full Day (1.0d) credited.`;
    }
  }

  await logActivity({
    action: "created",
    entityType: "attendance",
    entityId: row.id,
    summary: `${ctx.name} punched in (office)${lateMsg}`,
    meta: { office: true, lat: input.lat, lng: input.lng },
  });

  await dispatchNotification({
    orgId: ctx.orgId,
    roles: ["super_admin"],
    excludeUserId: ctx.userId,
    kind: isLateArrival(nowIso) ? "delay" : "info",
    title: `${ctx.name} Punched In (Office)${lateMsg ? " (Late)" : ""}`,
    body: `${ctx.name} punched in at the office (${formatTime(nowIso)})${lateMsg}`,
    href: "/attendance",
  });

  await dispatchNotification({
    orgId: ctx.orgId,
    userIds: [ctx.userId],
    kind: creditType.includes("half_day") ? "delay" : "info",
    title: userNotificationTitle,
    body: userNotificationBody,
    href: "/attendance",
  });

  return {
    id: row.id,
    lateMessage: lateMsg.trim(),
    creditType,
    lateIndex: lateNum > 0 ? lateNum : undefined,
  };
}

/** One-tap office punch-out: no selfie — just GPS. Mirrors checkOutAction minus the selfie. */
export async function officeCheckOutAction(input: OfficePunchInput): Promise<ActionResult> {
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
    .select("id, check_in_at, check_out_at")
    .eq("user_id", ctx.userId)
    .eq("date", date)
    .maybeSingle();
  if (!row) return { error: "Punch in first." };
  if (row.check_out_at) return { error: "Already punched out today." };

  const { data: org } = await supabase
    .from("orgs")
    .select("office_lat, office_lng, office_radius_m")
    .eq("id", ctx.orgId)
    .maybeSingle();
  const fenceMsg = fenceError(
    org
      ? {
          geofence_lat: org.office_lat as number | null,
          geofence_lng: org.office_lng as number | null,
          geofence_radius_m: org.office_radius_m as number | null,
        }
      : null,
    input.lat,
    input.lng,
    input.accuracy
  );
  if (fenceMsg) return { error: fenceMsg.replace("the site", "the office").replace("project area", "office premises") };

  const nowIso = new Date().toISOString();
  const totalMinutes = minutesBetween(row.check_in_at as string, nowIso);
  const { error } = await supabase
    .from("employee_attendance")
    .update({
      check_out_at: nowIso,
      check_out_lat: input.lat,
      check_out_lng: input.lng,
      check_out_accuracy: input.accuracy,
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
    summary: `${ctx.name} punched out (office) — ${h}h ${m}m worked`,
    meta: { office: true, lat: input.lat, lng: input.lng, totalMinutes },
  });

  await dispatchNotification({
    orgId: ctx.orgId,
    roles: ["super_admin"],
    excludeUserId: ctx.userId,
    kind: "info",
    title: `${ctx.name} Punched Out (Office)`,
    body: `${ctx.name} punched out — ${h}h ${m}m worked`,
    href: "/payroll",
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

export interface AdminMarkAttendanceInput {
  userId: string;
  date: string; // "YYYY-MM-DD"
  projectId: string | null;
  /** "present" requires checkInTime; half_day/leave/absent ignore the time fields entirely. */
  status: "present" | "half_day" | "leave" | "absent";
  checkInTime: string; // "HH:MM" — required only when status === "present"
  checkOutTime: string; // "HH:MM" or "" (leave open) — only used when status === "present"
  note: string;
}

const HHMM = /^\d{2}:\d{2}$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Human-readable "field changed X → Y" lines for the audit trail. */
function diffSummary(
  before: { checkInAt: string | null; checkOutAt: string | null; status: string; projectName: string | null } | null,
  after: { checkInAt: string | null; checkOutAt: string | null; status: string; projectName: string | null }
): string {
  if (!before) {
    return after.status !== "present"
      ? `Marked ${statusLabel(after.status)}`
      : `Marked Present, in ${formatTime(after.checkInAt ?? "")}${after.checkOutAt ? `, out ${formatTime(after.checkOutAt)}` : ""}`;
  }
  const parts: string[] = [];
  if (before.status !== after.status) parts.push(`status ${statusLabel(before.status)} → ${statusLabel(after.status)}`);
  if (before.checkInAt !== after.checkInAt) {
    parts.push(`check-in ${before.checkInAt ? formatTime(before.checkInAt) : "—"} → ${after.checkInAt ? formatTime(after.checkInAt) : "—"}`);
  }
  if (before.checkOutAt !== after.checkOutAt) {
    parts.push(`check-out ${before.checkOutAt ? formatTime(before.checkOutAt) : "—"} → ${after.checkOutAt ? formatTime(after.checkOutAt) : "—"}`);
  }
  if (before.projectName !== after.projectName) parts.push(`project ${before.projectName ?? "—"} → ${after.projectName ?? "—"}`);
  return parts.length ? `Changed ${parts.join("; ")}` : "Updated (no field change)";
}

function statusLabel(status: string): string {
  return status === "half_day" ? "Half Day" : status === "leave" ? "Leave" : status === "absent" ? "Absent" : "Present";
}

/**
 * Super_admin/hr only: mark or correct an attendance record without GPS/selfie
 * proof (e.g. dead phone, no signal, forgot to check in), or explicitly
 * declare the day as Half-Day/Leave/Absent. Always tagged source="admin"
 * with who did it and why — self check-in/out never take this path, so this
 * can never silently masquerade as GPS+selfie verified. Every call logs a
 * before/after diff to the activity log (surfaced as this record's Edit
 * History) in addition to the existing plain summary.
 */
export async function adminMarkAttendanceAction(input: AdminMarkAttendanceInput): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { id: "mock" };

  const ctx = await getAuthContext();
  if (!ctx?.orgId || !(ctx.role === "super_admin" || ctx.role === "hr")) {
    return { error: "Not authorized." };
  }
  if (!input.userId) return { error: "Choose an employee." };
  if (!YMD.test(input.date) || input.date > orgToday()) return { error: "Choose a valid past or current date." };
  const note = input.note.trim();
  if (!note) return { error: "A reason is required for a manual entry." };

  const isDeclarative = input.status !== "present";
  let checkInAt: string;
  let checkOutAt: string | null;
  if (isDeclarative) {
    // No real punch for a declared Half-Day/Leave/Absent — a local-midnight
    // placeholder satisfies the NOT NULL column without ever being shown as
    // a real time anywhere (every display path checks `status` first).
    checkInAt = `${input.date}T00:00:00${ORG_UTC_OFFSET}`;
    checkOutAt = null;
  } else {
    if (!HHMM.test(input.checkInTime)) return { error: "Enter a valid check-in time." };
    if (input.checkOutTime && !HHMM.test(input.checkOutTime)) return { error: "Enter a valid check-out time." };
    checkInAt = `${input.date}T${input.checkInTime}:00${ORG_UTC_OFFSET}`;
    checkOutAt = input.checkOutTime ? `${input.date}T${input.checkOutTime}:00${ORG_UTC_OFFSET}` : null;
    if (checkOutAt && checkOutAt <= checkInAt) return { error: "Check-out must be after check-in." };
  }
  const totalMinutes = !isDeclarative && checkOutAt ? minutesBetween(checkInAt, checkOutAt) : null;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("employee_attendance")
    .select("id, check_in_at, check_out_at, status, project_id")
    .eq("user_id", input.userId)
    .eq("date", input.date)
    .maybeSingle();

  const projectName = async (id: string | null) => {
    if (!id) return null;
    const { data } = await supabase.from("projects").select("name").eq("id", id).maybeSingle();
    return (data?.name as string | undefined) ?? null;
  };
  const [beforeProjectName, afterProjectName] = existing
    ? await Promise.all([projectName(existing.project_id as string | null), projectName(input.projectId)])
    : [null, await projectName(input.projectId)];

  const row = {
    org_id: ctx.orgId,
    user_id: input.userId,
    project_id: isDeclarative ? null : input.projectId,
    date: input.date,
    check_in_at: checkInAt,
    check_out_at: checkOutAt,
    total_minutes: totalMinutes,
    overtime_minutes: totalMinutes != null ? overtimeOf(totalMinutes) : null,
    status: input.status,
    source: "admin",
    marked_by: ctx.userId,
    note,
  };

  const result = existing
    ? await supabase.from("employee_attendance").update(row).eq("id", existing.id).select("id").single()
    : await supabase.from("employee_attendance").insert(row).select("id").single();
  if (result.error) {
    if (result.error.code === "23505") return { error: "A record for that employee and date was just created — refresh and try again." };
    return { error: result.error.message };
  }

  const before = existing
    ? {
        checkInAt: (existing.check_in_at as string) || null,
        checkOutAt: (existing.check_out_at as string | null) ?? null,
        status: (existing.status as string) || "present",
        projectName: beforeProjectName,
      }
    : null;
  const after = {
    checkInAt: isDeclarative ? null : checkInAt,
    checkOutAt: isDeclarative ? null : checkOutAt,
    status: input.status,
    projectName: isDeclarative ? null : afterProjectName,
  };

  await logActivity({
    action: existing ? "updated" : "created",
    entityType: "attendance",
    entityId: result.data.id,
    summary: `${ctx.name}: ${diffSummary(before, after)} — ${note}`,
    meta: { userId: input.userId, date: input.date, before, after, reason: note },
  });
  return { id: result.data.id };
}

export interface AttendanceEditHistoryEntry {
  id: string;
  actorName: string;
  action: string;
  summary: string;
  createdAt: string;
}

/** Edit history for one attendance record, newest first — reuses the org activity log. */
export async function getAttendanceEditHistoryAction(attendanceId: string): Promise<AttendanceEditHistoryEntry[]> {
  if (!isSupabaseConfigured() || !attendanceId) return [];
  const ctx = await getAuthContext();
  if (!ctx?.orgId || !(ctx.role === "super_admin" || ctx.role === "hr")) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_log")
    .select("id, actor_name, action, summary, created_at")
    .eq("entity_type", "attendance")
    .eq("entity_id", attendanceId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  return (data as { id: string; actor_name: string | null; action: string; summary: string; created_at: string }[]).map((r) => ({
    id: r.id,
    actorName: r.actor_name || "Unknown",
    action: r.action,
    summary: r.summary,
    createdAt: r.created_at,
  }));
}

export interface ClosePreviousShiftInput {
  recordId: string;
  checkOutTime?: string; // "HH:MM"
  note?: string;
}

/**
 * Close an unclosed / forgotten shift from an earlier date.
 * Callable by the employee themselves or by super_admin/hr.
 */
export async function closePreviousShiftAction(
  input: ClosePreviousShiftInput
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { id: input.recordId };

  const ctx = await getAuthContext();
  if (!ctx?.orgId || !ctx?.userId) return { error: "You must be signed in." };

  const admin = createAdminClient();
  const { data: record, error: fetchErr } = await admin
    .from("employee_attendance")
    .select("id, user_id, date, check_in_at, check_out_at, note")
    .eq("id", input.recordId)
    .maybeSingle();

  if (fetchErr || !record) return { error: "Attendance record not found." };

  const isOwner = record.user_id === ctx.userId;
  const isAdmin = ctx.role === "super_admin" || ctx.role === "hr";
  if (!isOwner && !isAdmin) {
    return { error: "Not authorized to close this shift." };
  }

  if (record.check_out_at) {
    return { error: "This shift is already closed." };
  }

  let checkOutIso: string;
  let totalMinutes: number;

  if (input.checkOutTime && /^\d{2}:\d{2}$/.test(input.checkOutTime)) {
    checkOutIso = `${record.date}T${input.checkOutTime}:00${ORG_UTC_OFFSET}`;
    totalMinutes = minutesBetween(record.check_in_at as string, checkOutIso);
  } else {
    // Default to standard 18:00 (6:00 PM) shift end
    checkOutIso = `${record.date}T${SHIFT_END_TIME}:00${ORG_UTC_OFFSET}`;
    const diff = minutesBetween(record.check_in_at as string, checkOutIso);
    totalMinutes = diff > 0 ? diff : STANDARD_WORKDAY_MINUTES;
  }

  const updateNote = input.note?.trim()
    ? input.note.trim()
    : isOwner
    ? "Shift closed retroactively"
    : `Shift closed by ${ctx.name}`;

  const existingNote = record.note as string | null;
  const finalNote = existingNote ? `${existingNote} · ${updateNote}` : updateNote;

  const { error: updateErr } = await admin
    .from("employee_attendance")
    .update({
      check_out_at: checkOutIso,
      total_minutes: totalMinutes,
      overtime_minutes: overtimeOf(totalMinutes),
      note: finalNote,
    })
    .eq("id", record.id);

  if (updateErr) return { error: updateErr.message };

  await logActivity({
    action: "updated",
    entityType: "attendance",
    entityId: record.id,
    summary: `${ctx.name} closed previous shift for ${record.date} (${formatDuration(totalMinutes)})`,
    meta: { recordId: record.id, date: record.date, totalMinutes },
  });

  return { id: record.id };
}
