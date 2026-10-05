import "server-only";

import type { WorkProgressReport } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { getVisibleProjectIds, filterByProjectIds } from "./team";
import { mapWorkProgressReport, type WorkProgressReportRow } from "./mappers";

export interface WorkProgressReportsBoard {
  reports: WorkProgressReport[];
  projects: { id: string; name: string }[];
}

const REPORT_COLS =
  "id, number, project_id, date, period_start, period_end, percent_complete, work_completed, next_plan, issues, photo_urls, signature_url";

/** Lightweight project picker list, scoped the same way every other module is. */
export async function getReportableProjects(): Promise<{ id: string; name: string }[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createSupabase();
  const { data, error } = await supabase.from("projects").select("id, name");
  if (error) throw error;
  const visible = await getVisibleProjectIds();
  const rows = data as { id: string; name: string }[];
  return (visible ? rows.filter((p) => visible.includes(p.id)) : rows).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

export async function getWorkProgressReportsBoard(): Promise<WorkProgressReportsBoard> {
  if (!isSupabaseConfigured()) return { reports: [], projects: [] };
  const supabase = await createSupabase();

  const [reportsRes, projectsRes] = await Promise.all([
    supabase.from("work_progress_reports").select(REPORT_COLS).order("date", { ascending: false }),
    supabase.from("projects").select("id, name"),
  ]);

  // Tolerate 0029 not being applied yet — empty board rather than a hard
  // crash on every page load, same pattern as getPurchaseBillsBoard.
  if (reportsRes.error) {
    if (reportsRes.error.code === "42P01" || reportsRes.error.code === "PGRST205") {
      return { reports: [], projects: [] };
    }
    throw reportsRes.error;
  }
  if (projectsRes.error) throw projectsRes.error;

  const reports = (reportsRes.data as WorkProgressReportRow[]).map(mapWorkProgressReport);
  const visible = await getVisibleProjectIds();
  const scopedReports = filterByProjectIds(reports, visible, (r) => r.projectId);
  const scopedProjects = (visible
    ? (projectsRes.data as { id: string; name: string }[]).filter((p) => visible.includes(p.id))
    : (projectsRes.data as { id: string; name: string }[])
  ).sort((a, b) => a.name.localeCompare(b.name));

  return { reports: scopedReports, projects: scopedProjects };
}
