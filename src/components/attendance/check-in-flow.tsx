"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, LocateFixed, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { haversineMeters, formatTime } from "@/lib/attendance/compute";
import type { Project } from "@/lib/types";
import { checkInAction, checkOutAction } from "@/app/attendance/actions";
import { CameraCapture } from "./camera-capture";
import { useGeolocation, type GeoResult } from "./use-geolocation";

export interface FlowSuccess {
  at: string; // ISO timestamp of the check-in/out
  projectId: string;
  lat: number;
  lng: number;
}

type Step =
  | "project"
  | "locate"
  | "camera"
  | "preview"
  | "submitting"
  | "success"
  | "error";

/**
 * Guided check-in / check-out: pick project (skipped when obvious) → GPS fix
 * (+ client geo-fence pre-check) → live selfie → confirm → submit. The server
 * re-validates assignment and the fence; this flow just fails fast.
 */
export function CheckInFlow({
  open,
  mode,
  projects,
  activeProjectId,
  onClose,
  onSuccess,
}: {
  open: boolean;
  mode: "in" | "out";
  /** Projects the user may check in to (used for the picker + fence pre-check). */
  projects: Project[];
  /** For check-out: the project of today's open record. */
  activeProjectId?: string;
  onClose: () => void;
  onSuccess: (result: FlowSuccess) => void;
}) {
  const [step, setStep] = React.useState<Step>("locate");
  const [projectId, setProjectId] = React.useState("");
  const [selfie, setSelfie] = React.useState("");
  const [errorMsg, setErrorMsg] = React.useState("");
  const [doneAt, setDoneAt] = React.useState("");
  const [evalInfo, setEvalInfo] = React.useState<{
    creditType?: "on_time" | "late_grace" | "late_half_day" | "late_cutoff_half_day";
    lateIndex?: number;
    lateMessage?: string;
  } | null>(null);
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
      setEvalInfo(null);
      if (mode === "out") {
        setProjectId(activeProjectId ?? "");
        setStep("locate");
      } else if (projects.length === 1) {
        setProjectId(projects[0].id);
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

  // Advance (or fail fast on the fence) once we have a position.
  React.useEffect(() => {
    if (!open || step !== "locate" || geo.status !== "success" || !geo.position) return;
    const project = projects.find((p) => p.id === projectId);
    const fence = clientFenceError(project, geo.position);
    if (fence) {
      setErrorMsg(fence);
      setStep("error");
    } else {
      setStep("camera");
    }
  }, [open, step, geo.status, geo.position, projects, projectId]);

  async function submit() {
    if (!geo.position) return;
    setStep("submitting");
    const { lat, lng, accuracy } = geo.position;
    if (mode === "in") {
      const checkInRes = await checkInAction({ projectId, lat, lng, accuracy, selfieDataUrl: selfie });
      if (checkInRes.error) {
        setErrorMsg(checkInRes.error);
        setStep("error");
        return;
      }
      setEvalInfo({
        creditType: checkInRes.creditType,
        lateIndex: checkInRes.lateIndex,
        lateMessage: checkInRes.lateMessage,
      });
    } else {
      const checkOutRes = await checkOutAction({ lat, lng, accuracy, selfieDataUrl: selfie });
      if (checkOutRes.error) {
        setErrorMsg(checkOutRes.error);
        setStep("error");
        return;
      }
    }
    const at = new Date().toISOString();
    setDoneAt(at);
    setStep("success");
    onSuccess({ at, projectId, lat, lng });
  }

  const title = mode === "in" ? "Mark Attendance" : "Check Out";
  const project = projects.find((p) => p.id === projectId);

  return (
    <Dialog open={open} onClose={onClose} title={title} className="max-w-md">
      {step === "project" && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Which project are you working on today?</p>
          {projects.map((p) => (
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
                <span className="block text-sm font-medium">{p.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {p.code}
                  {p.location ? ` · ${p.location}` : ""}
                </span>
              </span>
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}

      {step === "locate" && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <LocateFixed className="h-9 w-9 animate-pulse text-primary" />
          <p className="text-sm font-medium">Getting your location…</p>
          <p className="text-xs text-muted-foreground">
            {project?.geofenceRadiusM
              ? `Checking you are within ${project.geofenceRadiusM}m of ${project.name}.`
              : "Your GPS position is recorded with your attendance."}
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
              Review your photo and confirm {mode === "in" ? "check in" : "check out"}
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
              {mode === "in" ? "Confirm Check In" : "Confirm Check Out"}
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
          <p className="text-lg font-semibold">
            {mode === "in" ? "Checked in successfully" : "Checked out successfully"}
          </p>
          <p className="text-sm font-medium tabular-nums text-foreground">
            at {formatTime(doneAt)}
          </p>
          {project && <p className="text-xs text-muted-foreground">{project.name}</p>}

          {mode === "in" && evalInfo && (
            <div className="mt-2 w-full rounded-lg border p-3 text-left text-xs space-y-1">
              {evalInfo.creditType === "on_time" && (
                <div className="flex items-center gap-2 font-medium text-success">
                  <span className="inline-block h-2 w-2 rounded-full bg-success" />
                  <span>On-time arrival (by 9:30 AM) — Full Day (1.0d) credited</span>
                </div>
              )}
              {evalInfo.creditType === "late_grace" && (
                <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2.5 text-amber-900 dark:text-amber-300">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <span>⚠️ Late Arrival #{evalInfo.lateIndex} of 3 Allowed</span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Covered under monthly grace allowance (up to 10:15 AM). Full Day (1.0d) credited.
                  </p>
                </div>
              )}
              {evalInfo.creditType === "late_half_day" && (
                <div className="rounded border border-orange-500/30 bg-orange-500/10 p-2.5 text-orange-900 dark:text-orange-300">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <span>⚠️ 4th Late Arrival — Counted as Half Day</span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Exceeded 3 monthly grace late arrivals. Today is marked as a Half Day (0.5 paid day).
                  </p>
                </div>
              )}
              {evalInfo.creditType === "late_cutoff_half_day" && (
                <div className="rounded border border-orange-500/30 bg-orange-500/10 p-2.5 text-orange-900 dark:text-orange-300">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <span>⚠️ Checked In After 10:15 AM Cutoff — Half Day</span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Arrival past 10:15 AM grace cutoff. Today is marked as a Half Day (0.5 paid day).
                  </p>
                </div>
              )}
            </div>
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

function clientFenceError(project: Project | undefined, pos: GeoResult): string | null {
  if (!project || project.geofenceLat == null || project.geofenceLng == null || !project.geofenceRadiusM) {
    return null;
  }
  const distance = haversineMeters(pos.lat, pos.lng, project.geofenceLat, project.geofenceLng);
  if (distance - pos.accuracy <= project.geofenceRadiusM) return null;
  return `You are ~${distance}m from the ${project.name} site (allowed ${project.geofenceRadiusM}m). Move inside the project area and try again.`;
}
