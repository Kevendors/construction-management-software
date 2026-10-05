"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth/context";

async function currentOrgId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  return (data?.org_id as string | undefined) ?? null;
}

export interface WorkProgressReportState {
  number: string;
  projectId: string;
  date: string;
  periodStart: string;
  periodEnd: string;
  percentComplete: number;
  workCompleted: string;
  nextPlan: string;
  issues: string;
  photoUrls: string[];
  signatureUrl: string;
}

export interface SaveResult {
  id?: string;
  error?: string;
}

/**
 * Persist a Work Progress Report (full state in payload + structured columns,
 * same pattern as quotations/invoices). Pass `existingId` to update in place.
 */
export async function saveWorkProgressReportAction(
  state: WorkProgressReportState,
  existingId?: string | null
): Promise<SaveResult> {
  const supabase = await createClient();
  const orgId = await currentOrgId(supabase);
  if (!orgId) return { error: "You must be signed in to save." };
  if (!state.projectId) return { error: "Choose a project first." };

  const fields = {
    number: state.number || "—",
    project_id: state.projectId,
    date: state.date,
    period_start: state.periodStart || null,
    period_end: state.periodEnd || null,
    percent_complete: state.percentComplete || 0,
    work_completed: state.workCompleted || null,
    next_plan: state.nextPlan || null,
    issues: state.issues || null,
    photo_urls: state.photoUrls,
    signature_url: state.signatureUrl || null,
    payload: state,
  };

  if (existingId) {
    const { data, error } = await supabase
      .from("work_progress_reports")
      .update(fields)
      .eq("id", existingId)
      .select("id")
      .maybeSingle();
    if (error) return { error: error.message };
    if (!data) return { error: "That report no longer exists, or you can't edit it." };
    return { id: data.id as string };
  }

  const { data, error } = await supabase
    .from("work_progress_reports")
    .insert({ org_id: orgId, ...fields })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { id: data.id as string };
}

/** Load a saved report's full builder state for re-opening / editing. */
export async function getWorkProgressReportPayloadAction(id: string): Promise<WorkProgressReportState | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("work_progress_reports").select("payload").eq("id", id).maybeSingle();
  return (data?.payload as WorkProgressReportState | undefined) ?? null;
}

/** Super-admin/pm/supervisor only (RLS-enforced) — permanently delete a report. */
export async function deleteWorkProgressReportAction(id: string): Promise<SaveResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: "You must be signed in." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("work_progress_reports")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "That report no longer exists, or you can't delete it." };
  return { id };
}
