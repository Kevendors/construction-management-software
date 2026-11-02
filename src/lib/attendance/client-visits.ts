// Start / End Visit (0052) — helpers shared by server and client.

/** Hard cap on client visits per attendance day. */
export const MAX_CLIENT_VISITS_PER_DAY = 20;
export const MAX_CLIENT_NAME = 120;
export const MAX_VISIT_PURPOSE = 200;

export const VISIT_PURPOSES = ["Client meeting", "Client site visit", "Vendor / supplier meeting"];
export const OTHER_PURPOSE = "Other";

export const CLIENT_VISITS_PENDING_MSG =
  "Client visit log pending: run 0052_attendance_client_visits.sql in Supabase SQL Editor.";

export function formatMeters(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

export function mapsLink(lat: number | null, lng: number | null): string | null {
  if (lat == null || lng == null) return null;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
