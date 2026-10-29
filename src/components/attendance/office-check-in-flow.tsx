"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { haversineMeters, formatTime } from "@/lib/attendance/compute";
import { officeCheckInAction, officeCheckOutAction } from "@/app/attendance/actions";
import { useGeolocation, type GeoResult } from "./use-geolocation";
import type { FlowSuccess } from "./check-in-flow";

type Step = "locate" | "reason" | "submitting" | "success" | "error";

/** Distance from the office centre when outside its fence (server uses the same rule), else null. */
function outsideOfficeDistance(
  fence: { lat: number | null; lng: number | null; radiusM: number | null },
  pos: GeoResult
): number | null {
  if (fence.lat == null || fence.lng == null || !fence.radiusM) return null;
  const distance = haversineMeters(pos.lat, pos.lng, fence.lat, fence.lng);
  return distance - pos.accuracy <= fence.radiusM ? null : distance;
}

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
 *
 * 0051: with "Client visits allowed" (Team page), a punch outside the office
 * fence isn't blocked — a reason step (mirrors CheckInFlow's) comes first. The
 * member stays Office: still no selfie, no tracking.
 */
export function OfficeCheckInFlow({
  open,
  mode,
  officeGeofence,
  clientVisitsAllowed = false,
  onClose,
  onSuccess,
}: {
  open: boolean;
  mode: "in" | "out";
  officeGeofence: { lat: number | null; lng: number | null; radiusM: number | null };
  /** 0051: may punch away from the office with a reason (client visits). */
  clientVisitsAllowed?: boolean;
  onClose: () => void;
  onSuccess: (result: FlowSuccess) => void;
}) {
  const [step, setStep] = React.useState<Step>("locate");
  const [errorMsg, setErrorMsg] = React.useState("");
  const [doneAt, setDoneAt] = React.useState("");
  const [outsideM, setOutsideM] = React.useState<number | null>(null);
  const [reasonChoice, setReasonChoice] = React.useState("");
  const [reasonOther, setReasonOther] = React.useState("");
  const geo = useGeolocation();
  const geoRequest = geo.request;

  const prevOpenRef = React.useRef(false);
  const submittedRef = React.useRef(false);

  React.useEffect(() => {
    if (open && !prevOpenRef.current) {
      setErrorMsg("");
      setDoneAt("");
      setOutsideM(null);
      setReasonChoice("");
      setReasonOther("");
      setStep("locate");
      submittedRef.current = false;
    }
    prevOpenRef.current = open;
  }, [open]);

  React.useEffect(() => {
    if (open && step === "locate") geoRequest();
  }, [open, step, geoRequest]);

  const submit = React.useCallback(async (outsideReason?: string) => {
    if (!geo.position || submittedRef.current) return;
    submittedRef.current = true;
    setStep("submitting");
    const { lat, lng, accuracy } = geo.position;
    const res =
      mode === "in"
        ? await officeCheckInAction({ lat, lng, accuracy, outsideReason })
        : await officeCheckOutAction({ lat, lng, accuracy, outsideReason });
    if (res.error) {
      submittedRef.current = false;
      // The server found us outside the office fence (e.g. stale fence data
      // here) and we may punch away — ask for a reason.
      if (res.outsideDistanceM != null && !outsideReason) {
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
    onSuccess({ at, projectId: "", lat, lng });
  }, [geo.position, mode, onSuccess]);

  // Fail fast on the client-side fence check (or, for client visits, ask for
  // a reason); otherwise submit immediately — true one-tap, no confirm screen
  // (there's no selfie to review).
  React.useEffect(() => {
    if (!open || step !== "locate" || geo.status !== "success" || !geo.position) return;
    if (clientVisitsAllowed) {
      const distance = outsideOfficeDistance(officeGeofence, geo.position);
      if (distance != null) {
        setOutsideM(distance);
        setStep("reason");
        return;
      }
    } else {
      const fence = clientFenceError(officeGeofence, geo.position);
      if (fence) {
        setErrorMsg(fence);
        setStep("error");
        return;
      }
    }
    submit();
  }, [open, step, geo.status, geo.position, officeGeofence, clientVisitsAllowed, submit]);

  const title = mode === "in" ? "Punch In" : "Punch Out";
  const outsideReason = reasonChoice === OTHER_REASON ? reasonOther.trim() : reasonChoice;

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

      {step === "reason" && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p>
              You are about <span className="font-semibold">{formatMeters(outsideM ?? 0)}</span> from the office. You
              can still punch {mode} — tell us why you&apos;re away from the office. Admin/HR will see this with your
              location.
            </p>
          </div>
          <div className="grid gap-2">
            {[...AWAY_REASONS, OTHER_REASON].map((r) => (
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
            <Button className="h-12" disabled={!outsideReason} onClick={() => submit(outsideReason)}>
              {mode === "in" ? "Punch In" : "Punch Out"}
            </Button>
          </div>
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

const AWAY_REASONS = ["Client meeting", "Client site visit", "Vendor / supplier meeting"];
const OTHER_REASON = "Other";

function formatMeters(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}
