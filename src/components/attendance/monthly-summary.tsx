"use client";

import { Info } from "lucide-react";
import { monthlySummary } from "@/lib/attendance/compute";
import type { EmployeeAttendance } from "@/lib/types";

/** Present / Half Day / Late / Absent / Holiday counts for the viewed month. */
export function MonthlySummary({
  records,
  month,
}: {
  records: EmployeeAttendance[];
  month: string;
}) {
  const summary = monthlySummary(records, month);

  const chips = [
    { label: "Full Present", value: String(summary.present), hint: "1.0 day credit", className: "bg-success/15 text-success" },
    { label: "Half Days", value: String(summary.halfDay), hint: "0.5 day credit", className: summary.halfDay > 0 ? "bg-amber-500/20 text-amber-700 dark:text-amber-400 font-semibold" : "bg-muted text-muted-foreground" },
    { label: "Late Arrivals", value: `${summary.lateGraceUsed}/3`, hint: "allowed ≤10:15 AM", className: summary.lateCount >= 3 ? "bg-orange-500/20 text-orange-700 dark:text-orange-400 font-semibold" : "bg-muted text-muted-foreground" },
    { label: "Effective Paid", value: `${summary.effectivePaidDays}d`, hint: "salary credit", className: "bg-primary/10 text-primary font-semibold" },
    { label: "Absent", value: String(summary.absent), hint: "unexcused", className: summary.absent > 0 ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground" },
    { label: "Holiday", value: String(summary.holiday), hint: "Sundays", className: "bg-muted text-muted-foreground" },
  ];

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {chips.map((c) => (
          <div key={c.label} className={`rounded-lg p-2.5 text-center ${c.className}`}>
            <p className="text-lg font-bold tabular-nums">{c.value}</p>
            <p className="text-[11px] font-medium leading-tight">{c.label}</p>
            {c.hint && <p className="text-[10px] opacity-75">{c.hint}</p>}
          </div>
        ))}
      </div>

      <div className="flex items-start gap-1.5 rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
        <div>
          <span className="font-medium text-foreground">Attendance &amp; Late Policy: </span>
          Standard shift is <strong>9:30 AM – 6:00 PM</strong>. Up to <strong>3 late arrivals</strong> allowed until <strong>10:15 AM</strong> per month. The 4th late arrival onward (or arrival after 10:15 AM) is counted as a <strong>Half Day (0.5 paid day)</strong>.
        </div>
      </div>
    </div>
  );
}
