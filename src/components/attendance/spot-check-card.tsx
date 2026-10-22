"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/attendance/compute";
import { spotCheckDeadline } from "@/lib/attendance/spot-checks";
import { confirmSpotCheckAction } from "@/app/attendance/spot-check-actions";
import type { SpotCheck, SpotCheckStatus } from "@/lib/types";
import { geoErrorMessage } from "./use-geolocation";

function readPosition(): Promise<{ lat: number; lng: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("This device does not support location."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        }),
      (err) => reject(new Error(geoErrorMessage(err))),
      // maximumAge 0: a spot-check must be a fresh fix, not a cached one.
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

/**
 * Random location spot-check (0045): shown on My Attendance while a fired
 * check is open. One tap reads a fresh GPS fix and confirms it.
 */
export function SpotCheckCard({ check }: { check: SpotCheck }) {
  const deadline = spotCheckDeadline(check.notifiedAt);
  const [now, setNow] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [result, setResult] = React.useState<{ status: SpotCheckStatus; distanceM: number | null } | null>(null);

  React.useEffect(() => {
    // Start the clock after mount so server and client render the same HTML.
    const t = setInterval(() => setNow(Date.now()), 1000);
    const first = setTimeout(() => setNow(Date.now()), 0);
    return () => {
      clearInterval(t);
      clearTimeout(first);
    };
  }, []);

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      const pos = await readPosition();
      const res = await confirmSpotCheckAction(check.id, pos);
      if (res.error) setError(res.error);
      else if (res.status) setResult({ status: res.status, distanceM: res.distanceM ?? null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read your location.");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const off = result.status === "off_site";
    return (
      <div
        className={`flex items-start gap-2 rounded-lg border p-4 text-sm ${
          off ? "border-warning/40 bg-warning/10" : "border-success/40 bg-success/10"
        }`}
      >
        {off ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        )}
        <p>
          {off
            ? `Location recorded — you're about ${formatDistance(result.distanceM ?? 0)} from the site.`
            : result.status === "on_site"
            ? "Location confirmed — you're on site. Thanks!"
            : "Location confirmed. Thanks!"}
        </p>
      </div>
    );
  }

  const remaining = now === null ? null : Math.max(0, deadline - now);
  if (remaining === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        This location check has expired.
      </div>
    );
  }
  const mm = remaining === null ? 0 : Math.floor(remaining / 60000);
  const ss = remaining === null ? "" : String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");

  return (
    <div className="space-y-3 rounded-lg border-2 border-primary bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <p className="font-semibold">Location check</p>
          <p className="text-sm text-muted-foreground">
            Confirm you&apos;re on site by {formatTime(new Date(deadline).toISOString())}
            {remaining !== null && (
              <>
                {" "}·{" "}
                <span className="tabular-nums">
                  {mm}:{ss}
                </span>{" "}
                left
              </>
            )}
          </p>
        </div>
      </div>
      <Button size="lg" className="w-full" onClick={confirm} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
        {busy ? "Getting location…" : "Confirm Location"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
