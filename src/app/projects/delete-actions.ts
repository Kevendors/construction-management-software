"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth/context";
import { isAdminRole } from "@/lib/auth/permissions";
import { logActivity } from "@/lib/activity/log";

export interface ActionResult {
  error?: string;
}

/**
 * Permanently delete a project and everything hard-linked to it — tasks,
 * Daily Progress Reports, site instructions, files, drawings, BOQ, and the
 * project's team roster all cascade-delete with it (see migration 0001).
 * Financial records (expenses, invoices, purchase orders, labour attendance,
 * etc.) are kept, just unlinked from any project. Super Admin only — there's
 * no undo.
 */
export async function deleteProjectAction(projectId: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !isAdminRole(ctx.role)) return { error: "Only a Super Admin can delete a project." };

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("code, name")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { error: "Project not found." };

  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) return { error: error.message };

  await logActivity({
    action: "deleted",
    entityType: "project",
    entityId: projectId,
    summary: `Deleted project ${project.code} "${project.name}" and all its tasks, DPRs, files, drawings, and BOQ`,
  });
  return {};
}
