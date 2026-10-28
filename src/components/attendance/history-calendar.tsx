"use client";

import * as React from "react";
import {
  autoLeaveLabel,
  daysOfMonth,
  dayStatus,
  evaluateEmployeeMonthAttendance,
  formatDuration,
  formatTime,
  isHolidayFor,
  missedAbsentReason,
  orgToday,
  SUNDAY_OFF,
  type OrgHoliday,
  type WeekOffRule,
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
  holidays = [],
  weekOff = SUNDAY_OFF,
  startDate,
}: {
  records: EmployeeAttendance[];
  month: string;
  isOffice?: boolean;
  holidays?: OrgHoliday[];
  weekOff?: WeekOffRule;
  startDate?: string;
}) {
  const [selected, setSelected] = React.useState<EmployeeAttendance | null>(null);

  const evalResult = React.useMemo(
    () => evaluateEmployeeMonthAttendance(records, month, isOffice, holidays, weekOff, undefined, startDate),
    [records, month, isOffice, holidays, weekOff, startDate]
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
          const isDeclared = isHolidayFor(date, holidays, isOffice);
          // explicit_absent/declared_holiday have a real row, so dayStatus()
          // (which only knows "does a row exist") would otherwise call them present.
          const status =
            ev?.creditType === "explicit_absent"
              ? "absent"
              : ev?.creditType === "declared_holiday"
              ? "holiday"
              : dayStatus(date, Boolean(record), orgToday(), isDeclared, weekOff, evalResult.weekOffDates);
          // A declared holiday on a weekly off reads as Holiday, not Week Off.
          const isWeekOff = status === "holiday" && !isDeclared && evalResult.weekOffDates.has(date);
          const dayNum = Number(date.slice(-2));

          const isHalfDay = ev?.creditType === "explicit_half_day";
          const isUnpaidLeave = ev?.creditType === "leave_unpaid";
          // Office staff: the month's only missed working day (no record) is paid Leave, not Absent.
          const autoLeave = record ? null : autoLeaveLabel(evalResult, date);
          const absentReason = record ? null : missedAbsentReason(evalResult, date);

          return (
            <button
              key={date}
              type="button"
              disabled={!record}
              onClick={() => record && setSelected(record)}
              title={ev?.reason || autoLeave?.reason || absentReason || (isWeekOff ? "Week Off" : undefined)}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg text-sm tabular-nums transition-colors",
                status === "present" && !isHalfDay && !isUnpaidLeave && "bg-success/15 font-medium text-success hover:bg-success/25",
                status === "present" && isHalfDay && "bg-orange-500/25 font-bold text-orange-900 dark:text-orange-300 hover:bg-orange-500/35 border border-orange-400/40",
                status === "present" && isUnpaidLeave && "bg-destructive/10 text-destructive hover:bg-destructive/20",
                status === "absent" && !autoLeave && "bg-destructive/10 text-destructive",
                autoLeave && "bg-blue-500/20 font-medium text-blue-700 dark:text-blue-300",
                status === "holiday" && "bg-muted text-muted-foreground",
                status === "future" && "text-muted-foreground/50"
              )}
            >
              <span>{dayNum}</span>
              {isWeekOff && <span className="text-[9px] font-semibold leading-none">Week Off</span>}
              {autoLeave && <span className="text-[9px] font-semibold leading-none">LV</span>}
              {ev && record && status !== "holiday" && (
                <span className="text-[9px] font-semibold leading-none">
                  {isHalfDay ? "HD (0.5)" : isUnpaidLeave ? "A" : record.totalMinutes > 0 ? formatDuration(record.totalMinutes) : "P"}
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
        {/* An unpaid Leave is shown as Absent, so there's no separate legend entry for it. */}
        {isOffice && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500/70" /> Leave (incl. missed day)
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" /> Absent
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" /> Holiday / Week Off
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
