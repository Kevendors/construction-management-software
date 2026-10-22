"use server";

import { getAuthContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { logActivity } from "@/lib/activity/log";
import { dispatchNotification } from "@/lib/notifications/dispatch";
import {
  formatDuration,
  formatTime,
  haversineMeters,
  isLateCheckIn,
  LATE_ARRIVAL_CUTOFF_TIME,
  LATE_ARRIVALS_ALLOWED_PER_MONTH,
  minutesBetween,
  orgThisMonth,
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

interface LateArrivalEvaluation {
  status: "present" | "half_day";
  note: string | null;
  isLate: boolean;
  /** Prior late check-ins this calendar month, not counting today. */
  lateArrivalsUsedThisMonth: number;
}

/**
 * Late-arrival policy, applies to every employee (Office and Site alike):
 * the first LATE_ARRIVALS_ALLOWED_PER_MONTH check-ins after 10:30 AM
 * org-local in a calendar month are free passes (still Present, Full Day);
 * the next one onward auto-converts that day to Half-Day.
 */
async function evaluateLateArrival(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  date: string,
  nowIso: string
): Promise<LateArrivalEvaluation> {
  if (!isLateCheckIn(nowIso)) {
    return { status: "present", note: null, isLate: false, lateArrivalsUsedThisMonth: 0 };
  }

  const month = orgThisMonth();
  const { data: monthRecords } = await supabase
    .from("employee_attendance")
    .select("check_in_at")
    .eq("user_id", userId)
    .gte("date", `${month}-01`)
    .lt("date", date);

  const lateArrivalsUsedThisMonth = (monthRecords ?? []).filter(
    (r) => r.check_in_at && isLateCheckIn(r.check_in_at as string)
  ).length;

  if (lateArrivalsUsedThisMonth >= LATE_ARRIVALS_ALLOWED_PER_MONTH) {
    return {
      status: "half_day",
      note: `Half-Day: checked in at ${formatTime(nowIso)}, after the ${LATE_ARRIVAL_CUTOFF_TIME} AM cutoff — all ${LATE_ARRIVALS_ALLOWED_PER_MONTH} allowed late arrivals this month are already used.`,
      isLate: true,
      lateArrivalsUsedThisMonth,
    };
  }
  return { status: "present", note: null, isLate: true, lateArrivalsUsedThisMonth };
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

  const nowIso = new Date().toISOString();
  const lateEval = await evaluateLateArrival(supabase, ctx.userId, date, nowIso);

  const { data: row, error } = await supabase
    .from("employee_attendance")
    .insert({
      org_id: ctx.orgId,
      user_id: ctx.userId,
      project_id: input.projectId,
      date,
      check_in_at: nowIso,
      check_in_lat: input.lat,
      check_in_lng: input.lng,
      check_in_accuracy: input.accuracy,
      status: lateEval.status,
      note: lateEval.note,
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
    summary:
      lateEval.status === "half_day"
        ? `${ctx.name} checked in late — ${(project as { name: string }).name} — auto-marked Half-Day (late-arrival limit used)`
        : `${ctx.name} checked in — ${(project as { name: string }).name}`,
    meta: { projectId: input.projectId, lat: input.lat, lng: input.lng },
  });

  // Admin notification (In-app + Web Push)
  await dispatchNotification({
    orgId: ctx.orgId,
    roles: ["super_admin"],
    excludeUserId: ctx.userId,
    kind: "info",
    title: lateEval.status === "half_day" ? `${ctx.name} Checked In Late — Half-Day` : `${ctx.name} Checked In`,
    body:
      lateEval.status === "half_day"
        ? `${ctx.name} checked in at ${(project as { name: string }).name} (${formatTime(nowIso)}) — auto-marked Half-Day, all 3 allowed late arrivals this month are used.`
        : `${ctx.name} checked in at ${(project as { name: string }).name} (${formatTime(nowIso)})`,
    href: "/attendance",
  });

  // Employee notification (In-app + Web Push)
  await dispatchNotification({
    orgId: ctx.orgId,
    userIds: [ctx.userId],
    kind: lateEval.status === "half_day" ? "delay" : "info",
    title: "Attendance Marked",
    body:
      lateEval.status === "half_day"
        ? `Checked in at ${formatTime(nowIso)} (${(project as { name: string }).name}). Marked Half-Day (0.5d) — you've used all ${LATE_ARRIVALS_ALLOWED_PER_MONTH} allowed late arrivals this month.`
        : lateEval.isLate
          ? `Checked in at ${formatTime(nowIso)} (${(project as { name: string }).name}). Full Day (1.0d) credited — this was late arrival ${lateEval.lateArrivalsUsedThisMonth + 1} of ${LATE_ARRIVALS_ALLOWED_PER_MONTH} allowed this month.`
          : `Checked in at ${formatTime(nowIso)} (${(project as { name: string }).name}). Full Day (1.0d) credited.`,
    href: "/attendance",
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

export interface HolidayInput {
  date: string; // "YYYY-MM-DD"
  label: string;
  appliesTo: "all" | "office";
}

/** Any org member: list declared company holidays (read-only, RLS-gated). */
export async function getOrgHolidaysAction(): Promise<
  { date: string; label: string; appliesTo: "all" | "office" }[]
> {
  if (!isSupabaseConfigured()) return [];
  const ctx = await getAuthContext();
  if (!ctx?.orgId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("org_holidays")
    .select("date, label, applies_to")
    .eq("org_id", ctx.orgId)
    .order("date", { ascending: true });
  return (data ?? []).map((h) => ({
    date: h.date as string,
    label: (h.label as string | null) ?? "Holiday",
    appliesTo: h.applies_to as "all" | "office",
  }));
}

/** Super_admin/hr only: declare a company holiday (upserts by date). */
export async function addHolidayAction(input: HolidayInput): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { id: "mock" };
  const ctx = await getAuthContext();
  if (!ctx?.orgId || !(ctx.role === "super_admin" || ctx.role === "hr")) return { error: "Not authorized." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { error: "Enter a valid date." };
  if (!input.label.trim()) return { error: "Enter a label for the holiday." };

  // org_holidays has no authenticated write policy — same admin-client
  // pattern as the office geofence on orgs.
  const admin = createAdminClient();
  const { error } = await admin.from("org_holidays").upsert(
    {
      org_id: ctx.orgId,
      date: input.date,
      label: input.label.trim(),
      applies_to: input.appliesTo,
      created_by: ctx.userId,
    },
    { onConflict: "org_id,date" }
  );
  if (error) return { error: error.message };

  await logActivity({
    action: "created",
    entityType: "org",
    entityId: ctx.orgId,
    summary: `${ctx.name} declared ${input.date} a holiday (${input.label.trim()}) — ${input.appliesTo === "office" ? "office staff" : "everyone"}`,
  });
  return { id: input.date };
}

/** Super_admin/hr only: remove a declared holiday. */
export async function deleteHolidayAction(date: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { id: "mock" };
  const ctx = await getAuthContext();
  if (!ctx?.orgId || !(ctx.role === "super_admin" || ctx.role === "hr")) return { error: "Not authorized." };

  const admin = createAdminClient();
  const { error } = await admin.from("org_holidays").delete().eq("org_id", ctx.orgId).eq("date", date);
  if (error) return { error: error.message };

  await logActivity({
    action: "deleted",
    entityType: "org",
    entityId: ctx.orgId,
    summary: `${ctx.name} removed the ${date} holiday`,
  });
  return { id: date };
}

/**
 * One-tap office punch-in: no project, no selfie — just GPS. Mirrors
 * checkInAction's late-arrival evaluation and notifications exactly; the
 * only differences are no project/selfie and the office geofence instead
 * of a project's.
 */
export async function officeCheckInAction(input: OfficePunchInput): Promise<ActionResult> {
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

  const nowIso = new Date().toISOString();
  const lateEval = await evaluateLateArrival(supabase, ctx.userId, date, nowIso);

  const { data: row, error } = await supabase
    .from("employee_attendance")
    .insert({
      org_id: ctx.orgId,
      user_id: ctx.userId,
      project_id: null,
      date,
      check_in_at: nowIso,
      check_in_lat: input.lat,
      check_in_lng: input.lng,
      check_in_accuracy: input.accuracy,
      status: lateEval.status,
      note: lateEval.note,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "Already checked in today." };
    return { error: error.message };
  }

  await logActivity({
    action: "created",
    entityType: "attendance",
    entityId: row.id,
    summary:
      lateEval.status === "half_day"
        ? `${ctx.name} punched in late (office) — auto-marked Half-Day (late-arrival limit used)`
        : `${ctx.name} punched in (office)`,
    meta: { office: true, lat: input.lat, lng: input.lng },
  });

  await dispatchNotification({
    orgId: ctx.orgId,
    roles: ["super_admin"],
    excludeUserId: ctx.userId,
    kind: "info",
    title: lateEval.status === "half_day" ? `${ctx.name} Punched In Late — Half-Day` : `${ctx.name} Punched In (Office)`,
    body:
      lateEval.status === "half_day"
        ? `${ctx.name} punched in at the office (${formatTime(nowIso)}) — auto-marked Half-Day, all 3 allowed late arrivals this month are used.`
        : `${ctx.name} punched in at the office (${formatTime(nowIso)})`,
    href: "/attendance",
  });

  await dispatchNotification({
    orgId: ctx.orgId,
    userIds: [ctx.userId],
    kind: lateEval.status === "half_day" ? "delay" : "info",
    title: "Punched In",
    body:
      lateEval.status === "half_day"
        ? `Punched in at ${formatTime(nowIso)}. Marked Half-Day (0.5d) — you've used all ${LATE_ARRIVALS_ALLOWED_PER_MONTH} allowed late arrivals this month.`
        : lateEval.isLate
          ? `Punched in at ${formatTime(nowIso)}. Full Day (1.0d) credited — this was late arrival ${lateEval.lateArrivalsUsedThisMonth + 1} of ${LATE_ARRIVALS_ALLOWED_PER_MONTH} allowed this month.`
          : `Punched in at ${formatTime(nowIso)}. Full Day (1.0d) credited.`,
    href: "/attendance",
  });

  return { id: row.id };
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

// ----------------------------------------------------------------------------
// Live location tracking (0042) — foreground-only: a website cannot track
// location once the phone is locked or backgrounded (OS-level restriction on
// every browser, not something this app can work around). This is a periodic
// ping while the employee's My Attendance page stays open during an active
// (self-checked-in, not yet checked out) shift — see use-live-tracking.ts for
// the client side. A ping is refused for anyone without a real, open,
// self-verified check-in today (declarative/admin-marked days never have
// real GPS and must never show on the live map).
// ----------------------------------------------------------------------------

export interface RecordLocationPingInput {
  lat: number;
  lng: number;
  accuracy: number;
}

export async function recordLocationPingAction(
  input: RecordLocationPingInput
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: true };
  const ctx = await getAuthContext();
  if (!ctx?.orgId || !ctx?.userId) return { ok: false, error: "Not signed in." };
  if (!validCoords(input.lat, input.lng, input.accuracy)) {
    return { ok: false, error: "Could not read a valid location." };
  }

  const supabase = await createClient();
  const today = orgToday();
  const { data: openRow } = await supabase
    .from("employee_attendance")
    .select("id, check_out_at, source")
    .eq("user_id", ctx.userId)
    .eq("date", today)
    .maybeSingle();
  if (!openRow || openRow.check_out_at || openRow.source !== "self") {
    return { ok: false, error: "No active check-in to track." };
  }

  const { error } = await supabase.from("attendance_location_pings").insert({
    org_id: ctx.orgId,
    attendance_id: openRow.id,
    user_id: ctx.userId,
    lat: input.lat,
    lng: input.lng,
    accuracy: input.accuracy,
  });
  if (error) {
    if (error.code === "PGRST205" || error.message.includes("attendance_location_pings")) {
      return { ok: false, error: "Live tracking table pending: Run 0042_attendance_location_pings.sql in Supabase SQL Editor." };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export interface LiveLocation {
  attendanceId: string;
  userId: string;
  userName: string;
  employeeId: string;
  projectId: string | null;
  projectName: string | null;
  checkInAt: string;
  lastPing: { lat: number; lng: number; accuracy: number | null; recordedAt: string } | null;
  /** Straight-line distance from the assigned project's geofence center, if one is configured. */
  distanceFromSiteM: number | null;
}

/** Super_admin/hr only: every staff member currently checked in (self, real GPS, not yet out) today, with their last known ping. */
export async function getLiveLocationsAction(): Promise<LiveLocation[]> {
  if (!isSupabaseConfigured()) return [];
  const ctx = await getAuthContext();
  if (!ctx?.orgId || !(ctx.role === "super_admin" || ctx.role === "hr")) return [];

  const admin = createAdminClient();
  const today = orgToday();

  const { data: openData, error: openErr } = await admin
    .from("employee_attendance")
    .select("id, user_id, project_id, check_in_at")
    .eq("org_id", ctx.orgId)
    .eq("date", today)
    .is("check_out_at", null)
    .eq("source", "self");
  if (openErr) return [];
  const rows = (openData ?? []) as { id: string; user_id: string; project_id: string | null; check_in_at: string }[];
  if (!rows.length) return [];

  const attendanceIds = rows.map((r) => r.id);
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const projectIds = Array.from(new Set(rows.map((r) => r.project_id).filter((p): p is string => Boolean(p))));

  const [pingsRes, profilesRes, memRes, projRes] = await Promise.all([
    admin
      .from("attendance_location_pings")
      .select("attendance_id, lat, lng, accuracy, recorded_at")
      .in("attendance_id", attendanceIds)
      .order("recorded_at", { ascending: false }),
    admin.from("profiles").select("id, name").in("id", userIds),
    admin.from("memberships").select("user_id, employee_id").eq("org_id", ctx.orgId).in("user_id", userIds),
    projectIds.length
      ? admin.from("projects").select("id, name, geofence_lat, geofence_lng, geofence_radius_m").in("id", projectIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  type PingRow = { attendance_id: string; lat: number; lng: number; accuracy: number | null; recorded_at: string };
  const latestPingByAttendance = new Map<string, LiveLocation["lastPing"]>();
  for (const p of (pingsRes.data ?? []) as PingRow[]) {
    if (!latestPingByAttendance.has(p.attendance_id)) {
      latestPingByAttendance.set(p.attendance_id, { lat: p.lat, lng: p.lng, accuracy: p.accuracy, recordedAt: p.recorded_at });
    }
  }
  const nameById = new Map(
    ((profilesRes.data ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name])
  );
  const empIdByUser = new Map(
    ((memRes.data ?? []) as { user_id: string; employee_id: string | null }[]).map((m) => [m.user_id, m.employee_id ?? ""])
  );
  type ProjRow = { id: string; name: string; geofence_lat: number | null; geofence_lng: number | null; geofence_radius_m: number | null };
  const projectById = new Map(((projRes.data ?? []) as ProjRow[]).map((p) => [p.id, p]));

  return rows.map((r) => {
    const project = r.project_id ? projectById.get(r.project_id) : undefined;
    const lastPing = latestPingByAttendance.get(r.id) ?? null;
    let distanceFromSiteM: number | null = null;
    if (lastPing && project?.geofence_lat != null && project?.geofence_lng != null) {
      distanceFromSiteM = Math.round(haversineMeters(lastPing.lat, lastPing.lng, project.geofence_lat, project.geofence_lng));
    }
    return {
      attendanceId: r.id,
      userId: r.user_id,
      userName: nameById.get(r.user_id) ?? "Unknown",
      employeeId: empIdByUser.get(r.user_id) ?? "",
      projectId: r.project_id,
      projectName: project?.name ?? null,
      checkInAt: r.check_in_at,
      lastPing,
      distanceFromSiteM,
    };
  });
}
