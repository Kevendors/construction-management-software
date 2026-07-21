"use server";

import { getAuthContext } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminRole } from "@/lib/auth/permissions";
import { logActivity } from "@/lib/activity/log";
import { roleLabel } from "@/lib/labels";
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

  let employeeId = await computeNextEmployeeId(admin, ctx.orgId);
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
