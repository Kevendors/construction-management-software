"use server";

import { getAuthContext } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminRole } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { logActivity } from "@/lib/activity/log";
import { roleLabel } from "@/lib/labels";
import type { Role } from "@/lib/types";
import type { ActionResult } from "@/app/team/actions";

/** Super-admin only: assign an org member (any role) to a project. */
export async function addProjectMemberAction(
  projectId: string,
  userId: string,
  role: Role
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { error: "Not available in demo mode." };
  const ctx = await getAuthContext();
  if (!ctx || !isAdminRole(ctx.role)) return { error: "Not authorized." };
  if (!ctx.orgId) return { error: "No organization found." };

  const admin = createAdminClient();

  // Only users who already belong to this org can be put on a project,
  // and only onto a project that belongs to this org.
  const [{ data: membership, error: mErr }, { data: project, error: pErr }] = await Promise.all([
    admin
      .from("memberships")
      .select("user_id")
      .eq("org_id", ctx.orgId)
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("projects")
      .select("id")
      .eq("org_id", ctx.orgId)
      .eq("id", projectId)
      .maybeSingle(),
  ]);
  if (mErr) return { error: mErr.message };
  if (!membership) return { error: "That user is not a member of this organization." };
  if (pErr) return { error: pErr.message };
  if (!project) return { error: "Project not found in this organization." };

  const { data, error } = await admin
    .from("project_members")
    .upsert(
      { org_id: ctx.orgId, project_id: projectId, user_id: userId, role },
      { onConflict: "project_id,user_id" }
    )
    .select("id")
    .single();
  if (error) return { error: error.message };

  await logActivity({
    action: "created",
    entityType: "project_member",
    entityId: data.id,
    summary: `Assigned ${roleLabel[role] ?? role} to project`,
    meta: { projectId, userId, role },
  });
  return { id: data.id };
}

/** Super-admin only: change a member's role on a project. */
export async function setProjectMemberRoleAction(
  projectId: string,
  userId: string,
  role: Role
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { error: "Not available in demo mode." };
  const ctx = await getAuthContext();
  if (!ctx || !isAdminRole(ctx.role)) return { error: "Not authorized." };
  if (!ctx.orgId) return { error: "No organization found." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("project_members")
    .update({ role })
    .eq("org_id", ctx.orgId)
    .eq("project_id", projectId)
    .eq("user_id", userId);
  if (error) return { error: error.message };

  await logActivity({
    action: "updated",
    entityType: "project_member",
    entityId: userId,
    summary: `Changed project role to ${roleLabel[role] ?? role}`,
    meta: { projectId, userId, role },
  });
  return { id: userId };
}

/** Super-admin only: remove a member from a project. */
export async function removeProjectMemberAction(
  projectId: string,
  userId: string
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { error: "Not available in demo mode." };
  const ctx = await getAuthContext();
  if (!ctx || !isAdminRole(ctx.role)) return { error: "Not authorized." };
  if (!ctx.orgId) return { error: "No organization found." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("project_members")
    .delete()
    .eq("org_id", ctx.orgId)
    .eq("project_id", projectId)
    .eq("user_id", userId);
  if (error) return { error: error.message };

  await logActivity({
    action: "deleted",
    entityType: "project_member",
    entityId: userId,
    summary: "Removed a member from the project",
    meta: { projectId, userId },
  });
  return { id: userId };
}
