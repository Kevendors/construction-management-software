"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { haversineMeters, formatTime } from "@/lib/attendance/compute";
import { officeCheckInAction, officeCheckOutAction } from "@/app/attendance/actions";
import { useGeolocation, type GeoResult } from "./use-geolocation";
import type { FlowSuccess } from "./check-in-flow";

type Step = "locate" | "submitting" | "success" | "error";

function clientFenceError(
  fence: { lat: number | null; lng: number | null; radiusM: number | null },
  pos: GeoResult
): string | null {
  if (fence.lat == null || fence.lng == null || !fence.radiusM) return null;
  const distance = haversineMeters(pos.lat, pos.lng, fence.lat, fence.lng);
  if (distance - pos.accuracy <= fence.radiusM) return null;
  return `You are ~${distance}m from the office (allowed ${fence.radiusM}m). Move inside the office premises and try again.`;
}

/**
 * One-tap office punch: open → GPS fix (+ client-side office-fence
 * pre-check) → submit immediately. No project step, no camera — deliberately
 * lighter than CheckInFlow (the site flow), which this is not a mode of but
 * a separate, smaller component for (see 2026-10-13 design spec §3).
 */
export function OfficeCheckInFlow({
  open,
  mode,
  officeGeofence,
  onClose,
  onSuccess,
}: {
  open: boolean;
  mode: "in" | "out";
  officeGeofence: { lat: number | null; lng: number | null; radiusM: number | null };
  onClose: () => void;
  onSuccess: (result: FlowSuccess) => void;
}) {
  const [step, setStep] = React.useState<Step>("locate");
  const [errorMsg, setErrorMsg] = React.useState("");
  const [doneAt, setDoneAt] = React.useState("");
  const geo = useGeolocation();
  const geoRequest = geo.request;

  const prevOpenRef = React.useRef(false);
  const submittedRef = React.useRef(false);

  React.useEffect(() => {
    if (open && !prevOpenRef.current) {
      setErrorMsg("");
      setDoneAt("");
      setStep("locate");
      submittedRef.current = false;
    }
    prevOpenRef.current = open;
  }, [open]);

  React.useEffect(() => {
    if (open && step === "locate") geoRequest();
  }, [open, step, geoRequest]);

  const submit = React.useCallback(async () => {
    if (!geo.position || submittedRef.current) return;
    submittedRef.current = true;
    setStep("submitting");
    const { lat, lng, accuracy } = geo.position;
    if (mode === "in") {
      const res = await officeCheckInAction({ lat, lng, accuracy });
      if (res.error) {
        setErrorMsg(res.error);
        setStep("error");
        submittedRef.current = false;
        return;
      }
    } else {
      const res = await officeCheckOutAction({ lat, lng, accuracy });
      if (res.error) {
        setErrorMsg(res.error);
        setStep("error");
        submittedRef.current = false;
        return;
      }
    }
    const at = new Date().toISOString();
    setDoneAt(at);
    setStep("success");
    onSuccess({ at, projectId: "", lat, lng });
  }, [geo.position, mode, onSuccess]);

  // Fail fast on the client-side fence check; otherwise submit immediately —
  // true one-tap, no confirm screen (there's no selfie to review).
  React.useEffect(() => {
    if (!open || step !== "locate" || geo.status !== "success" || !geo.position) return;
    const fence = clientFenceError(officeGeofence, geo.position);
    if (fence) {
      setErrorMsg(fence);
      setStep("error");
      return;
    }
    submit();
  }, [open, step, geo.status, geo.position, officeGeofence, submit]);

  const title = mode === "in" ? "Punch In" : "Punch Out";

  return (
    <Dialog open={open} onClose={onClose} title={title} className="max-w-md">
      {(step === "locate" || step === "submitting") && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <LocateFixed className="h-9 w-9 animate-pulse text-primary" />
          <p className="text-sm font-medium">
            {step === "submitting" ? "Saving your punch…" : "Getting your location…"}
          </p>
          <p className="text-xs text-muted-foreground">
            {officeGeofence.radiusM
              ? `Checking you are within ${officeGeofence.radiusM}m of the office.`
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

      {step === "success" && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <CheckCircle2 className="h-12 w-12 text-success" />
          <p className="text-lg font-semibold">
            {mode === "in" ? "Punched in successfully" : "Punched out successfully"}
          </p>
          <p className="text-sm font-medium tabular-nums text-foreground">at {formatTime(doneAt)}</p>
          <Button className="mt-4 h-12 w-full" onClick={onClose}>
            Done
          </Button>
        </div>
      )}

      {step === "error" && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <p className="max-w-sm text-sm">{errorMsg}</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Still having trouble? Ask your admin to mark today&apos;s attendance for you.
          </p>
          <div className="mt-2 grid w-full grid-cols-2 gap-2">
            <Button variant="outline" className="h-12" onClick={onClose}>
              Close
            </Button>
            <Button
              className="h-12"
              onClick={() => {
                submittedRef.current = false;
                setStep("locate");
              }}
            >
              Try Again
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
