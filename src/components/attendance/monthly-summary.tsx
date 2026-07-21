"use client";

import { monthlySummary } from "@/lib/attendance/compute";
import type { EmployeeAttendance } from "@/lib/types";

/** Present / Absent / Holiday counts for the viewed month. */
export function MonthlySummary({
  records,
  month,
}: {
  records: EmployeeAttendance[];
  month: string;
}) {
  const summary = monthlySummary(records, month);
  const chips = [
    { label: "Present", value: summary.present, className: "bg-success/15 text-success" },
    { label: "Absent", value: summary.absent, className: "bg-destructive/15 text-destructive" },
    { label: "Holiday", value: summary.holiday, className: "bg-muted text-muted-foreground" },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {chips.map((c) => (
        <div key={c.label} className={`rounded-lg p-3 text-center ${c.className}`}>
          <p className="text-xl font-bold tabular-nums">{c.value}</p>
          <p className="text-xs font-medium">{c.label}</p>
        </div>
      ))}
    </div>
  );
}
