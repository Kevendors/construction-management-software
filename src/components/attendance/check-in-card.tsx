"use client";

import * as React from "react";
import { CheckCircle2, Fingerprint, LogOut, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDuration, formatTime, minutesBetween } from "@/lib/attendance/compute";
import type { EmployeeAttendance } from "@/lib/types";

/** Big mobile-first status card: Mark Attendance → live session → day done. */
export function CheckInCard({
  today,
  hasProjects,
  onStart,
}: {
  today: EmployeeAttendance | null;
  hasProjects: boolean;
  onStart: (mode: "in" | "out") => void;
}) {
  const isOpen = Boolean(today && !today.checkOutAt);
  // Tick every 30s so the elapsed time stays live while checked in.
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, [isOpen]);

  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        {!today && (
          <>
            <div>
              <p className="text-sm font-medium">Today&apos;s Attendance</p>
              <p className="text-xs text-muted-foreground">
                Not marked yet — check in with a live selfie and GPS.
              </p>
            </div>
            {hasProjects ? (
              <Button className="h-14 w-full text-base" onClick={() => onStart("in")}>
                <Fingerprint className="!size-5" /> Mark Attendance
              </Button>
            ) : (
              <div className="flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-sm">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <span>
                  You&apos;re not assigned to a project yet — ask your admin to add you from the
                  project&apos;s Team tab.
                </span>
              </div>
            )}
          </>
        )}

        {today && isOpen && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  Checked in at <span className="tabular-nums">{formatTime(today.checkInAt)}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Working {formatDuration(minutesBetween(today.checkInAt, new Date().toISOString()))}
                </p>
              </div>
              <Badge variant="success">Present</Badge>
            </div>
            <Button variant="accent" className="h-14 w-full text-base" onClick={() => onStart("out")}>
              <LogOut className="!size-5" /> Check Out
            </Button>
          </>
        )}

        {today && !isOpen && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <p className="text-sm font-medium">Attendance complete for today</p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-secondary p-3">
                <p className="text-xs text-muted-foreground">In</p>
                <p className="text-sm font-semibold tabular-nums">{formatTime(today.checkInAt)}</p>
              </div>
              <div className="rounded-lg bg-secondary p-3">
                <p className="text-xs text-muted-foreground">Out</p>
                <p className="text-sm font-semibold tabular-nums">{formatTime(today.checkOutAt)}</p>
              </div>
              <div className="rounded-lg bg-secondary p-3">
                <p className="text-xs text-muted-foreground">Hours</p>
                <p className="text-sm font-semibold tabular-nums">
                  {formatDuration(today.totalMinutes)}
                </p>
              </div>
            </div>
            {today.overtimeMinutes > 0 && (
              <Badge variant="warning">Overtime {formatDuration(today.overtimeMinutes)}</Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
