"use client";

import * as React from "react";

export interface GeoResult {
  lat: number;
  lng: number;
  accuracy: number;
}

export type GeoStatus = "idle" | "locating" | "success" | "error";

export interface GeolocationState {
  status: GeoStatus;
  position: GeoResult | null;
  error: string;
  request: () => void;
}

const GEO_TIMEOUT_MS = 15000;

function geoErrorMessage(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return "Location access is blocked. Allow location for this site in your browser settings and retry.";
    case err.POSITION_UNAVAILABLE:
      return "Could not determine your location. Move to open sky and retry.";
    case err.TIMEOUT:
      return "Locating timed out. Check your GPS signal and retry.";
    default:
      return "Could not read your location.";
  }
}

/** One-shot high-accuracy GPS fix (call `request()` to start / retry). */
export function useGeolocation(): GeolocationState {
  const [status, setStatus] = React.useState<GeoStatus>("idle");
  const [position, setPosition] = React.useState<GeoResult | null>(null);
  const [error, setError] = React.useState("");

  const request = React.useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("error");
      setError("This device does not support location.");
      return;
    }
    setStatus("locating");
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        });
        setStatus("success");
      },
      (err) => {
        setStatus("error");
        setError(geoErrorMessage(err));
      },
      { enableHighAccuracy: true, timeout: GEO_TIMEOUT_MS, maximumAge: 30000 }
    );
  }, []);

  return { status, position, error, request };
}
