"use client";

import * as React from "react";
import { AlertTriangle, Building2, CheckCircle2, LocateFixed, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { haversineMeters, formatTime } from "@/lib/attendance/compute";
import { OFFICE_SITE, OFFICE_SITE_NAME } from "@/lib/attendance/site-visits";
import type { Project } from "@/lib/types";
import { checkInAction, checkOutAction, switchSiteAction } from "@/app/attendance/actions";
import { CameraCapture } from "./camera-capture";
import { useGeolocation, type GeoResult } from "./use-geolocation";

export interface FlowSuccess {
  at: string; // ISO timestamp of the check-in/out
  projectId: string;
  lat: number;
  lng: number;
  /** Id returned by the action ("mock" in sample-data mode). */
  id?: string;
}

export type FlowMode = "in" | "out" | "switch";

type Step =
  | "project"
  | "locate"
  | "reason"
  | "camera"
  | "preview"
  | "submitting"
  | "success"
  | "error";

/**
 * Guided check-in / check-out: pick project → GPS fix → (outside the site
 * fence: pick a reason) → live selfie → confirm → submit. Check-out skips the
 * project step (it closes the shift already open under `activeProjectId`).
 * Switch Site ("switch") runs the same steps during an open site shift,
 * offering every project except the current one (`activeProjectId`).
 * Site staff are never blocked by the fence — an outside punch just needs a
 * reason, which the server re-checks and flags for Admin/HR.
 */
export function CheckInFlow({
  open,
  mode,
  projects,
  activeProjectId,
  canWorkFromOffice = false,
  officeGeofence,
  onClose,
  onSuccess,
}: {
  open: boolean;
  mode: FlowMode;
  /** Projects the user may check in to (used for the picker + fence pre-check). */
  projects: Project[];
  /**
   * Check-out / switch: the current site of today's open record (excluded
   * from the switch picker) — a project id, or OFFICE_SITE.
   */
  activeProjectId?: string;
  /** 0050 addendum: offer "Office" first in the picker (value OFFICE_SITE). */
  canWorkFromOffice?: boolean;
  /** Org office fence — the pre-check when the site is the Office. */
  officeGeofence?: { lat: number | null; lng: number | null; radiusM: number | null };
  onClose: () => void;
  onSuccess: (result: FlowSuccess) => void;
}) {
  // Every site this flow can be judged against; the Office is always there
  // for the fence pre-check but only offered in the picker when allowed.
  const sites = React.useMemo<SiteOption[]>(
    () => [
      {
        id: OFFICE_SITE,
        name: OFFICE_SITE_NAME,
        detail: "Work from the office",
        fenceLat: officeGeofence?.lat ?? null,
        fenceLng: officeGeofence?.lng ?? null,
        radiusM: officeGeofence?.radiusM ?? null,
      },
      ...projects.map((p) => ({
        id: p.id,
        name: p.name,
        detail: `${p.code}${p.location ? ` · ${p.location}` : ""}`,
        fenceLat: p.geofenceLat,
        fenceLng: p.geofenceLng,
        radiusM: p.geofenceRadiusM,
      })),
    ],
    [projects, officeGeofence?.lat, officeGeofence?.lng, officeGeofence?.radiusM]
  );
  const [step, setStep] = React.useState<Step>("locate");
  const [projectId, setProjectId] = React.useState("");
  const [selfie, setSelfie] = React.useState("");
  const [errorMsg, setErrorMsg] = React.useState("");
  const [doneAt, setDoneAt] = React.useState("");
  const [outsideM, setOutsideM] = React.useState<number | null>(null);
  const [reasonChoice, setReasonChoice] = React.useState("");
  const [reasonOther, setReasonOther] = React.useState("");
  const geo = useGeolocation();
  const geoRequest = geo.request;

  // Track if dialog was previously open to ONLY reset when newly opening (false -> true).
  // Prevents re-renders in parent (e.g. from optimistic state updates or router.refresh)
  // from wiping state and bouncing the user back to the camera step.
  const prevOpenRef = React.useRef(false);

  React.useEffect(() => {
    if (open && !prevOpenRef.current) {
      setSelfie("");
      setErrorMsg("");
      setDoneAt("");
      setOutsideM(null);
      setReasonChoice("");
      setReasonOther("");
      if (mode === "out") {
        setProjectId(activeProjectId ?? "");
        setStep("locate");
      } else {
        setProjectId("");
        setStep("project");
      }
    }
    prevOpenRef.current = open;
  }, [open, mode, activeProjectId, projects]);

  // Kick off the GPS fix whenever we enter the locate step.
  React.useEffect(() => {
    if (open && step === "locate") geoRequest();
  }, [open, step, geoRequest]);

  // Advance once we have a position — via the reason step when outside the site.
  React.useEffect(() => {
    if (!open || step !== "locate" || geo.status !== "success" || !geo.position) return;
    const site = sites.find((p) => p.id === projectId);
    const distance = outsideSiteDistance(site, geo.position);
    setOutsideM(distance);
    setStep(distance != null ? "reason" : "camera");
  }, [open, step, geo.status, geo.position, sites, projectId]);

  const outsideReason = reasonChoice === OTHER_REASON ? reasonOther.trim() : reasonChoice;

  async function submit() {
    if (!geo.position) return;
    setStep("submitting");
    const { lat, lng, accuracy } = geo.position;
    const reason = outsideM != null ? outsideReason : undefined;
    const res =
      mode === "in"
        ? await checkInAction({ projectId, lat, lng, accuracy, selfieDataUrl: selfie, outsideReason: reason })
        : mode === "switch"
          ? await switchSiteAction({ projectId, lat, lng, accuracy, selfieDataUrl: selfie, outsideReason: reason })
          : await checkOutAction({ lat, lng, accuracy, selfieDataUrl: selfie, outsideReason: reason });
    if (res.error) {
      // The server found us outside the fence (e.g. a project the picker
      // didn't have fence data for) — ask for a reason, keep the selfie.
      if (res.outsideDistanceM != null && !reason) {
        setOutsideM(res.outsideDistanceM);
        setStep("reason");
        return;
      }
      setErrorMsg(res.error);
      setStep("error");
      return;
    }
    const at = new Date().toISOString();
    setDoneAt(at);
    setStep("success");
    onSuccess({ at, projectId, lat, lng, id: res.id });
  }

  const title = mode === "in" ? "Mark Attendance" : mode === "switch" ? "Switch Site" : "Check Out";
  const actionWord = mode === "in" ? "check in" : mode === "switch" ? "switch site" : "check out";
  const project = sites.find((p) => p.id === projectId);
  const pickable = sites.filter(
    (p) => (p.id !== OFFICE_SITE || canWorkFromOffice) && (mode !== "switch" || p.id !== activeProjectId)
  );

  return (
    <Dialog open={open} onClose={onClose} title={title} className="max-w-md">
      {step === "project" && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {mode === "switch" ? "Which site are you moving to?" : "Which project are you working on today?"}
          </p>
          {mode === "switch" && pickable.length === 0 && (
            <p className="rounded-lg border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
              There are no other sites to switch to.
            </p>
          )}
          {pickable.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setProjectId(p.id);
                setStep("locate");
              }}
              className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3.5 text-left transition-colors hover:bg-secondary"
            >
              <span>
                <span className="block text-sm font-medium">
                  {p.id === OFFICE_SITE ? `🏢 ${p.name}` : p.name}
                </span>
                <span className="block text-xs text-muted-foreground">{p.detail}</span>
              </span>
              {p.id === OFFICE_SITE ? (
                <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </button>
          ))}
        </div>
      )}

      {step === "locate" && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <LocateFixed className="h-9 w-9 animate-pulse text-primary" />
          <p className="text-sm font-medium">Getting your location…</p>
          <p className="text-xs text-muted-foreground">
            Your GPS position is recorded with your attendance.
          </p>
          {geo.status === "error" && (
            <>
              <p className="max-w-xs text-sm text-destructive">{geo.error}</p>
              <Button size="sm" variant="outline" onClick={geoRequest}>
                Retry
              </Button>
            </>
          )}
        </div>
      )}

      {step === "reason" && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p>
              You are about <span className="font-semibold">{formatMeters(outsideM ?? 0)}</span> from{" "}
              {project?.id === OFFICE_SITE ? "the Office" : project?.name ?? "the site"}. You can still {actionWord}{" "}— tell us why
              you&apos;re away from site. Admin/HR will see this with your location.
            </p>
          </div>
          <div className="grid gap-2">
            {[...OUTSIDE_REASONS, OTHER_REASON].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReasonChoice(r)}
                className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                  reasonChoice === r ? "border-primary bg-primary/5 font-medium" : "border-border hover:bg-secondary"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          {reasonChoice === OTHER_REASON && (
            <textarea
              value={reasonOther}
              onChange={(e) => setReasonOther(e.target.value)}
              maxLength={200}
              rows={2}
              placeholder="Type the reason"
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            />
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-12" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="h-12"
              disabled={!outsideReason}
              onClick={() => setStep(selfie ? "preview" : "camera")}
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === "camera" && (
        <CameraCapture
          onCapture={(d) => {
            setSelfie(d);
            setStep("preview");
          }}
        />
      )}

      {step === "preview" && (
        <div className="space-y-3">
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">Selfie Captured</p>
            <p className="text-xs text-muted-foreground">
              Review your photo and confirm {mode === "switch" ? "the site switch" : actionWord}
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selfie}
            alt="Your selfie"
            className="aspect-[3/4] w-full -scale-x-100 rounded-xl object-cover border border-border"
          />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-12" onClick={() => setStep("camera")}>
              Retake
            </Button>
            <Button className="h-12" onClick={submit}>
              {mode === "in" ? "Confirm Check In" : mode === "switch" ? "Confirm Switch" : "Confirm Check Out"}
            </Button>
          </div>
        </div>
      )}

      {step === "submitting" && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm font-medium">Saving your attendance…</p>
          <p className="text-xs text-muted-foreground">Verifying location and uploading selfie</p>
        </div>
      )}

      {step === "success" && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <CheckCircle2 className="h-12 w-12 text-success" />
          {mode === "switch" ? (
            <p className="text-lg font-semibold">
              Switched to {project?.name ?? "the new site"} at{" "}
              <span className="tabular-nums">{formatTime(doneAt)}</span>
            </p>
          ) : (
            <>
              <p className="text-lg font-semibold">
                {mode === "in" ? "Checked in successfully" : "Checked out successfully"}
              </p>
              <p className="text-sm font-medium tabular-nums text-foreground">
                at {formatTime(doneAt)}
              </p>
              {project && <p className="text-xs text-muted-foreground">{project.name}</p>}
            </>
          )}

          <Button className="mt-4 h-12 w-full" onClick={onClose}>
            Done
          </Button>
        </div>
      )}

      {step === "error" && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <p className="max-w-sm text-sm">{errorMsg}</p>
          <div className="mt-2 grid w-full grid-cols-2 gap-2">
            <Button variant="outline" className="h-12" onClick={onClose}>
              Close
            </Button>
            <Button className="h-12" onClick={() => setStep("locate")}>
              Try Again
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

const OUTSIDE_REASONS = [
  "Collecting material",
  "Supplier / vendor visit",
  "Client or office meeting",
  "On the way to site",
];
const OTHER_REASON = "Other";

function formatMeters(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

/** A picker entry: a project, or the Office (id OFFICE_SITE). */
interface SiteOption {
  id: string;
  name: string;
  detail: string;
  fenceLat: number | null;
  fenceLng: number | null;
  radiusM: number | null;
}

/** Distance from the site centre when outside its fence (server uses the same rule), else null. */
function outsideSiteDistance(site: SiteOption | undefined, pos: GeoResult): number | null {
  if (!site || site.fenceLat == null || site.fenceLng == null || !site.radiusM) {
    return null;
  }
  const distance = haversineMeters(pos.lat, pos.lng, site.fenceLat, site.fenceLng);
  return distance - pos.accuracy <= site.radiusM ? null : distance;
}
