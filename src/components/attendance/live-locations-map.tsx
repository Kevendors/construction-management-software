"use client";

import * as React from "react";
import "leaflet/dist/leaflet.css";
import { RadioTower, Users } from "lucide-react";
import { getLiveLocationsAction, type LiveLocation } from "@/app/attendance/actions";

const POLL_MS = 20_000;
/** A ping older than this reads as "gone quiet" rather than a normal gap between pings. */
const STALE_MS = 5 * 60_000;

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

/**
 * Super_admin/hr-only live map: polls getLiveLocationsAction() and plots a
 * marker per currently checked-in staff member at their last known ping.
 * Honest about staleness — a pin that's gone quiet (tab closed/backgrounded,
 * see use-live-tracking.ts) is visibly marked, not shown as if still live.
 */
export function LiveLocationsMap() {
  const [locations, setLocations] = React.useState<LiveLocation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const mapRef = React.useRef<HTMLDivElement>(null);
  const leafletMapRef = React.useRef<import("leaflet").Map | null>(null);
  const markersRef = React.useRef<Map<string, import("leaflet").Marker>>(new Map());

  const load = React.useCallback(async () => {
    const data = await getLiveLocationsAction();
    setLocations(data);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  // Init the map once.
  React.useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !mapRef.current || leafletMapRef.current) return;
      const map = L.map(mapRef.current).setView([20.5937, 78.9629], 5); // India-wide default
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);
      leafletMapRef.current = map;
    });
    return () => {
      cancelled = true;
      leafletMapRef.current?.remove();
      leafletMapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  // Sync markers whenever locations update.
  React.useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;
    import("leaflet").then((L) => {
      const seen = new Set<string>();
      const withPing = locations.filter((l) => l.lastPing);
      for (const loc of withPing) {
        const ping = loc.lastPing!;
        seen.add(loc.attendanceId);
        const stale = Date.now() - new Date(ping.recordedAt).getTime() > STALE_MS;
        const color = stale ? "#94a3b8" : "#16a34a";
        const icon = L.divIcon({
          className: "",
          html: `<div style="background:${color};color:white;border-radius:9999px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)">${loc.userName.slice(0, 1).toUpperCase()}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        const popupHtml = `<div style="font-size:12px"><b>${loc.userName}</b><br/>${loc.projectName ?? "Office"}<br/>${timeAgo(ping.recordedAt)}${
          loc.distanceFromSiteM != null ? ` · ${loc.distanceFromSiteM}m from site` : ""
        }</div>`;
        const existing = markersRef.current.get(loc.attendanceId);
        if (existing) {
          existing.setLatLng([ping.lat, ping.lng]);
          existing.setIcon(icon);
          existing.setPopupContent(popupHtml);
        } else {
          const marker = L.marker([ping.lat, ping.lng], { icon }).addTo(map).bindPopup(popupHtml);
          markersRef.current.set(loc.attendanceId, marker);
        }
      }
      // Remove markers for anyone no longer checked in.
      for (const [id, marker] of markersRef.current) {
        if (!seen.has(id)) {
          marker.remove();
          markersRef.current.delete(id);
        }
      }
      // Fit the view the first time we have markers.
      if (withPing.length > 0 && markersRef.current.size === withPing.length) {
        const bounds = L.latLngBounds(withPing.map((l) => [l.lastPing!.lat, l.lastPing!.lng] as [number, number]));
        map.fitBounds(bounds.pad(0.3), { maxZoom: 16 });
      }
    });
  }, [locations]);

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
        Shows staff currently checked in with location sharing active. Updates every 20 seconds. A grey pin means
        their phone has gone quiet (app closed or backgrounded) — not that they've left site.
      </div>

      <div ref={mapRef} className="h-[420px] w-full overflow-hidden rounded-lg border border-border" />

      {!loading && locations.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          <Users className="h-6 w-6" />
          No one is currently checked in with location sharing active.
        </div>
      )}

      {locations.length > 0 && (
        <div className="divide-y divide-border rounded-md border border-border">
          {locations.map((loc) => {
            const stale = loc.lastPing ? Date.now() - new Date(loc.lastPing.recordedAt).getTime() > STALE_MS : true;
            return (
              <div key={loc.attendanceId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {loc.userName}
                    {loc.employeeId ? ` · ${loc.employeeId}` : ""}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{loc.projectName ?? "Office"}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs">
                  {loc.distanceFromSiteM != null && (
                    <span className="text-muted-foreground">{loc.distanceFromSiteM}m from site</span>
                  )}
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
                      !loc.lastPing
                        ? "bg-muted text-muted-foreground"
                        : stale
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                        : "bg-success/15 text-success"
                    }`}
                  >
                    <RadioTower className="h-3 w-3" />
                    {loc.lastPing ? timeAgo(loc.lastPing.recordedAt) : "No ping yet"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
