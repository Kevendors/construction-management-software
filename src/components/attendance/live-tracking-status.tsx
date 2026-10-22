"use client";

import { MapPin, MapPinOff, PauseCircle, AlertTriangle } from "lucide-react";
import type { TrackingStatus } from "./use-live-tracking";

const META: Record<TrackingStatus, { icon: typeof MapPin; label: string; className: string }> = {
  off: { icon: MapPinOff, label: "Location tracking off", className: "bg-muted text-muted-foreground" },
  active: { icon: MapPin, label: "Location tracking active", className: "bg-success/15 text-success" },
  paused: {
    icon: PauseCircle,
    label: "Paused — reopen this page to resume",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  error: { icon: AlertTriangle, label: "Location updates failed", className: "bg-destructive/15 text-destructive" },
};

/**
 * Shown on My Attendance while an employee is checked in. Explains plainly
 * what's tracked and when it stops — required notice per the live-tracking
 * feature, not just a status badge.
 */
export function LiveTrackingStatus({ status, lastError }: { status: TrackingStatus; lastError: string }) {
  if (status === "off") return null;
  const { icon: Icon, label, className } = META[status];

  return (
    <div className="flex items-start gap-2 rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-xs">
      <span className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${className}`}>
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <span className="text-muted-foreground">
        Your location is shared with Super Admin/HR only while you're checked in, so they can confirm you're at
        your assigned site. It stops automatically the moment you check out, and pauses whenever this page isn't
        open on screen.
        {status === "error" && lastError ? ` (${lastError})` : ""}
      </span>
    </div>
  );
}
