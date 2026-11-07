"use server";

import { getAuthContext } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { logActivity } from "@/lib/activity/log";
import { isExternalRole } from "@/lib/auth/roles";
import {
  addDaysIso,
  flexWeekOffProblem,
  mondayOf,
  orgToday,
  toWeekOffHistory,
  toWeekOffKind,
  validateWeekOffSwap,
  type OrgHoliday,
  type WeekOffRule,
} from "@/lib/attendance/compute";

export interface ActionResult {
  id?: string;
  error?: string;
}

const TABLE = "attendance_week_off_swaps";
const PENDING = "Weekly-off table pending: run 0047_attendance_weekly_off.sql in Supabase SQL Editor.";
const NOTE_MAX = 500;

/** Missing table (PGRST205/42P01) or column (42703/PGRST204) — 0047 not applied yet. */
const isMigrationPending = (code?: string) =>
  code === "PGRST205" || code === "PGRST204" || code === "42703" || code === "42P01";

export interface WeekOffSwapInput {
  userId: string;
  workedDate: string; // a default off day the employee works
  offDate: string; // the replacement off day (±6 days)
  note?: string;
}

/**
 * Super_admin/hr only: record that an employee works one of their weekly off
 * days and takes another day (same week) off instead. Approved on save — no
 * request flow. Re-validated here against fresh DB data, since the client's
 * board may be stale.
 */
export async function createWeekOffSwapAction(input: WeekOffSwapInput): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { id: "mock" };
  const ctx = await getAuthContext();
  if (!ctx?.orgId || !(ctx.role === "super_admin" || ctx.role === "hr")) return { error: "Not authorized." };

  const admin = createAdminClient();
  // Service-role client bypasses RLS — scoping to the caller's org here is
  // the only thing stopping a cross-org write.
  const { data: member, error: memErr } = await admin
    .from("memberships")
    .select("user_id, weekly_off_dow, is_office")
    .eq("org_id", ctx.orgId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (memErr) return { error: isMigrationPending(memErr.code) ? PENDING : memErr.message };
  if (!member) return { error: "That member isn't in your organization." };

  const [swapsRes, holidaysRes, historyRes, kindRes, historyKindRes] = await Promise.all([
    admin.from(TABLE).select("worked_date, off_date").eq("user_id", input.userId),
    admin.from("org_holidays").select("date, label, applies_to").eq("org_id", ctx.orgId),
    admin.from("attendance_weekly_off_history").select("dow, effective_from").eq("user_id", input.userId),
    // Weekly-off kind / anchor (0049) — own queries: missing columns = "fixed".
    admin
      .from("memberships")
      .select("weekly_off_kind, weekly_off_anchor")
      .eq("org_id", ctx.orgId)
      .eq("user_id", input.userId)
      .maybeSingle(),
    admin.from("attendance_weekly_off_history").select("effective_from, kind, anchor").eq("user_id", input.userId),
  ]);
  if (swapsRes.error) return { error: isMigrationPending(swapsRes.error.code) ? PENDING : swapsRes.error.message };
  if (holidaysRes.error) return { error: holidaysRes.error.message };
  if (historyRes.error && !isMigrationPending(historyRes.error.code)) return { error: historyRes.error.message };

  const kind = kindRes.error ? null : (kindRes.data as { weekly_off_kind: string | null; weekly_off_anchor: string | null } | null);
  const rule: WeekOffRule = {
    defaultDow: (member.weekly_off_dow as number | null) ?? 0,
    kind: toWeekOffKind(kind?.weekly_off_kind),
    anchor: kind?.weekly_off_anchor ?? undefined,
    history: historyRes.error
      ? []
      : toWeekOffHistory(
          (historyRes.data ?? []) as { dow: number; effective_from: string }[],
          historyKindRes.error
            ? []
            : ((historyKindRes.data ?? []) as { effective_from: string; kind: string | null; anchor: string | null }[])
        ),
    swaps: ((swapsRes.data ?? []) as { worked_date: string; off_date: string }[]).map((s) => ({
      workedDate: s.worked_date,
      offDate: s.off_date,
    })),
  };
  const holidays: OrgHoliday[] = (holidaysRes.data ?? []).map((h) => ({
    date: h.date as string,
    label: (h.label as string | null) ?? "Holiday",
    appliesTo: h.applies_to as "all" | "office",
  }));
  const invalid = validateWeekOffSwap(
    rule,
    input.workedDate,
    input.offDate,
    holidays,
    (member.is_office as boolean | null) ?? true
  );
  if (invalid) return { error: invalid };

  const { data, error } = await admin
    .from(TABLE)
    .insert({
      org_id: ctx.orgId,
      user_id: input.userId,
      worked_date: input.workedDate,
      off_date: input.offDate,
      note: input.note?.trim().slice(0, NOTE_MAX) || null,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) {
    if (isMigrationPending(error.code)) return { error: PENDING };
    // A concurrent save took one of the dates (unique per user).
    if (error.code === "23505") return { error: "One of those dates is already part of another swap." };
    return { error: error.message };
  }

  await logActivity({
    action: "created",
    entityType: "attendance",
    entityId: data.id as string,
    summary: `${ctx.name} recorded a weekly-off swap — works ${input.workedDate}, off ${input.offDate}`,
    meta: { userId: input.userId, workedDate: input.workedDate, offDate: input.offDate },
  });
  return { id: data.id as string };
}

/** Super_admin/hr only: remove a recorded weekly-off swap (the default off day applies again). */
export async function deleteWeekOffSwapAction(id: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { id: "mock" };
  const ctx = await getAuthContext();
  if (!ctx?.orgId || !(ctx.role === "super_admin" || ctx.role === "hr")) return { error: "Not authorized." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from(TABLE)
    .delete()
    .eq("org_id", ctx.orgId)
    .eq("id", id)
    .select("id, user_id, worked_date, off_date");
  if (error) return { error: isMigrationPending(error.code) ? PENDING : error.message };
  const row = data?.[0];
  if (!row) return { error: "Swap not found." };

  await logActivity({
    action: "deleted",
    entityType: "attendance",
    entityId: id,
    summary: `${ctx.name} removed a weekly-off swap — works ${row.worked_date}, off ${row.off_date}`,
    meta: { userId: row.user_id },
  });
  return { id };
}

// ----------------------------------------------------------------------------
// Flexible weekly off (0055): one chosen day per Monday–Sunday week. The
// employee picks today or a later day of this/next week; Super Admin/HR can
// set, move or remove any day, past ones included. Missed days never become
// weekly offs by themselves.
// ----------------------------------------------------------------------------

const FLEX_TABLE = "attendance_flex_week_offs";
const FLEX_PENDING = "Flexible weekly off pending: run 0055_flexible_week_offs.sql in Supabase SQL Editor.";

type Admin = ReturnType<typeof createAdminClient>;

/** The member's weekly-off rule (incl. chosen Flexible days) + Office flag + org holidays, fresh from the DB. */
async function loadFlexContext(
  admin: Admin,
  orgId: string,
  userId: string
): Promise<{ error: string } | { rule: WeekOffRule; isOffice: boolean; holidays: OrgHoliday[]; offs: { id: string; date: string }[] }> {
  const [memRes, kindRes, historyRes, historyKindRes, swapsRes, holidaysRes, flexRes] = await Promise.all([
    admin.from("memberships").select("weekly_off_dow, is_office").eq("org_id", orgId).eq("user_id", userId).maybeSingle(),
    admin.from("memberships").select("weekly_off_kind, weekly_off_anchor").eq("org_id", orgId).eq("user_id", userId).maybeSingle(),
    admin.from("attendance_weekly_off_history").select("dow, effective_from").eq("user_id", userId),
    admin.from("attendance_weekly_off_history").select("effective_from, kind, anchor").eq("user_id", userId),
    admin.from(TABLE).select("worked_date, off_date").eq("user_id", userId),
    admin.from("org_holidays").select("date, label, applies_to").eq("org_id", orgId),
    admin.from(FLEX_TABLE).select("id, date").eq("org_id", orgId).eq("user_id", userId),
  ]);
  if (memRes.error) return { error: isMigrationPending(memRes.error.code) ? PENDING : memRes.error.message };
  if (!memRes.data) return { error: "That member isn't in your organization." };
  if (flexRes.error) return { error: isMigrationPending(flexRes.error.code) ? FLEX_PENDING : flexRes.error.message };
  if (holidaysRes.error) return { error: holidaysRes.error.message };
  const kind = kindRes.error ? null : (kindRes.data as { weekly_off_kind: string | null; weekly_off_anchor: string | null } | null);
  const offs = (flexRes.data ?? []) as { id: string; date: string }[];
  const rule: WeekOffRule = {
    defaultDow: (memRes.data.weekly_off_dow as number | null) ?? 0,
    kind: toWeekOffKind(kind?.weekly_off_kind),
    anchor: kind?.weekly_off_anchor ?? undefined,
    history: historyRes.error
      ? []
      : toWeekOffHistory(
          (historyRes.data ?? []) as { dow: number; effective_from: string }[],
          historyKindRes.error
            ? []
            : ((historyKindRes.data ?? []) as { effective_from: string; kind: string | null; anchor: string | null }[])
        ),
    swaps: swapsRes.error
      ? []
      : ((swapsRes.data ?? []) as { worked_date: string; off_date: string }[]).map((x) => ({ workedDate: x.worked_date, offDate: x.off_date })),
    flexOffs: offs.map((o) => o.date),
  };
  const holidays: OrgHoliday[] = (holidaysRes.data ?? []).map((h) => ({
    date: h.date as string,
    label: (h.label as string | null) ?? "Holiday",
    appliesTo: h.applies_to as "all" | "office",
  }));
  return { rule, isOffice: (memRes.data.is_office as boolean | null) ?? true, holidays, offs };
}

/**
 * Choose (or move) a Flexible weekly off. Without `userId` (or with your own)
 * it's the employee's own pick: today or a later day of this/next week, and
 * an off that has already passed can't be moved. Super Admin/HR may set any
 * member's day, past ones included. Never on a day with attendance.
 */
export async function setFlexWeekOffAction(input: { userId?: string; date: string }): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { id: "mock" };
  const ctx = await getAuthContext();
  if (!ctx?.orgId) return { error: "You must be signed in." };
  if (isExternalRole(ctx.role)) return { error: "Not authorized." };
  const isAdmin = ctx.role === "super_admin" || ctx.role === "hr";
  const userId = input.userId || ctx.userId;
  const self = userId === ctx.userId;
  if (!self && !isAdmin) return { error: "Not authorized." };

  const today = orgToday();
  const lastDay = addDaysIso(mondayOf(today), 13); // Sunday of next week
  const date = input.date;
  if (date > lastDay) return { error: "You can choose a weekly off for this week or next week only." };
  if (!isAdmin && date < today) return { error: "Choose today or a later day. Ask HR to change a past day." };

  const admin = createAdminClient();
  const loaded = await loadFlexContext(admin, ctx.orgId, userId);
  if ("error" in loaded) return loaded;
  const week = mondayOf(date);
  const existing = loaded.offs.find((o) => mondayOf(o.date) === week);
  if (existing?.date === date) return { id: existing.id };
  if (existing && !isAdmin && existing.date < today) {
    return { error: `This week's weekly off (${existing.date}) has already passed. Ask HR to change it.` };
  }
  const problem = flexWeekOffProblem(loaded.rule, date, loaded.holidays, loaded.isOffice, existing?.date);
  if (problem) return { error: problem };

  const { data: worked } = await admin
    .from("employee_attendance")
    .select("id")
    .eq("org_id", ctx.orgId)
    .eq("user_id", userId)
    .eq("date", date)
    .limit(1);
  if (worked?.length) return { error: "There's already attendance on that day, so it can't be a weekly off." };

  if (existing) {
    const { error: delErr } = await admin.from(FLEX_TABLE).delete().eq("id", existing.id);
    if (delErr) return { error: delErr.message };
  }
  const { data, error } = await admin
    .from(FLEX_TABLE)
    .insert({ org_id: ctx.orgId, user_id: userId, date, week_start: week, set_by: ctx.userId, set_by_admin: !self })
    .select("id")
    .single();
  if (error) {
    if (isMigrationPending(error.code)) return { error: FLEX_PENDING };
    if (error.code === "23505") return { error: "There's already a weekly off this week. Only one per week (Mon–Sun)." };
    return { error: error.message };
  }

  await logActivity({
    action: existing ? "updated" : "created",
    entityType: "attendance",
    entityId: data.id as string,
    summary: self
      ? `${ctx.name} chose ${date} as their weekly off${existing ? ` (was ${existing.date})` : ""}`
      : `${ctx.name} set a weekly off on ${date}${existing ? ` (was ${existing.date})` : ""}`,
    meta: { userId, date, previous: existing?.date ?? null },
  });
  return { id: data.id as string };
}

/** Remove a chosen Flexible weekly off: your own while it's today or later; Super Admin/HR any. */
export async function removeFlexWeekOffAction(input: { userId?: string; date: string }): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { id: "mock" };
  const ctx = await getAuthContext();
  if (!ctx?.orgId) return { error: "You must be signed in." };
  if (isExternalRole(ctx.role)) return { error: "Not authorized." };
  const isAdmin = ctx.role === "super_admin" || ctx.role === "hr";
  const userId = input.userId || ctx.userId;
  if (userId !== ctx.userId && !isAdmin) return { error: "Not authorized." };
  if (!isAdmin && input.date < orgToday()) return { error: "That day has passed. Ask HR to change it." };

  const { data, error } = await createAdminClient()
    .from(FLEX_TABLE)
    .delete()
    .eq("org_id", ctx.orgId)
    .eq("user_id", userId)
    .eq("date", input.date)
    .select("id");
  if (error) return { error: isMigrationPending(error.code) ? FLEX_PENDING : error.message };
  if (!data?.length) return { error: "That weekly off wasn't found." };

  await logActivity({
    action: "deleted",
    entityType: "attendance",
    entityId: data[0].id as string,
    summary: `${ctx.name} removed the weekly off on ${input.date}`,
    meta: { userId, date: input.date },
  });
  return { id: data[0].id as string };
}
