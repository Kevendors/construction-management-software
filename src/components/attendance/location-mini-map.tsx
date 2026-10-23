"use client";

import * as React from "react";
import "leaflet/dist/leaflet.css";

export interface MiniMapPin {
  lat: number;
  lng: number;
  label: string;
  color: string;
}

/** Small embedded map with labelled pins (e.g. check-in / check-out spots). */
export function LocationMiniMap({ pins, className = "h-40" }: { pins: MiniMapPin[]; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const pinsKey = pins.map((p) => `${p.lat},${p.lng},${p.label}`).join("|");

  React.useEffect(() => {
    if (!pins.length) return;
    let cancelled = false;
    let map: import("leaflet").Map | null = null;
    import("leaflet").then((L) => {
      if (cancelled || !ref.current) return;
      map = L.map(ref.current, { scrollWheelZoom: false, attributionControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);
      for (const p of pins) {
        const icon = L.divIcon({
          className: "",
          html: `<div style="position:relative;width:30px;height:40px"><div style="position:absolute;left:3px;top:0;width:24px;height:24px;background:${p.color};border:2px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 1px 4px rgba(0,0,0,.45)"></div><div style="position:absolute;left:0;top:4px;width:30px;text-align:center;color:white;font-size:9px;font-weight:700">${p.label}</div></div>`,
          iconSize: [30, 40],
          iconAnchor: [15, 34],
        });
        L.marker([p.lat, p.lng], { icon }).addTo(map);
      }
      if (pins.length === 1) {
        map.setView([pins[0].lat, pins[0].lng], 17);
      } else {
        map.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number])).pad(0.4), { maxZoom: 17 });
      }
      // The dialog may still be animating in; re-measure once it has settled.
      setTimeout(() => map?.invalidateSize(), 200);
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
    // pinsKey captures every field of `pins` that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinsKey]);

  if (!pins.length) return null;
  return <div ref={ref} className={`z-0 w-full overflow-hidden rounded-md border border-border ${className}`} />;
}
