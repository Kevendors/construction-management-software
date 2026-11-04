"use client";

import { AlertCircle } from "lucide-react";
import { formatTime } from "@/lib/attendance/compute";
import type { EmployeeAttendance } from "@/lib/types";

const longDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

/**
 * Read-only notice of a missed check-out on an earlier date. Employees can't
 * close it themselves: Super Admin/HR correct it from the admin attendance tab
 * ("Close Shift").
 */
export function UnclosedShiftAlert({ shift }: { shift: EmployeeAttendance }) {
  return (
    <div className="rounded-xl border border-amber-400/50 bg-amber-500/10 p-4 text-foreground shadow-xs">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
            Missed check-out on {longDate(shift.date)}
          </p>
          <p className="text-xs text-amber-800/90 dark:text-amber-400/90 mt-0.5">
            You checked in at <span className="font-semibold">{formatTime(shift.checkInAt)}</span> but did not check out.
            This is pending review by HR, who will correct it.
          </p>
        </div>
      </div>
    </div>
  );
}
