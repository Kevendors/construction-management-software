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
 * Month grid with half day / unpaid leave indicators.
 */
export function HistoryCalendar({
  records,
  month,
  isOffice = false,
}: {
  records: EmployeeAttendance[];
  month: string;
  isOffice?: boolean;
}) {
  const [selected, setSelected] = React.useState<EmployeeAttendance | null>(null);

  const evalResult = React.useMemo(
    () => evaluateEmployeeMonthAttendance(records, month, isOffice),
    [records, month, isOffice]
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

          const isHalfDay = ev?.creditType === "explicit_half_day";
          const isUnpaidLeave = ev?.creditType === "leave_unpaid";

          return (
            <button
              key={date}
              type="button"
              disabled={!record}
              onClick={() => record && setSelected(record)}
              title={ev?.reason || undefined}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg text-sm tabular-nums transition-colors",
                status === "present" && !isHalfDay && !isUnpaidLeave && "bg-success/15 font-medium text-success hover:bg-success/25",
                status === "present" && isHalfDay && "bg-orange-500/25 font-bold text-orange-900 dark:text-orange-300 hover:bg-orange-500/35 border border-orange-400/40",
                status === "present" && isUnpaidLeave && "bg-slate-500/20 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-500/30 border border-slate-400/40",
                status === "absent" && "bg-destructive/10 text-destructive",
                status === "holiday" && "bg-muted text-muted-foreground",
                status === "future" && "text-muted-foreground/50"
              )}
            >
              <span>{dayNum}</span>
              {ev && record && (
                <span className="text-[9px] font-semibold leading-none">
                  {isHalfDay ? "HD (0.5)" : isUnpaidLeave ? "LU (0)" : record.totalMinutes > 0 ? formatDuration(record.totalMinutes) : "P"}
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
          <span className="h-2.5 w-2.5 rounded-full bg-orange-600" /> Half Day (manual, 0.5d)
        </span>
        {isOffice && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-500" /> Leave (Unpaid, 2nd+/mo)
          </span>
        )}
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
