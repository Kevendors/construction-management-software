"use client";

import * as React from "react";
import { AlertTriangle, ArrowRightLeft, ExternalLink, History, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import {
  formatDuration,
  formatTime,
  haversineMeters,
  type EvaluatedAttendanceRecord,
} from "@/lib/attendance/compute";
import {
  getAttendanceEditHistoryAction,
  getAttendanceSelfieUrls,
  getAttendanceSiteVisitsAction,
  type AttendanceEditHistoryEntry,
  type SiteVisitDetail,
} from "@/app/attendance/actions";
import { getPunchFenceAction, reverseGeocodeAction, type PunchFence } from "@/app/attendance/geocode-actions";
import { SpotChecksSection } from "./spot-checks-section";
import { LocationMiniMap } from "./location-mini-map";
import { MAX_SITE_VISITS_PER_DAY } from "@/lib/attendance/site-visits";
import type { EmployeeAttendance } from "@/lib/types";

function mapsLink(lat: number | null, lng: number | null): string | null {
  if (lat == null || lng == null) return null;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/** reverseGeocodeAction looks up at most 10 points per call — chunk, one call after another. */
async function geocodeAll(points: { lat: number; lng: number }[]): Promise<(string | null)[]> {
  const out: (string | null)[] = [];
  for (let i = 0; i < points.length; i += 10) {
    const chunk = points.slice(i, i + 10);
    const res = await reverseGeocodeAction(chunk).catch(() => chunk.map(() => null));
    out.push(...res);
  }
  return out;
}

const PIN_COLOR = { in: "#16a34a", out: "#dc2626", visit: "#2563eb" } as const;

function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

function hasFence(f: PunchFence): f is PunchFence & { lat: number; lng: number; radiusM: number } {
  return f.lat != null && f.lng != null && f.radiusM != null && f.radiusM > 0;
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
  canExcuse = false,
}: {
  record: EmployeeAttendance | null;
  evaluated?: EvaluatedAttendanceRecord | null;
  onClose: () => void;
  showName?: boolean;
  canExcuse?: boolean;
}) {
  const [selfies, setSelfies] = React.useState<{ in?: string; out?: string }>({});
  const [history, setHistory] = React.useState<AttendanceEditHistoryEntry[]>([]);
  // Keyed by record so a late response for a previous record is never shown.
  const [addresses, setAddresses] = React.useState<{
    forId: string;
    in: string | null;
    out: string | null;
    /** Same order as `visits`; null = unknown or past the 10-point lookup cap. */
    visits: (string | null)[];
  } | null>(null);
  // Switch Site (0050) visits, oldest first — keyed by record like addresses.
  const [visits, setVisits] = React.useState<{ forId: string; list: SiteVisitDetail[] } | null>(null);
  const [fence, setFence] = React.useState<{ forId: string; fence: PunchFence | null } | null>(null);

  React.useEffect(() => {
    if (!record) return;
    setSelfies({});
    setHistory([]);
    getAttendanceSelfieUrls([record.id]).then((urls) => setSelfies(urls[record.id] ?? {}));
    getAttendanceEditHistoryAction(record.id).then(setHistory);
    if (record.status === "present") {
      getPunchFenceAction(record.projectId || null).then((f) => setFence({ forId: record.id, fence: f }));
      const inPt = record.checkInLat != null && record.checkInLng != null ? { lat: record.checkInLat, lng: record.checkInLng } : null;
      const outPt = record.checkOutLat != null && record.checkOutLng != null ? { lat: record.checkOutLat, lng: record.checkOutLng } : null;
      const punchPoints = [inPt, outPt].filter((p): p is { lat: number; lng: number } => p !== null);
      // Visits first (also for an office check-in: a "Can work from office"
      // member may switch to a project later), then geocode in/out + every
      // visit (up to 20). A failed visits fetch still geocodes in/out.
      getAttendanceSiteVisitsAction(record.id)
        .catch((): SiteVisitDetail[] => [])
        .then((visitList) => {
        setVisits({ forId: record.id, list: visitList });
        const points = [
          ...punchPoints,
          ...visitList.slice(0, MAX_SITE_VISITS_PER_DAY).map((v) => ({ lat: v.lat, lng: v.lng })),
        ];
        if (!points.length) return;
        geocodeAll(points).then((list) => {
          let i = 0;
          const inAddr = inPt ? list[i++] ?? null : null;
          const outAddr = outPt ? list[i++] ?? null : null;
          setAddresses({
            forId: record.id,
            in: inAddr,
            out: outAddr,
            visits: visitList.map((_, k) => list[i + k] ?? null),
          });
        });
      });
    }
  }, [record]);

  if (!record) return null;

  const isOffice = !record.projectId;
  const isDeclarative = record.status !== "present";

  const dateLabel = new Date(`${record.date}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const punchFence = fence?.forId === record.id ? fence.fence : null;
  const visitList = visits?.forId === record.id ? visits.list : [];
  const visitAddresses = addresses?.forId === record.id ? addresses.visits : null;
  // After a Switch Site, check-out was judged against the current site at
  // check-out: the LAST visit to a project or the Office (a null-project
  // visit by anyone else was a since-deleted project — skipped, as on the server).
  const knownVisits = visitList.filter((v) => v.projectId || v.isOffice);
  const lastVisit = knownVisits.length ? knownVisits[knownVisits.length - 1] : null;
  const outFence: PunchFence | null = lastVisit
    ? lastVisit.fence
      ? {
          kind: lastVisit.isOffice ? "office" : "site",
          name: lastVisit.projectName ?? "Site",
          ...lastVisit.fence,
        }
      : null
    : punchFence;
  const fenceFor = (key: "in" | "out") => (key === "out" ? outFence : punchFence);
  // Per side: IN = the check-in site, OUT = the site at check-out.
  const fenceWordFor = (key: "in" | "out") => (fenceFor(key)?.kind === "office" ? "office" : "site");

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
          {evaluated?.creditType === "declared_holiday" ? (
            <Badge variant="muted">Holiday</Badge>
          ) : evaluated?.creditType === "leave" ? (
            <Badge variant="success">Leave (1.0d paid)</Badge>
          ) : evaluated?.creditType === "leave_unpaid" ? (
            <Badge variant="destructive">Absent (0d)</Badge>
          ) : evaluated?.creditType === "explicit_absent" ? (
            <Badge variant="destructive">Absent (0d)</Badge>
          ) : evaluated?.creditType === "explicit_half_day" ? (
            <Badge variant="warning" className="border-amber-400 bg-amber-500/15 text-amber-800 dark:text-amber-400 font-semibold">
              Half Day (0.5d)
            </Badge>
          ) : evaluated?.creditType === "on_time" || !evaluated ? (
            <Badge variant="success">Present (1.0d)</Badge>
          ) : (
            <Badge variant="outline">Manual</Badge>
          )}

          {isOffice && !isDeclarative && <Badge variant="outline">Office</Badge>}
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

        {record.source === "admin" && (
          <div className="rounded-lg bg-warning/10 p-3 text-sm">
            <p className="font-medium">
              Marked by {record.markedByName || "an admin"} — not GPS/selfie verified
            </p>
            {record.note && <p className="mt-1 text-muted-foreground">{record.note}</p>}
          </div>
        )}

        {/* Self punches carry system notes: late-arrival Half-Day and
            "Checked in/out outside site (X away): reason". */}
        {record.source === "self" && record.note && (
          <div className="space-y-1 rounded-lg bg-warning/10 p-3 text-sm">
            {record.note.split(" · ").map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        )}

        {!isDeclarative && punchFence && (
          hasFence(punchFence) ? (
            <p className="flex items-center gap-1.5 text-sm">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="font-medium">{punchFence.kind === "site" ? punchFence.name : "Office"}</span>
              <span className="text-muted-foreground">· allowed within {formatDistance(punchFence.radiusM)}</span>
            </p>
          ) : (
            <div className="flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p>
                <span className="font-medium">{punchFence.kind === "site" ? punchFence.name : "Office"}</span>
                {punchFence.kind === "site"
                  ? " has no geofence set, so check-ins here aren't location-checked. Set it in the project's Settings tab."
                  : " — no office location is set, so punch-ins aren't location-checked."}
              </p>
            </div>
          )
        )}

        {isDeclarative ? (
          <div className="rounded-lg border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
            {evaluated?.creditType === "declared_holiday"
              ? "No punch times — this date is a declared company holiday, so it's recorded as Holiday rather than the manually marked status."
              : `No punch times — this day was declared ${evaluated?.badgeLabel.toLowerCase() ?? record.status} directly.`}
          </div>
        ) : (
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
                        {record.source === "admin"
                          ? "Not required (manual entry)"
                          : isOffice
                          ? "No selfie — Office punch-in"
                          : "No selfie"}
                      </div>
                    )
                  )}
                  {link && (
                    <div className="space-y-1">
                      <p className="flex items-start gap-1 text-xs leading-snug text-foreground">
                        <span
                          className="mt-1 h-2 w-2 shrink-0 rounded-full"
                          style={{ background: PIN_COLOR[s.key] }}
                        />
                        {addresses?.forId === record.id
                          ? addresses[s.key] ?? "Address not found"
                          : "Finding address…"}
                      </p>
                      {(() => {
                        const sideFence = fenceFor(s.key);
                        if (!sideFence || !hasFence(sideFence) || s.lat == null || s.lng == null) return null;
                        const d = haversineMeters(s.lat, s.lng, sideFence.lat, sideFence.lng);
                        return d <= sideFence.radiusM ? (
                          <p className="text-xs font-medium text-success">
                            Within {fenceWordFor(s.key)} · {formatDistance(d)} from centre
                          </p>
                        ) : (
                          <p className="flex items-center gap-1 text-xs font-medium text-destructive">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            {formatDistance(d)} from {fenceWordFor(s.key)} (allowed {formatDistance(sideFence.radiusM)})
                          </p>
                        );
                      })()}
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" /> Open in Google Maps
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!isDeclarative && visitList.length > 0 && (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <ArrowRightLeft className="h-3.5 w-3.5" /> Sites visited
            </p>
            <ol className="space-y-3 rounded-lg border border-border p-3">
              <li className="flex items-start gap-2 text-sm">
                <span
                  className="mt-0.5 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
                  style={{ background: PIN_COLOR.in }}
                >
                  IN
                </span>
                <div className="min-w-0">
                  <p>
                    <span className="font-medium tabular-nums">{formatTime(record.checkInAt)}</span>
                    {" · "}
                    {punchFence?.kind === "site" ? punchFence.name : punchFence?.kind === "office" ? "Office" : "Check-in site"}
                  </p>
                  <p className="text-xs text-muted-foreground">Checked in</p>
                </div>
              </li>
              {visitList.map((v, idx) => {
                const link = mapsLink(v.lat, v.lng);
                return (
                  <li key={v.id} className="flex items-start gap-2 text-sm">
                    <span
                      className="mt-0.5 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                      style={{ background: PIN_COLOR.visit }}
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p>
                        <span className="font-medium tabular-nums">{formatTime(v.arrivedAt)}</span>
                        {" · "}
                        {v.projectName ?? "Removed project"}
                      </p>
                      <p className="text-xs leading-snug text-muted-foreground">
                        {visitAddresses ? visitAddresses[idx] ?? "Address not found" : "Finding address…"}
                      </p>
                      {v.outsideM != null && (
                        <p className="flex items-start gap-1 text-xs font-medium text-destructive">
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                          Outside site ({formatDistance(v.outsideM)} away){v.outsideReason ? `: ${v.outsideReason}` : ""}
                        </p>
                      )}
                      {link && (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" /> Open in Google Maps
                        </a>
                      )}
                    </div>
                    {v.selfieUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={v.selfieUrl}
                        alt={`Selfie at ${v.projectName ?? "site"}`}
                        className="h-16 w-16 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-muted text-center text-[10px] text-muted-foreground">
                        No selfie
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {!isDeclarative && (
          <LocationMiniMap
            key={`map-${record.id}`}
            pins={[
              ...sides
                .filter((s) => s.lat != null && s.lng != null)
                .map((s) => ({
                  lat: s.lat as number,
                  lng: s.lng as number,
                  label: s.key === "in" ? "IN" : "OUT",
                  color: PIN_COLOR[s.key],
                })),
              ...visitList.map((v, idx) => ({
                lat: v.lat,
                lng: v.lng,
                label: String(idx + 1),
                color: PIN_COLOR.visit,
              })),
            ]}
          />
        )}

        {(!isOffice || visitList.length > 0) && !isDeclarative && <SpotChecksSection key={record.id} attendanceId={record.id} canExcuse={canExcuse} />}
        {history.length > 0 && (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <History className="h-3.5 w-3.5" /> Edit History
            </p>
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
              {history.map((h) => (
                <div key={h.id} className="text-xs">
                  <p className="text-foreground">{h.summary}</p>
                  <p className="text-muted-foreground">
                    {h.actorName} ·{" "}
                    {new Date(h.createdAt).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
