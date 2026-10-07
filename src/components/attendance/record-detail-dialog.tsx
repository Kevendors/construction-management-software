"use client";

import * as React from "react";
import { AlertCircle, ExternalLink, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import {
  formatDuration,
  formatTime,
  type EvaluatedAttendanceRecord,
} from "@/lib/attendance/compute";
import { getAttendanceSelfieUrls } from "@/app/attendance/actions";
import type { EmployeeAttendance } from "@/lib/types";

function mapsLink(lat: number | null, lng: number | null): string | null {
  if (lat == null || lng == null) return null;
  return `https://maps.google.com/?q=${lat},${lng}`;
}

/**
 * In/out details for one attendance day, incl. selfies (signed URLs fetched
 * on open), GPS map links, and late arrival / half day policy credit.
 */
export function RecordDetailDialog({
  record,
  evaluated,
  onClose,
  showName = false,
}: {
  record: EmployeeAttendance | null;
  evaluated?: EvaluatedAttendanceRecord | null;
  onClose: () => void;
  showName?: boolean;
}) {
  const [selfies, setSelfies] = React.useState<{ in?: string; out?: string }>({});

  React.useEffect(() => {
    if (!record) return;
    setSelfies({});
    getAttendanceSelfieUrls([record.id]).then((urls) => setSelfies(urls[record.id] ?? {}));
  }, [record]);

  if (!record) return null;

  const dateLabel = new Date(`${record.date}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const sides: {
    key: "in" | "out";
    label: string;
    at: string;
    lat: number | null;
    lng: number | null;
  }[] = [
    { key: "in", label: "Check In", at: record.checkInAt, lat: record.checkInLat, lng: record.checkInLng },
    { key: "out", label: "Check Out", at: record.checkOutAt, lat: record.checkOutLat, lng: record.checkOutLng },
  ];

  return (
    <Dialog
      open
      onClose={onClose}
      title={showName ? record.userName : "Attendance Details"}
      description={`${showName && record.employeeId ? `${record.employeeId} · ` : ""}${dateLabel}`}
      className="max-w-md"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {evaluated?.creditType === "on_time" || !evaluated ? (
            <Badge variant="success">Present (1.0d)</Badge>
          ) : evaluated.creditType === "late_grace" ? (
            <Badge variant="warning">{evaluated.badgeLabel} (1.0d)</Badge>
          ) : evaluated.creditType === "late_half_day" || evaluated.creditType === "late_cutoff_half_day" ? (
            <Badge variant="warning" className="border-amber-400 bg-amber-500/15 text-amber-800 dark:text-amber-400 font-semibold">
              Half Day (0.5d)
            </Badge>
          ) : (
            <Badge variant="outline">Manual</Badge>
          )}

          {record.source === "admin" && <Badge variant="warning">Manual Entry</Badge>}
          {record.totalMinutes > 0 && (
            <span className="text-sm font-medium tabular-nums text-foreground">
              {formatDuration(record.totalMinutes)} worked
            </span>
          )}
          {record.overtimeMinutes > 0 && (
            <Badge variant="warning">OT {formatDuration(record.overtimeMinutes)}</Badge>
          )}
        </div>

        {/* Policy evaluation callout */}
        {evaluated?.creditType === "late_grace" && (
          <div className="rounded-lg border border-amber-300/80 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-300 flex items-start gap-2">
            <Info className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold">Late Arrival #{evaluated.lateIndex} of 3 Allowed (Grace)</p>
              <p className="mt-0.5 text-amber-800/90 dark:text-amber-300/90">
                Arrived between 9:30 AM and 10:15 AM. Within monthly allowance of 3 late arrivals. Credited as a full day (1.0).
              </p>
            </div>
          </div>
        )}

        {evaluated?.creditType === "late_half_day" && (
          <div className="rounded-lg border border-orange-300/80 bg-orange-500/10 p-3 text-xs text-orange-950 dark:text-orange-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-orange-600 mt-0.5" />
            <div>
              <p className="font-semibold">Half Day Applied — Exceeded 3 Late Arrivals</p>
              <p className="mt-0.5 text-orange-900/90 dark:text-orange-300/90">
                This is late arrival #{evaluated.lateIndex} this month. Per company policy, after 3 late arrivals, subsequent late arrivals are counted as a <strong>Half Day (0.5 paid day)</strong>.
              </p>
            </div>
          </div>
        )}

        {evaluated?.creditType === "late_cutoff_half_day" && (
          <div className="rounded-lg border border-orange-300/80 bg-orange-500/10 p-3 text-xs text-orange-950 dark:text-orange-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-orange-600 mt-0.5" />
            <div>
              <p className="font-semibold">Half Day Applied — Arrived After 10:15 AM</p>
              <p className="mt-0.5 text-orange-900/90 dark:text-orange-300/90">
                Check-in at {formatTime(record.checkInAt)} is beyond the 10:15 AM late grace cutoff. Counted as a <strong>Half Day (0.5 paid day)</strong>.
              </p>
            </div>
          </div>
        )}

        {record.source === "admin" && (
          <div className="rounded-lg bg-warning/10 p-3 text-sm">
            <p className="font-medium">
              Marked by {record.markedByName || "an admin"} — not GPS/selfie verified
            </p>
            {record.note && <p className="mt-1 text-muted-foreground">{record.note}</p>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {sides.map((s) => {
            const link = mapsLink(s.lat, s.lng);
            const selfieUrl = selfies[s.key];
            return (
              <div key={s.key} className="space-y-2 rounded-lg border border-border p-3">
                <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                <p className="text-lg font-semibold tabular-nums">{formatTime(s.at)}</p>
                {selfieUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selfieUrl}
                    alt={`${s.label} selfie`}
                    className="aspect-square w-full rounded-md object-cover"
                  />
                ) : (
                  s.at && (
                    <div className="flex aspect-square w-full items-center justify-center rounded-md bg-muted p-2 text-center text-xs text-muted-foreground">
                      {record.source === "admin" ? "Not required (manual entry)" : "No selfie"}
                    </div>
                  )
                )}
                {link && (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> View on map
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Dialog>
  );
}
