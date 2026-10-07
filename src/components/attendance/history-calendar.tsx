"use client";

import * as React from "react";
import {
  daysOfMonth,
  dayStatus,
  evaluateEmployeeMonthAttendance,
  formatDuration,
  formatTime,
} from "@/lib/attendance/compute";
import { cn } from "@/lib/utils";
import type { EmployeeAttendance } from "@/lib/types";
import { RecordDetailDialog } from "./record-detail-dialog";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Month grid with late policy and half day indicators.
 */
export function HistoryCalendar({
  records,
  month,
}: {
  records: EmployeeAttendance[];
  month: string;
}) {
  const [selected, setSelected] = React.useState<EmployeeAttendance | null>(null);

  const evalResult = React.useMemo(
    () => evaluateEmployeeMonthAttendance(records, month),
    [records, month]
  );

  const days = daysOfMonth(month);
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
          const ev = evalResult.recordMap.get(date);
          const record = ev?.record;
          const status = dayStatus(date, Boolean(record));
          const dayNum = Number(date.slice(-2));

          const isGraceLate = ev?.creditType === "late_grace";
          const isHalfDay = ev?.creditType === "late_half_day" || ev?.creditType === "late_cutoff_half_day";

          return (
            <button
              key={date}
              type="button"
              disabled={!record}
              onClick={() => record && setSelected(record)}
              title={ev?.reason || undefined}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg text-sm tabular-nums transition-colors",
                status === "present" && !isGraceLate && !isHalfDay && "bg-success/15 font-medium text-success hover:bg-success/25",
                status === "present" && isGraceLate && "bg-amber-500/20 font-medium text-amber-800 dark:text-amber-400 hover:bg-amber-500/30",
                status === "present" && isHalfDay && "bg-orange-500/25 font-bold text-orange-900 dark:text-orange-300 hover:bg-orange-500/35 border border-orange-400/40",
                status === "absent" && "bg-destructive/10 text-destructive",
                status === "holiday" && "bg-muted text-muted-foreground",
                status === "future" && "text-muted-foreground/50"
              )}
            >
              <span>{dayNum}</span>
              {ev && record && (
                <span className="text-[9px] font-semibold leading-none">
                  {isHalfDay ? "HD (0.5)" : isGraceLate ? `L (${ev.lateIndex})` : record.totalMinutes > 0 ? formatDuration(record.totalMinutes) : "P"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-success/70" /> Present (1.0d)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Late Grace (1-3 allowed)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-orange-600" /> Half Day (4th late / &gt;10:15)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" /> Absent
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" /> Holiday
        </span>
      </div>

      {selected && (
        <RecordDetailDialog
          record={selected}
          evaluated={evalResult.recordMap.get(selected.date)}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
