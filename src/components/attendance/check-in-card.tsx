"use client";

import * as React from "react";
import { ArrowRightLeft, Building2, CheckCircle2, Fingerprint, LogOut, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDuration, formatTime, minutesBetween } from "@/lib/attendance/compute";
import type { EmployeeAttendance } from "@/lib/types";
import type { FlowMode } from "./check-in-flow";

/** Big mobile-first status card: punch in → live session → day done. */
export function CheckInCard({
  today,
  usesSiteFlow,
  currentSite = null,
  canSwitchSite = false,
  onStart,
}: {
  today: EmployeeAttendance | null;
  /** True = site flow (project + GPS + selfie). False = office flow (one-tap GPS only). */
  usesSiteFlow: boolean;
  /** Open site shift: where the employee is now (latest Switch Site, else the check-in project). */
  currentSite?: { name: string; since: string } | null;
  /** Show the "Switch Site" button (open self site shift, Site staff only). */
  canSwitchSite?: boolean;
  onStart: (mode: FlowMode) => void;
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
                {usesSiteFlow
                  ? "Not marked yet — check in with a live selfie and GPS."
                  : "Not marked yet — punch in with your live location."}
              </p>
            </div>
            {usesSiteFlow ? (
              <Button className="h-14 w-full text-base" onClick={() => onStart("in")}>
                <Fingerprint className="!size-5" /> Mark Attendance
              </Button>
            ) : (
              <Button className="h-14 w-full text-base" onClick={() => onStart("in")}>
                <Building2 className="!size-5" /> Punch In
              </Button>
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
            {currentSite && (
              <p className="flex items-center gap-1.5 text-sm">
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>
                  Current site: <span className="font-medium">{currentSite.name}</span>{" "}
                  <span className="text-muted-foreground">
                    since <span className="tabular-nums">{formatTime(currentSite.since)}</span>
                  </span>
                </span>
              </p>
            )}
            {canSwitchSite ? (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="h-14 text-base" onClick={() => onStart("switch")}>
                  <ArrowRightLeft className="!size-5" /> Switch Site
                </Button>
                <Button variant="accent" className="h-14 text-base" onClick={() => onStart("out")}>
                  <LogOut className="!size-5" /> Check Out
                </Button>
              </div>
            ) : (
              <Button variant="accent" className="h-14 w-full text-base" onClick={() => onStart("out")}>
                <LogOut className="!size-5" /> {usesSiteFlow ? "Check Out" : "Punch Out"}
              </Button>
            )}
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
