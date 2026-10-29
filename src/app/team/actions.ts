"use server";

import { getAuthContext } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminRole } from "@/lib/auth/permissions";
import { isExternalRole } from "@/lib/auth/roles";
import { logActivity } from "@/lib/activity/log";
import { roleLabel } from "@/lib/labels";
import { isSunday, orgToday, toWeekOffKind, WEEK_OFF_KINDS, type WeekOffKind } from "@/lib/attendance/compute";
import type { Role } from "@/lib/types";

export interface ActionResult {
  id?: string;
  error?: string;
}

function initialsOf(name: string) {
  const p = name.trim().split(/\s+/);
  return (((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || name.slice(0, 2).toUpperCase() || "U");
}

/** Phone → login-alias email (no SMS/OTP; phone+password auth on email provider). */
function phoneAlias(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return { digits, email: `${digits}@sitehub.phone` };
}

/** Next sequential Employee ID (KV001, KV002, …) after the highest existing one. */
function nextEmployeeId(existing: (string | null)[]): string {
  const max = existing.reduce((m, id) => {
    const x = /^KV(\d+)$/.exec(id ?? "");
    return x ? Math.max(m, Number(x[1])) : m;
  }, 0);
  return `KV${String(max + 1).padStart(3, "0")}`;
}

/**
 * Fetch the org's employee IDs and compute the next one. Returns null when the
 * employee_id column doesn't exist yet (migration 0015 not applied) so member
 * creation keeps working pre-migration.
 */
async function computeNextEmployeeId(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string
): Promise<string | null> {
  const { data, error } = await admin
    .from("memberships")
    .select("employee_id")
    .eq("org_id", orgId);
  if (error) return null;
  return nextEmployeeId((data ?? []).map((r) => (r as { employee_id: string | null }).employee_id));
}

export interface NewMemberInput {
  name: string;
  phone: string;
  password: string;
  role: Role;
}

/** Admin-only: create a phone+password login and enrol it in the org with a role. */
export async function createMemberAction(input: NewMemberInput): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !isAdminRole(ctx.role)) return { error: "Not authorized." };
  if (!ctx.orgId) return { error: "No organization found." };

  const { digits, email } = phoneAlias(input.phone);
  if (digits.length < 6) return { error: "Enter a valid phone number." };
  if (input.password.length < 6) return { error: "Password must be at least 6 characters." };
  if (!input.name.trim()) return { error: "Name is required." };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { name: input.name.trim(), phone: input.phone.trim() },
  });
  if (error) return { error: error.message };
  const userId = data.user?.id;
  if (!userId) return { error: "Could not create the account." };

  await admin
    .from("profiles")
    .upsert({ id: userId, name: input.name.trim(), initials: initialsOf(input.name) }, { onConflict: "id" });

  type MembershipUpsert = {
    org_id: string;
    user_id: string;
    role: Role;
    is_active: boolean;
    employee_id?: string;
  };
  const membership: MembershipUpsert = { org_id: ctx.orgId, user_id: userId, role: input.role, is_active: true };
  const upsertMembership = (row: MembershipUpsert) =>
    admin.from("memberships").upsert(row, { onConflict: "org_id,user_id" });

  // Employee IDs are for employees — external logins (clients / subcontractors) get none.
  let employeeId = isExternalRole(input.role) ? null : await computeNextEmployeeId(admin, ctx.orgId);
  let { error: mErr } = await upsertMembership(
    employeeId ? { ...membership, employee_id: employeeId } : membership
  );
  if (mErr && employeeId && mErr.code === "23505") {
    // Concurrent create took our number — recompute and retry once.
    employeeId = await computeNextEmployeeId(admin, ctx.orgId);
    ({ error: mErr } = await upsertMembership(
      employeeId ? { ...membership, employee_id: employeeId } : membership
    ));
  } else if (mErr && employeeId && mErr.code === "42703") {
    // employee_id column missing (migration 0015 not applied) — insert without it.
    ({ error: mErr } = await upsertMembership(membership));
  }
  if (mErr) return { error: mErr.message };
  await logActivity({
    action: "created",
    entityType: "member",
    entityId: userId,
    summary: `Created ${roleLabel[input.role] ?? input.role} account for ${input.name.trim()}`,
  });
  return { id: userId };
}

/** Admin-only: change a member's role. */
export async function setMemberRoleAction(userId: string, role: Role): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !isAdminRole(ctx.role)) return { error: "Not authorized." };
  if (!ctx.orgId) return { error: "No organization found." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("memberships")
    .update({ role })
    .eq("org_id", ctx.orgId)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  await logActivity({
    action: "updated",
    entityType: "member",
    entityId: userId,
    summary: `Changed role to ${roleLabel[role] ?? role}`,
  });
  return { id: userId };
}

/** Admin-only: rename a member (their display name — not their login phone/password). */
export async function renameMemberAction(userId: string, name: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !isAdminRole(ctx.role)) return { error: "Not authorized." };
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name can't be empty." };

  const admin = createAdminClient();

  // employees (Payroll) is a separate table with its own `name` column, not
  // derived from profiles — fetch the pre-rename name so we can find a row
  // that was never linked by profile_id (the common case: it was created by
  // typing a name, not tied to this login) and keep it in sync too, instead
  // of leaving Payroll silently showing the old name forever.
  const { data: existingProfile } = await admin.from("profiles").select("name").eq("id", userId).maybeSingle();
  const oldName = (existingProfile?.name as string | undefined)?.trim();

  const { error: profileErr } = await admin
    .from("profiles")
    .upsert({ id: userId, name: trimmed, initials: initialsOf(trimmed) }, { onConflict: "id" });
  if (profileErr) return { error: profileErr.message };

  // profiles.name is always the primary source /team reads (see page.tsx) —
  // no need to also round-trip the slower Auth Admin API to sync
  // user_metadata.name, which is only ever consulted as a fallback.

  // Keep Payroll's employees.name in sync: update any row already linked by
  // profile_id, and — for a legacy row never linked that way — match it by
  // its old name and link it (profile_id) at the same time, so every rename
  // after this one updates it reliably via the id instead of a name guess.
  await admin.from("employees").update({ name: trimmed }).eq("profile_id", userId);
  if (oldName && oldName.toLowerCase() !== trimmed.toLowerCase()) {
    await admin
      .from("employees")
      .update({ name: trimmed, profile_id: userId })
      .is("profile_id", null)
      .ilike("name", oldName);
  }

  await logActivity({
    action: "updated",
    entityType: "member",
    entityId: userId,
    summary: `Renamed to ${trimmed}`,
  });
  return { id: userId };
}

/**
 * Admin-only: change a member's login phone number. Phone logins are really
 * an email alias (`<digits>@sitehub.phone`) under the hood, so this updates
 * both the Auth user's email (what they actually log in with) and the
 * `phone` kept in user_metadata (what /team reads for display) — see
 * src/app/team/page.tsx's `meta.phone || au?.phone` fallback.
 */
export async function updateMemberPhoneAction(userId: string, phone: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !isAdminRole(ctx.role)) return { error: "Not authorized." };
  if (!ctx.orgId) return { error: "No organization found." };

  const { digits, email } = phoneAlias(phone);
  if (digits.length < 6) return { error: "Enter a valid phone number." };

  const admin = createAdminClient();
  const { data: member, error: lookupErr } = await admin
    .from("memberships")
    .select("user_id")
    .eq("org_id", ctx.orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (lookupErr) return { error: lookupErr.message };
  if (!member) return { error: "That member isn't in your organization." };

  const { data: existing, error: getErr } = await admin.auth.admin.getUserById(userId);
  if (getErr) return { error: getErr.message };
  const prevPhone = (existing.user?.user_metadata as { phone?: string } | undefined)?.phone ?? "";

  const { error } = await admin.auth.admin.updateUserById(userId, {
    email,
    email_confirm: true,
    user_metadata: { ...(existing.user?.user_metadata ?? {}), phone: phone.trim() },
  });
  if (error) {
    // The underlying conflict is a raw Postgres unique-violation on the
    // email-alias column (not GoTrue's usual signup-style error shape), so
    // `.message` isn't reliably a clean string here — guard it and reword
    // in terms the admin actually typed (a phone, not an email/DB error).
    const raw = String((error as { message?: string }).message ?? error);
    if (/duplicate key|already exist|already been registered/i.test(raw)) {
      return { error: "That phone number is already used by another account." };
    }
    return { error: raw || "Could not update the login phone — please try again." };
  }

  await logActivity({
    action: "updated",
    entityType: "member",
    entityId: userId,
    summary: prevPhone ? `Changed login phone from ${prevPhone} to ${phone.trim()}` : `Set login phone to ${phone.trim()}`,
  });
  return { id: userId };
}

/** Admin-only: grant/revoke a member's access to Purchase Orders. */
export async function setMemberPoAccessAction(userId: string, canView: boolean): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !isAdminRole(ctx.role)) return { error: "Not authorized." };
  if (!ctx.orgId) return { error: "No organization found." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("memberships")
    .update({ can_view_purchase_orders: canView })
    .eq("org_id", ctx.orgId)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  await logActivity({
    action: "updated",
    entityType: "member",
    entityId: userId,
    summary: canView ? "Granted Purchase Orders access" : "Revoked Purchase Orders access",
  });
  return { id: userId };
}

/**
 * Admin-only: explicitly set whether a member counts as Office or Site.
 * Independent of project assignment -- this only drives the 1-paid-leave-
 * per-month rule, the office-only-holiday exclusion, and the Office/Site
 * badge; it does not change which check-in flow they see.
 */
export async function setMemberOfficeAction(userId: string, isOffice: boolean): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !isAdminRole(ctx.role)) return { error: "Not authorized." };
  if (!ctx.orgId) return { error: "No organization found." };
  const admin = createAdminClient();
  if (isOffice) {
    // Alternate / Flexible weekly offs are Site-only (office pay keeps a
    // fixed weekly off). Missing 0049 column = everyone is "fixed" anyway.
    const { data: wo, error: woErr } = await admin
      .from("memberships")
      .select("weekly_off_kind")
      .eq("org_id", ctx.orgId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!woErr && toWeekOffKind(wo?.weekly_off_kind) !== "fixed") {
      return { error: "Set this member's weekly off to Every Sunday or a fixed day first — Alternate and Flexible are for Site staff only." };
    }
  }
  const { error } = await admin
    .from("memberships")
    .update({ is_office: isOffice })
    .eq("org_id", ctx.orgId)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  if (isOffice) {
    // "Can work from office" is for Site members only (0050). Its own update
    // so a missing column (0050 not applied) just gets ignored.
    await admin
      .from("memberships")
      .update({ can_work_from_office: false })
      .eq("org_id", ctx.orgId)
      .eq("user_id", userId);
  } else {
    // "Client visits allowed" is for Office members only (0051). Its own
    // update so a missing column (0051 not applied) just gets ignored.
    await admin
      .from("memberships")
      .update({ client_visits_allowed: false })
      .eq("org_id", ctx.orgId)
      .eq("user_id", userId);
  }
  await logActivity({
    action: "updated",
    entityType: "member",
    entityId: userId,
    summary: `Set attendance category to ${isOffice ? "Office" : "Site"}`,
  });
  return { id: userId };
}

/**
 * Super_admin only (0050 addendum): let a SITE member use "Office" as a site
 * — offered first in their check-in and Switch Site pickers, judged against
 * the org office fence. Pay / weekly-off / leave still follow Office/Site.
 */
export async function setMemberWorkFromOfficeAction(userId: string, canWorkFromOffice: boolean): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || ctx.role !== "super_admin") return { error: "Only Super Admin can change this." };
  if (!ctx.orgId) return { error: "No organization found." };
  const admin = createAdminClient();
  if (canWorkFromOffice) {
    const { data: mem } = await admin
      .from("memberships")
      .select("is_office")
      .eq("org_id", ctx.orgId)
      .eq("user_id", userId)
      .maybeSingle();
    if ((mem?.is_office as boolean | null | undefined) ?? true) {
      return { error: "Only Site members can work from the office — set this member to Site first." };
    }
  }
  const { error } = await admin
    .from("memberships")
    .update({ can_work_from_office: canWorkFromOffice })
    .eq("org_id", ctx.orgId)
    .eq("user_id", userId);
  if (error) {
    if (error.code === "42703" || error.code === "PGRST204") {
      return { error: "Work-from-office setting pending: run 0050_attendance_site_visits.sql in Supabase SQL Editor." };
    }
    return { error: error.message };
  }
  await logActivity({
    action: "updated",
    entityType: "member",
    entityId: userId,
    summary: canWorkFromOffice ? "Allowed to work from the office (Office as a site)" : "No longer allowed to work from the office",
  });
  return { id: userId };
}

/**
 * Super_admin only (0051): let an OFFICE member punch in/out away from the
 * office (client visits) — instead of being blocked by the office fence they
 * give a reason, which Admin/HR see. They stay Office: no tracking, office
 * leave and salary rules.
 */
export async function setMemberClientVisitsAction(userId: string, allowed: boolean): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || ctx.role !== "super_admin") return { error: "Only Super Admin can change this." };
  if (!ctx.orgId) return { error: "No organization found." };
  const admin = createAdminClient();
  if (allowed) {
    const { data: mem } = await admin
      .from("memberships")
      .select("is_office")
      .eq("org_id", ctx.orgId)
      .eq("user_id", userId)
      .maybeSingle();
    if (((mem?.is_office as boolean | null | undefined) ?? true) === false) {
      return { error: "Client visits are for Office members — set this member to Office first." };
    }
  }
  const { error } = await admin
    .from("memberships")
    .update({ client_visits_allowed: allowed })
    .eq("org_id", ctx.orgId)
    .eq("user_id", userId);
  if (error) {
    if (error.code === "42703" || error.code === "PGRST204") {
      return { error: CLIENT_VISITS_PENDING };
    }
    return { error: error.message };
  }
  await logActivity({
    action: "updated",
    entityType: "member",
    entityId: userId,
    summary: allowed ? "Allowed client visits (punch away from office with a reason)" : "Client visits no longer allowed",
  });
  return { id: userId };
}

const CLIENT_VISITS_PENDING =
  "Client visits setting pending: run 0051_departments_client_visits.sql in Supabase SQL Editor.";

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const WEEK_OFF_PENDING = "Weekly-off table pending: run 0047_attendance_weekly_off.sql in Supabase SQL Editor.";
const WEEK_OFF_KINDS_PENDING =
  "Weekly-off update pending: run 0049_attendance_weekly_off_types.sql in Supabase SQL Editor.";

/** Missing table (PGRST205/42P01) or column (42703/PGRST204) — a migration not applied yet. */
const isWeekOffPending = (code?: string) =>
  code === "42703" || code === "PGRST204" || code === "PGRST205" || code === "42P01";

export interface WeeklyOffPatternInput {
  kind: WeekOffKind;
  /** fixed: 0 = Sunday … 6 = Saturday. Ignored (stored as 0) for the other kinds. */
  dow?: number;
  /** alternate_sunday: one off Sunday ("YYYY-MM-DD"). */
  anchor?: string;
}

function describeWeekOff(kind: WeekOffKind, dow: number, anchor: string | null): string {
  if (kind === "alternate_sunday") return `alternate Sundays (off ${anchor})`;
  if (kind === "flexible") return "flexible (= Sundays in month)";
  return WEEKDAY_NAMES[dow];
}

/**
 * Admin-only: set a member's weekly-off pattern — a fixed weekday (0047), or
 * for Site staff alternate Sundays / flexible (0049). Same gate as the
 * Office/Site setter. Swaps against it are recorded separately
 * (attendance/week-off-actions).
 *
 * The new pattern takes effect from today: each change is a row in
 * attendance_weekly_off_history, so past attendance keeps whatever pattern
 * was in force then. The first change also records a baseline row (the
 * previous pattern, from 2000-01-01). Refused while the member has upcoming
 * swaps, which were validated against the old pattern. Before 0049 only a
 * fixed day can be set (written exactly as before).
 */
export async function setWeeklyOffPatternAction(userId: string, input: WeeklyOffPatternInput): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !isAdminRole(ctx.role)) return { error: "Not authorized." };
  if (!ctx.orgId) return { error: "No organization found." };
  const kind = input?.kind;
  if (!WEEK_OFF_KINDS.includes(kind)) return { error: "Pick a weekly-off type." };
  let dow = 0;
  let anchor: string | null = null;
  if (kind === "fixed") {
    dow = input.dow ?? 0;
    if (!Number.isInteger(dow) || dow < 0 || dow > 6) return { error: "Pick a day of the week." };
  } else if (kind === "alternate_sunday") {
    if (!input.anchor || !isSunday(input.anchor)) return { error: "Pick an off Sunday for alternate Sundays." };
    anchor = input.anchor;
  }
  const admin = createAdminClient();
  const today = orgToday();

  const { data: upcoming, error: swapErr } = await admin
    .from("attendance_week_off_swaps")
    .select("id")
    .eq("org_id", ctx.orgId)
    .eq("user_id", userId)
    .or(`worked_date.gte.${today},off_date.gte.${today}`)
    .limit(1);
  if (swapErr) return { error: isWeekOffPending(swapErr.code) ? WEEK_OFF_PENDING : swapErr.message };
  if (upcoming?.length) {
    return { error: "Delete this employee's upcoming week-off swaps first, then change their weekly off." };
  }

  const { data: current, error: curErr } = await admin
    .from("memberships")
    .select("weekly_off_dow")
    .eq("org_id", ctx.orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (curErr) return { error: isWeekOffPending(curErr.code) ? WEEK_OFF_PENDING : curErr.message };
  if (!current) return { error: "Member not found." };

  // 0049 columns — their own query, so before 0049 a fixed day still saves exactly as before.
  const { data: currentKind, error: kindErr } = await admin
    .from("memberships")
    .select("weekly_off_kind, weekly_off_anchor, is_office")
    .eq("org_id", ctx.orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (kindErr && !isWeekOffPending(kindErr.code)) return { error: kindErr.message };
  const hasKinds = !kindErr;
  if (!hasKinds && kind !== "fixed") return { error: WEEK_OFF_KINDS_PENDING };
  if (kind !== "fixed" && ((currentKind?.is_office as boolean | null | undefined) ?? true)) {
    return { error: "Alternate Sundays and Flexible are for Site staff only — Office staff get a fixed weekly off." };
  }
  const kindFields = (k: WeekOffKind, a: string | null) => (hasKinds ? { kind: k, anchor: a } : {});
  const pendingError = (code: string | undefined, message: string) =>
    isWeekOffPending(code) ? (hasKinds ? WEEK_OFF_KINDS_PENDING : WEEK_OFF_PENDING) : message;

  // Fresh builder per call — a reused one can carry headers (e.g. count) over.
  const history = () => admin.from("attendance_weekly_off_history");
  const { count, error: countErr } = await history()
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (countErr) return { error: isWeekOffPending(countErr.code) ? WEEK_OFF_PENDING : countErr.message };
  if (!count) {
    // First change: pin the old pattern for every past date explicitly.
    const { error: baseErr } = await history().upsert(
      {
        org_id: ctx.orgId,
        user_id: userId,
        dow: (current.weekly_off_dow as number | null) ?? 0,
        effective_from: "2000-01-01",
        created_by: ctx.userId,
        ...kindFields(
          toWeekOffKind(currentKind?.weekly_off_kind),
          (currentKind?.weekly_off_anchor as string | null | undefined) ?? null
        ),
      },
      { onConflict: "user_id,effective_from" }
    );
    if (baseErr) return { error: pendingError(baseErr.code, baseErr.message) };
  }
  // Same-day correction overwrites today's row.
  const { error: histErr } = await history().upsert(
    { org_id: ctx.orgId, user_id: userId, dow, effective_from: today, created_by: ctx.userId, ...kindFields(kind, anchor) },
    { onConflict: "user_id,effective_from" }
  );
  if (histErr) return { error: pendingError(histErr.code, histErr.message) };

  const { data: updated, error } = await admin
    .from("memberships")
    .update({
      weekly_off_dow: dow,
      ...(hasKinds ? { weekly_off_kind: kind, weekly_off_anchor: anchor } : {}),
    })
    .eq("org_id", ctx.orgId)
    .eq("user_id", userId)
    .select("user_id");
  if (error) return { error: pendingError(error.code, error.message) };
  if (!updated?.length) return { error: "Member not found." };
  await logActivity({
    action: "updated",
    entityType: "member",
    entityId: userId,
    summary: `Set weekly off to ${describeWeekOff(kind, dow, anchor)}`,
  });
  return { id: userId };
}

/** Admin-only: set a fixed weekly off day (0 = Sunday … 6 = Saturday). Kept for existing callers. */
export async function setWeeklyOffDayAction(userId: string, dow: number): Promise<ActionResult> {
  return setWeeklyOffPatternAction(userId, { kind: "fixed", dow });
}

/**
 * Admin-only: set a member's password directly. Phone logins use a
 * `<digits>@sitehub.phone` alias that can't receive mail, so the email recovery
 * flow can't reach them — an admin hands over the new password out of band.
 */
export async function resetMemberPasswordAction(
  userId: string,
  password: string
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !isAdminRole(ctx.role)) return { error: "Not authorized." };
  if (!ctx.orgId) return { error: "No organization found." };
  if (password.length < 6) return { error: "Password must be at least 6 characters." };

  const admin = createAdminClient();
  // Scope to the caller's own org — the service-role client bypasses RLS, so
  // this check is the only thing stopping a cross-org reset.
  const { data: member, error: lookupErr } = await admin
    .from("memberships")
    .select("user_id")
    .eq("org_id", ctx.orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (lookupErr) return { error: lookupErr.message };
  if (!member) return { error: "That member isn't in your organization." };

  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return { error: error.message };

  await logActivity({
    action: "updated",
    entityType: "member",
    entityId: userId,
    summary: "Reset account password",
  });
  return { id: userId };
}

/** Admin-only: activate/deactivate a member (cannot deactivate yourself). */
export async function setMemberActiveAction(userId: string, isActive: boolean): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !isAdminRole(ctx.role)) return { error: "Not authorized." };
  if (!ctx.orgId) return { error: "No organization found." };
  if (userId === ctx.userId && !isActive) return { error: "You can't deactivate your own account." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("memberships")
    .update({ is_active: isActive })
    .eq("org_id", ctx.orgId)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  return { id: userId };
}
