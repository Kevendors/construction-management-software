// Client-safe pure helpers for random location spot-checks (migration 0045).
// No I/O — scheduling/judging rules only, so they're easy to reason about.

import {
  haversineMeters,
  ORG_TIMEZONE,
  ORG_UTC_OFFSET,
  SHIFT_END_TIME,
} from "@/lib/attendance/compute";

const MIN = 60_000;

/** One random check inside each block of this many minutes. */
export const SPOT_CHECK_BLOCK_MIN = 120;
/** Minutes the employee has to confirm once the notification goes out. */
export const SPOT_CHECK_WINDOW_MIN = 15;
/** Slack for the 5-minute cron cadence when spacing checks apart. */
export const SPOT_CHECK_CRON_LAG_MIN = 5;
/** No check in the first minutes after punching in. */
export const SPOT_CHECK_FIRST_DELAY_MIN = 20;
/** A trailing block shorter than this is dropped. */
export const SPOT_CHECK_MIN_BLOCK_MIN = 30;
/** Max GPS-accuracy slack added to the fence radius, so a bad fix can't pass by itself. */
export const SPOT_CHECK_GPS_SLACK_CAP_M = 100;

export interface SpotCheckFence {
  lat: number | null;
  lng: number | null;
  radiusM: number | null;
}

function orgDateOf(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ORG_TIMEZONE }).format(new Date(iso));
}

/**
 * Random check times (ISO) for a site shift: one per 2-hour block between
 * check-in + 20 min and SHIFT_END_TIME − 15 min (so every response window
 * ends inside the shift). Empty when that window is under 30 minutes.
 */
export function planSpotChecks(checkInAtIso: string, rand: () => number = Math.random): string[] {
  const start = new Date(checkInAtIso).getTime() + SPOT_CHECK_FIRST_DELAY_MIN * MIN;
  const shiftEnd = new Date(`${orgDateOf(checkInAtIso)}T${SHIFT_END_TIME}:00${ORG_UTC_OFFSET}`).getTime();
  const end = shiftEnd - SPOT_CHECK_WINDOW_MIN * MIN;
  const times: string[] = [];
  for (let b = start; end - b >= SPOT_CHECK_MIN_BLOCK_MIN * MIN; b += SPOT_CHECK_BLOCK_MIN * MIN) {
    const blockEnd = Math.min(b + SPOT_CHECK_BLOCK_MIN * MIN, end);
    // Sample early enough that the response window (+ cron lag) closes before
    // the next block starts, so two checks are never open at once.
    const latest = blockEnd - (SPOT_CHECK_WINDOW_MIN + SPOT_CHECK_CRON_LAG_MIN) * MIN;
    times.push(new Date(b + rand() * (latest - b)).toISOString());
  }
  return times;
}

/** on_site / off_site against the project fence; "confirmed" when no fence is set. */
export function judgeSpotCheck(
  pos: { lat: number; lng: number; accuracy: number },
  fence: SpotCheckFence | null
): { status: "on_site" | "off_site" | "confirmed"; distanceM: number | null } {
  if (!fence || fence.lat == null || fence.lng == null || !fence.radiusM) {
    return { status: "confirmed", distanceM: null };
  }
  const distanceM = haversineMeters(pos.lat, pos.lng, fence.lat, fence.lng);
  const slack = Math.min(Math.max(pos.accuracy, 0), SPOT_CHECK_GPS_SLACK_CAP_M);
  return { status: distanceM <= fence.radiusM + slack ? "on_site" : "off_site", distanceM };
}

/** Epoch ms when a fired check stops accepting a response. */
export function spotCheckDeadline(notifiedAtIso: string): number {
  return new Date(notifiedAtIso).getTime() + SPOT_CHECK_WINDOW_MIN * MIN;
}

export function isValidPosition(lat: number, lng: number, accuracy: number): boolean {
  return (
    Number.isFinite(lat) && Math.abs(lat) <= 90 &&
    Number.isFinite(lng) && Math.abs(lng) <= 180 &&
    Number.isFinite(accuracy) && accuracy >= 0
  );
}
