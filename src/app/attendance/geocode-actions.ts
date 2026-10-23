"use server";

import { getAuthContext } from "@/lib/auth/context";
import { isSupabaseConfigured } from "@/lib/supabase/config";

// Reverse geocoding (GPS → street address) via OpenStreetMap Nominatim.
// Free, no key — but its usage policy allows ~1 request/second with an
// identifying User-Agent, so lookups are cached per ~11 m cell and any
// uncached ones are spaced out. Volume here is tiny (an admin opening one
// attendance record at a time).

const ENDPOINT = "https://nominatim.openstreetmap.org/reverse";
const USER_AGENT = "SiteHub/1.0 (support@keyvendors.com)";
const SPACING_MS = 1100;
const TIMEOUT_MS = 5000;

// Per-instance cache; addresses for a fixed point don't change.
const cache = new Map<string, string | null>();

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

async function lookup(lat: number, lng: number): Promise<string | null> {
  const url = `${ENDPOINT}?format=jsonv2&zoom=18&lat=${lat}&lon=${lng}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { display_name?: string };
    if (!body.display_name) return null;
    // "…, Delhi, North East Delhi, Delhi, 110095, India" → drop repeats + country.
    const parts = body.display_name.split(", ").filter((p) => p !== "India");
    return Array.from(new Set(parts)).join(", ");
  } catch {
    return null;
  }
}

/** Street address for each point (null when unknown or the lookup failed). */
export async function reverseGeocodeAction(
  points: { lat: number; lng: number }[]
): Promise<(string | null)[]> {
  if (isSupabaseConfigured()) {
    const ctx = await getAuthContext();
    if (!ctx?.orgId) return points.map(() => null);
  }

  const out: (string | null)[] = [];
  let fetched = false;
  for (const p of points.slice(0, 10)) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) {
      out.push(null);
      continue;
    }
    const key = cacheKey(p.lat, p.lng);
    if (!cache.has(key)) {
      if (fetched) await new Promise((r) => setTimeout(r, SPACING_MS));
      const address = await lookup(p.lat, p.lng);
      fetched = true;
      // Don't cache failures, so a transient error gets retried next time.
      if (address) cache.set(key, address);
      out.push(address);
      continue;
    }
    out.push(cache.get(key) ?? null);
  }
  return out;
}
