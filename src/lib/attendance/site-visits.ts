// Switch Site (0050) — pure helpers shared by server and client.

/** Hard cap on site switches per attendance day. */
export const MAX_SITE_VISITS_PER_DAY = 20;

/**
 * Picker sentinel for "the Office" as a site (Site members with
 * memberships.can_work_from_office). Stored as project_id = null.
 */
export const OFFICE_SITE = "office";
export const OFFICE_SITE_NAME = "Office";

export const SITE_VISITS_PENDING_MSG =
  "Site switching pending: run 0050_attendance_site_visits.sql in Supabase SQL Editor.";

/** PGRST205 (PostgREST: table not in schema cache) / 42P01 (Postgres: undefined table) = 0050 not applied. */
export function isMissingTableError(error: { code?: string | null } | null | undefined): boolean {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

/**
 * The site an open shift is currently at: the project of the latest visit by
 * arrival time, else — with no visits — the attendance row's own project
 * (null/"" = no project, i.e. an office check-in). A null-project visit is
 * the Office when `officeAllowed` (a "Can work from office" member);
 * otherwise it can only be a since-deleted project and is skipped.
 */
export function currentProjectIdFrom(
  visits: { projectId: string | null; arrivedAt: string }[],
  fallbackProjectId: string | null,
  officeAllowed = true
): string | null {
  let best: { projectId: string | null; t: number } | null = null;
  for (const v of visits) {
    if (!v.projectId && !officeAllowed) continue;
    const t = Date.parse(v.arrivedAt);
    if (!Number.isFinite(t)) continue;
    // `>=` so a later entry wins a tie (insertion order).
    if (!best || t >= best.t) best = { projectId: v.projectId || null, t };
  }
  return best ? best.projectId : fallbackProjectId || null;
}

/**
 * Was this open self shift opened with the SITE flow? Decided from the row
 * itself — a site check-in always has a selfie (office punches never do), or
 * a project, or site visits — so unticking "Can work from office" mid-shift
 * can't strand an Office check-in on the office (no-selfie) flow.
 */
export function isSiteFlowShift(
  row: { projectId: string | null; checkInSelfiePath: string | null },
  visitCount: number,
  worksFromOffice: boolean
): boolean {
  return Boolean(row.projectId) || Boolean(row.checkInSelfiePath) || visitCount > 0 || worksFromOffice;
}

/**
 * Spot-check times planned from a mid-shift start (Switch Site from the
 * Office to a project), minus any that would duplicate an already scheduled
 * or pending check of the shift — i.e. fall within `minGapMs` of one.
 */
export function dropDuplicateSpotTimes(planned: string[], existing: string[], minGapMs: number): string[] {
  const taken = existing.map((e) => Date.parse(e)).filter((t) => Number.isFinite(t));
  return planned.filter((p) => {
    const t = Date.parse(p);
    return !taken.some((e) => Math.abs(e - t) < minGapMs);
  });
}
