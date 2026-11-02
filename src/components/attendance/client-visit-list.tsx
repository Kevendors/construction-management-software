"use client";

import * as React from "react";
import { AlertTriangle, Briefcase, ExternalLink } from "lucide-react";
import { formatDuration, formatTime, minutesBetween } from "@/lib/attendance/compute";
import { formatMeters, mapsLink } from "@/lib/attendance/client-visits";
import { getClientVisitsForEmployeeAction } from "@/app/attendance/client-visit-actions";
import type { ClientVisit } from "@/lib/types";

const shortDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });

function MapLink({ lat, lng, label }: { lat: number | null; lng: number | null; label: string }) {
  const link = mapsLink(lat, lng);
  if (!link) return null;
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
    >
      <ExternalLink className="h-3 w-3" /> {label}
    </a>
  );
}

/** Client visits (0052), one row each. Shared by the employee card, the day details and the admin list. */
export function ClientVisitList({ visits, showDate = false }: { visits: ClientVisit[]; showDate?: boolean }) {
  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {visits.map((v) => (
        <li key={v.id} className="space-y-1 px-3 py-2 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
            <p className="min-w-0 break-words font-medium">{v.clientName}</p>
            <p className="tabular-nums text-xs text-muted-foreground">
              {showDate && `${shortDate(v.date)} · `}
              {formatTime(v.startedAt)} – {v.endedAt ? formatTime(v.endedAt) : "not ended"}
              {v.endedAt && !v.autoClosed && ` · ${formatDuration(minutesBetween(v.startedAt, v.endedAt))}`}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {v.purpose}
            {v.startDistanceM != null && !v.startInOffice && ` · ${formatMeters(v.startDistanceM)} from office`}
          </p>
          {v.startInOffice && (
            <p className="flex items-center gap-1 text-xs font-medium text-destructive">
              <AlertTriangle className="h-3 w-3 shrink-0" /> Started inside the office
            </p>
          )}
          {v.autoClosed && (
            <p className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3 shrink-0" /> Not ended by employee — closed at punch-out, time spent unknown
            </p>
          )}
          <div className="flex flex-wrap gap-x-3">
            <MapLink lat={v.startLat} lng={v.startLng} label="Start location" />
            <MapLink lat={v.endLat} lng={v.endLng} label="End location" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Admin employee view: every client visit in the selected range. Renders nothing when there are none. */
export function EmployeeClientVisits({ userId, from, to }: { userId: string; from: string; to: string }) {
  const [visits, setVisits] = React.useState<ClientVisit[]>([]);
  React.useEffect(() => {
    let ignore = false;
    getClientVisitsForEmployeeAction(userId, from, to).then((list) => {
      if (!ignore) setVisits(list);
    });
    return () => {
      ignore = true;
    };
  }, [userId, from, to]);

  if (visits.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Briefcase className="h-3.5 w-3.5" /> Client visits in this range: {visits.length}
      </p>
      <ClientVisitList visits={visits} showDate />
    </div>
  );
}
