"use server";

import { getAuthContext } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { logActivity } from "@/lib/activity/log";
import { toWeekOffHistory, validateWeekOffSwap, type OrgHoliday, type WeekOffRule } from "@/lib/attendance/compute";

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

  const [swapsRes, holidaysRes, historyRes] = await Promise.all([
    admin.from(TABLE).select("worked_date, off_date").eq("user_id", input.userId),
    admin.from("org_holidays").select("date, label, applies_to").eq("org_id", ctx.orgId),
    admin.from("attendance_weekly_off_history").select("dow, effective_from").eq("user_id", input.userId),
  ]);
  if (swapsRes.error) return { error: isMigrationPending(swapsRes.error.code) ? PENDING : swapsRes.error.message };
  if (holidaysRes.error) return { error: holidaysRes.error.message };
  if (historyRes.error && !isMigrationPending(historyRes.error.code)) return { error: historyRes.error.message };

  const rule: WeekOffRule = {
    defaultDow: (member.weekly_off_dow as number | null) ?? 0,
    history: historyRes.error
      ? []
      : toWeekOffHistory((historyRes.data ?? []) as { dow: number; effective_from: string }[]),
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
