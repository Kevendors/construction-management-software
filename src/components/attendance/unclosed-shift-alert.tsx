"use client";

import * as React from "react";
import { AlertCircle, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/attendance/compute";
import type { EmployeeAttendance } from "@/lib/types";
import { closePreviousShiftAction } from "@/app/attendance/actions";
import { useRouter } from "next/navigation";

export function UnclosedShiftAlert({
  shift,
  onResolved,
}: {
  shift: EmployeeAttendance;
  onResolved?: () => void;
}) {
  const router = useRouter();
  const [closing, setClosing] = React.useState(false);
  const [customTime, setCustomTime] = React.useState("18:00");
  const [showCustom, setShowCustom] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleClose(time?: string) {
    setClosing(true);
    setError(null);
    const res = await closePreviousShiftAction({
      recordId: shift.id,
      checkOutTime: time || undefined,
    });
    setClosing(false);
    if (res.error) {
      setError(res.error);
    } else {
      if (onResolved) onResolved();
      router.refresh();
    }
  }

  return (
    <div className="rounded-xl border border-amber-400/50 bg-amber-500/10 p-4 text-foreground shadow-xs">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
        <div className="flex-1 space-y-2">
          <div>
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
              Unclosed Shift from {shift.date}
            </p>
            <p className="text-xs text-amber-800/90 dark:text-amber-400/90 mt-0.5">
              You checked in at <span className="font-semibold">{formatTime(shift.checkInAt)}</span> but did not check out. Standard shift ended at 6:00 PM (18:00).
            </p>
          </div>

          {error && <p className="text-xs font-medium text-destructive">{error}</p>}

          {!showCustom ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="accent"
                disabled={closing}
                onClick={() => handleClose()}
                className="h-8 text-xs cursor-pointer"
              >
                {closing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
                Close Shift (Standard 18:00)
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={closing}
                onClick={() => setShowCustom(true)}
                className="h-8 text-xs cursor-pointer"
              >
                Specify Checkout Time
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              />
              <Button
                size="sm"
                variant="accent"
                disabled={closing || !customTime}
                onClick={() => handleClose(customTime)}
                className="h-8 text-xs cursor-pointer"
              >
                {closing && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                Confirm
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={closing}
                onClick={() => setShowCustom(false)}
                className="h-8 text-xs cursor-pointer"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
