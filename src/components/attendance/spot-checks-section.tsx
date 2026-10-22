"use client";

import * as React from "react";
import { ExternalLink, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/attendance/compute";
import { excuseSpotCheckAction, getSpotChecksAction } from "@/app/attendance/spot-check-actions";
import type { SpotCheck, SpotCheckStatus } from "@/lib/types";

const STATUS: Partial<Record<SpotCheckStatus, { label: string; variant: "success" | "warning" | "destructive" | "muted" | "outline" }>> = {
  pending: { label: "Waiting", variant: "outline" },
  on_site: { label: "On site", variant: "success" },
  confirmed: { label: "Confirmed", variant: "success" },
  off_site: { label: "Off site", variant: "warning" },
  missed: { label: "Missed", variant: "destructive" },
  excused: { label: "Excused", variant: "muted" },
};

/** Random location spot-checks (0045) for one shift, inside the record dialog. */
export function SpotChecksSection({ attendanceId, canExcuse }: { attendanceId: string; canExcuse: boolean }) {
  const [checks, setChecks] = React.useState<SpotCheck[]>([]);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    getSpotChecksAction(attendanceId).then(setChecks);
  }, [attendanceId]);

  async function excuse(id: string) {
    const note = window.prompt("Reason for excusing (optional), e.g. no signal at site:") ?? null;
    if (note === null) return;
    setBusyId(id);
    setError("");
    const res = await excuseSpotCheckAction(id, note);
    setBusyId(null);
    if (res.error) setError(res.error);
    else setChecks((prev) => prev.map((c) => (c.id === id ? { ...c, status: "excused", excuseNote: note.trim() } : c)));
  }

  if (checks.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <MapPin className="h-3.5 w-3.5" /> Location Spot-Checks
      </p>
      <div className="divide-y divide-border rounded-lg border border-border">
        {checks.map((c) => {
          const meta = STATUS[c.status];
          return (
            <div key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <span className="w-16 tabular-nums">{formatTime(c.notifiedAt)}</span>
              {meta && <Badge variant={meta.variant}>{meta.label}</Badge>}
              {c.distanceM != null && c.status === "off_site" && (
                <span className="text-xs text-muted-foreground">
                  {c.distanceM >= 1000 ? `${(c.distanceM / 1000).toFixed(1)} km` : `${c.distanceM} m`} away
                </span>
              )}
              {c.status === "missed" && c.wasNotified === false && (
                <span className="text-xs text-muted-foreground">notifications off</span>
              )}
              {c.status === "excused" && c.excuseNote && (
                <span className="text-xs text-muted-foreground">{c.excuseNote}</span>
              )}
              <span className="ml-auto flex items-center gap-2">
                {c.lat != null && c.lng != null && (
                  <a
                    href={`https://maps.google.com/?q=${c.lat},${c.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Map
                  </a>
                )}
                {canExcuse && c.status === "missed" && (
                  <Button size="sm" variant="outline" disabled={busyId === c.id} onClick={() => excuse(c.id)}>
                    Excuse
                  </Button>
                )}
              </span>
            </div>
          );
        })}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
