"use client";

import * as React from "react";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { formatDuration, formatTime } from "@/lib/attendance/compute";
import { getAttendanceSelfieUrls } from "@/app/attendance/actions";
import type { EmployeeAttendance } from "@/lib/types";

function mapsLink(lat: number | null, lng: number | null): string | null {
  if (lat == null || lng == null) return null;
  return `https://maps.google.com/?q=${lat},${lng}`;
}

/**
 * In/out details for one attendance day, incl. selfies (signed URLs fetched
 * on open) and GPS map links. Also used by the admin board (`showName`).
 */
export function RecordDetailDialog({
  record,
  onClose,
  showName = false,
}: {
  record: EmployeeAttendance | null;
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
          <Badge variant="success">Present</Badge>
          {record.totalMinutes > 0 && (
            <span className="text-sm font-medium tabular-nums">
              {formatDuration(record.totalMinutes)} worked
            </span>
          )}
          {record.overtimeMinutes > 0 && (
            <Badge variant="warning">OT {formatDuration(record.overtimeMinutes)}</Badge>
          )}
        </div>

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
                    <div className="flex aspect-square w-full items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                      No selfie
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
