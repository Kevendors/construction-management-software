"use server";

import { getAuthContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { logActivity } from "@/lib/activity/log";
import { projectStatusMeta } from "@/lib/labels";
import type { ProjectStatus } from "@/lib/types";

export interface ActionResult {
  id?: string;
  error?: string;
}

const STATUSES: ProjectStatus[] = ["planning", "ongoing", "on_hold", "completed"];

/**
 * Move a project through its lifecycle. Until now `status` was set once in the
 * New Project dialog and could never be changed again.
 *
 * Uses the cookie-wired client rather than the service-role one: the 0002
 * write policy for the 'site' group already limits project updates to
 * super_admin / pm / supervisor, so RLS is the real gate here and there's no
 * reason to bypass it. The explicit role check exists only to return a
 * readable message instead of a silent no-op.
 */
export async function updateProjectStatusAction(
  projectId: string,
  status: ProjectStatus
): Promise<ActionResult> {
  // Mock mode: the client store applies the change locally.
  if (!isSupabaseConfigured()) return { id: projectId };

  if (!STATUSES.includes(status)) return { error: "Unknown project status." };

  const ctx = await getAuthContext();
  if (!ctx) return { error: "You must be signed in." };
  if (!ctx.role || !["super_admin", "pm", "supervisor"].includes(ctx.role)) {
    return { error: "Your role can't change a project's status." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .update({ status })
    .eq("id", projectId)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  // No row back means RLS refused the update (or the project is gone).
  if (!data) return { error: "That project couldn't be updated." };

  await logActivity({
    action: "updated",
    entityType: "project",
    entityId: projectId,
    summary: `Marked the project ${projectStatusMeta[status]?.label ?? status}`,
  });
  return { id: projectId };
}
