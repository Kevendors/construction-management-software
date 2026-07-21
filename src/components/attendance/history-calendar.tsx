"use client";

import * as React from "react";
import { daysOfMonth, dayStatus, formatDuration } from "@/lib/attendance/compute";
import { cn } from "@/lib/utils";
import type { EmployeeAttendance } from "@/lib/types";
import { RecordDetailDialog } from "./record-detail-dialog";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Month grid (weeks starting Monday, Sundays = holiday column). Days with a
 * record open the detail dialog.
 */
export function HistoryCalendar({
  records,
  month,
}: {
  records: EmployeeAttendance[];
  month: string;
}) {
  const [selected, setSelected] = React.useState<EmployeeAttendance | null>(null);
  const byDate = new Map(records.map((r) => [r.date, r]));
  const days = daysOfMonth(month);
  // Monday-first offset: getDay() is 0=Sun..6=Sat.
  const firstDow = new Date(`${days[0]}T00:00:00`).getDay();
  const leadingBlanks = (firstDow + 6) % 7;

  return (
    <>
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1 text-center text-[11px] font-medium text-muted-foreground">
            {d}
          </div>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {days.map((date) => {
          const record = byDate.get(date);
          const status = dayStatus(date, Boolean(record));
          const dayNum = Number(date.slice(-2));
          return (
            <button
              key={date}
              type="button"
              disabled={!record}
              onClick={() => record && setSelected(record)}
              className={cn(
                "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg text-sm tabular-nums transition-colors",
                status === "present" && "bg-success/15 font-medium text-success hover:bg-success/25",
                status === "absent" && "bg-destructive/10 text-destructive",
                status === "holiday" && "bg-muted text-muted-foreground",
                status === "future" && "text-muted-foreground/50"
              )}
            >
              {dayNum}
              {record && record.totalMinutes > 0 && (
                <span className="text-[9px] leading-none opacity-80">
                  {formatDuration(record.totalMinutes)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-success/60" /> Present
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/50" /> Absent
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" /> Holiday (Sunday)
        </span>
      </div>

      {selected && <RecordDetailDialog record={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
