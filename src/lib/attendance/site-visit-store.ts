import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { currentProjectIdFrom } from "@/lib/attendance/site-visits";

const TABLE = "attendance_site_visits";

type VisitRow = { attendance_id: string; project_id: string | null; arrived_at: string };

/**
 * Where an open shift is now (0050). `projectId` null + `atOffice` = the
 * Office (a "Can work from office" member's office check-in or Office visit);
 * `projectId` null without `atOffice` = no known site (no fence, like before).
 */
export interface CurrentSite {
  projectId: string | null;
  atOffice: boolean;
}

/**
 * Site members ticked "Can work from office" (and not Office staff), among
 * `userIds`. Missing column (0050 not applied) or any error = nobody.
 */
export async function workFromOfficeUserIds(orgId: string, userIds: string[]): Promise<Set<string>> {
  const ids = Array.from(new Set(userIds));
  if (!ids.length) return new Set();
  try {
    const { data, error } = await createAdminClient()
      .from("memberships")
      .select("user_id, can_work_from_office, is_office")
      .eq("org_id", orgId)
      .in("user_id", ids);
    if (error) return new Set();
    return new Set(
      ((data ?? []) as { user_id: string; can_work_from_office: boolean | null; is_office: boolean | null }[])
        .filter((m) => m.can_work_from_office === true && m.is_office !== true)
        .map((m) => m.user_id)
    );
  } catch {
    return new Set();
  }
}

/**
 * Current site of one shift: latest visit, else `row.projectId` (the
 * attendance row's project). A null-project visit means the Office only for
 * a "Can work from office" member; otherwise (e.g. a since-deleted project)
 * it is skipped. Any error — incl. the table not existing yet — means "no
 * visits". Service role: callers have already verified the attendance row
 * belongs to the org/user they act for.
 */
export async function currentSiteFor(
  orgId: string,
  row: { id: string; projectId: string | null; userId: string }
): Promise<CurrentSite> {
  const map = await currentSitesFor(orgId, [row]);
  return map.get(row.id) ?? { projectId: row.projectId || null, atOffice: false };
}

/** Batch form of currentSiteFor, keyed by attendance id (every row present). */
export async function currentSitesFor(
  orgId: string,
  rows: { id: string; projectId: string | null; userId: string }[]
): Promise<Map<string, CurrentSite>> {
  const out = new Map<string, CurrentSite>();
  if (rows.length === 0) return out;
  const hybrid = await workFromOfficeUserIds(orgId, rows.map((r) => r.userId));
  const byAttendance = new Map<string, { projectId: string | null; arrivedAt: string }[]>();
  try {
    const { data, error } = await createAdminClient()
      .from(TABLE)
      .select("attendance_id, project_id, arrived_at")
      .in("attendance_id", rows.map((r) => r.id));
    if (!error) {
      for (const v of (data ?? []) as VisitRow[]) {
        const list = byAttendance.get(v.attendance_id) ?? [];
        list.push({ projectId: v.project_id, arrivedAt: v.arrived_at });
        byAttendance.set(v.attendance_id, list);
      }
    }
  } catch {
    // Best-effort: fall back to each row's own project.
  }
  for (const r of rows) {
    const officeAllowed = hybrid.has(r.userId);
    const projectId = currentProjectIdFrom(byAttendance.get(r.id) ?? [], r.projectId || null, officeAllowed);
    out.set(r.id, { projectId, atOffice: !projectId && officeAllowed });
  }
  return out;
}
