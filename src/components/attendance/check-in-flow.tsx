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
  const geo = useGeolocation();
  const geoRequest = geo.request;

  // Reset and choose the entry step each time the dialog opens.
  React.useEffect(() => {
    if (!open) return;
    setSelfie("");
    setErrorMsg("");
    setDoneAt("");
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
    const res =
      mode === "in"
        ? await checkInAction({ projectId, lat, lng, accuracy, selfieDataUrl: selfie })
        : await checkOutAction({ lat, lng, accuracy, selfieDataUrl: selfie });
    if (res.error) {
      setErrorMsg(res.error);
      setStep("error");
      return;
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

      {step === "camera" && <CameraCapture onCapture={(d) => { setSelfie(d); setStep("preview"); }} />}

      {step === "preview" && (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selfie}
            alt="Your selfie"
            className="aspect-[3/4] w-full -scale-x-100 rounded-xl object-cover"
          />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-12" onClick={() => setStep("camera")}>
              Retake
            </Button>
            <Button className="h-12" onClick={submit}>
              {mode === "in" ? "Check In" : "Check Out"}
            </Button>
          </div>
        </div>
      )}

      {step === "submitting" && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Saving your attendance…</p>
        </div>
      )}

      {step === "success" && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-success" />
          <p className="text-lg font-semibold">
            {mode === "in" ? "Checked in" : "Checked out"} at {formatTime(doneAt)}
          </p>
          {project && <p className="text-sm text-muted-foreground">{project.name}</p>}
          <Button className="mt-2 h-12 w-full" onClick={onClose}>
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
