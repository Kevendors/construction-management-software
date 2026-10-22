import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { planSpotChecks } from "@/lib/attendance/spot-checks";

const TABLE = "attendance_spot_checks";

/**
 * Schedule a site shift's random location checks (0045). Best-effort: a
 * failure is logged and never blocks the check-in. Uses the service-role
 * client — the table has no insert policy by design.
 */
export async function scheduleSpotChecks(input: {
  orgId: string;
  userId: string;
  attendanceId: string;
  projectId: string;
  checkInAt: string;
}): Promise<void> {
  const times = planSpotChecks(input.checkInAt);
  if (times.length === 0) return;
  try {
    const { error } = await createAdminClient()
      .from(TABLE)
      .insert(
        times.map((t) => ({
          org_id: input.orgId,
          attendance_id: input.attendanceId,
          user_id: input.userId,
          project_id: input.projectId,
          scheduled_at: t,
          status: "scheduled",
        }))
      );
    // PGRST205 = table not there yet (0045 not applied) — skip silently.
    if (error && error.code !== "PGRST205") console.error("[spot-checks] schedule failed", error.message);
  } catch (err) {
    console.error("[spot-checks] schedule failed", err instanceof Error ? err.message : err);
  }
}

/** Punch-out: drop every check of this shift that hasn't been answered. */
export async function cancelSpotChecks(attendanceId: string): Promise<void> {
  try {
    const { error } = await createAdminClient()
      .from(TABLE)
      .update({ status: "cancelled" })
      .eq("attendance_id", attendanceId)
      .in("status", ["scheduled", "pending"]);
    if (error && error.code !== "PGRST205") console.error("[spot-checks] cancel failed", error.message);
  } catch (err) {
    console.error("[spot-checks] cancel failed", err instanceof Error ? err.message : err);
  }
}
