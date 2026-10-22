"use client";

import * as React from "react";
import { recordLocationPingAction } from "@/app/attendance/actions";

export type TrackingStatus = "off" | "active" | "paused" | "error";

const PING_INTERVAL_MS = 60_000;

/**
 * Sends a GPS ping to the server roughly once a minute while `enabled` (an
 * active, self-checked-in shift today) AND this page is open and visible.
 *
 * This is deliberately NOT background tracking -- iOS and Android both
 * freeze a website's JavaScript the moment the screen locks or the person
 * switches apps, so no website can keep pinging through that. Rather than
 * silently going dark and leaving management to wonder why, this pauses
 * itself the instant the tab is hidden and reports that honestly via
 * `status`, resuming automatically the moment the page is visible again.
 */
export function useLiveTracking(enabled: boolean): { status: TrackingStatus; lastError: string } {
  const [status, setStatus] = React.useState<TrackingStatus>("off");
  const [lastError, setLastError] = React.useState("");

  React.useEffect(() => {
    if (!enabled) {
      setStatus("off");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("error");
      setLastError("This device does not support location.");
      return;
    }

    let cancelled = false;

    function ping() {
      if (document.visibilityState !== "visible") {
        setStatus("paused");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const res = await recordLocationPingAction({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
          });
          if (cancelled) return;
          if (res.ok) {
            setStatus("active");
            setLastError("");
          } else {
            setStatus("error");
            setLastError(res.error ?? "Could not send a location update.");
          }
        },
        (err) => {
          if (cancelled) return;
          setStatus("error");
          setLastError(err.message || "Could not read your location.");
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 15000 }
      );
    }

    ping();
    const timer = setInterval(ping, PING_INTERVAL_MS);

    function onVisibility() {
      if (document.visibilityState === "visible") ping();
      else setStatus("paused");
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);

  return { status, lastError };
}
