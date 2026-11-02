import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Punch-out closes the day's open client visit (0052) at the punch-out time
 * and place, flagged auto_closed so its duration isn't read as accurate. Never
 * fails the punch-out: a missing table (0052 not applied) or error is ignored.
 */
export async function closeOpenClientVisit(
  attendanceId: string,
  at: string,
  point: { lat: number; lng: number; accuracy: number; distanceM: number | null }
): Promise<void> {
  try {
    await createAdminClient()
      .from("attendance_client_visits")
      .update({
        ended_at: at,
        end_lat: point.lat,
        end_lng: point.lng,
        end_accuracy: point.accuracy,
        end_distance_m: point.distanceM,
        auto_closed: true,
      })
      .eq("attendance_id", attendanceId)
      .is("ended_at", null);
  } catch {
    // The punch-out itself already succeeded.
  }
}
