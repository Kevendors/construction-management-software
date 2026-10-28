"use client";

import { Info } from "lucide-react";
import { monthlySummary, SITE_UNPAID_LEAVE_FROM, SUNDAY_OFF, type OrgHoliday, type WeekOffRule } from "@/lib/attendance/compute";
import type { EmployeeAttendance } from "@/lib/types";

/** Present / Half Day / Leave / Absent / Holiday / Week Off counts for the viewed month. */
export function MonthlySummary({
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
  const summary = monthlySummary(records, month, undefined, holidays, isOffice, weekOff, startDate);
  // Site staff have no paid leave from SITE_UNPAID_LEAVE_FROM; earlier months keep the old wording.
  const siteNoPaidLeave = !isOffice && month >= SITE_UNPAID_LEAVE_FROM.slice(0, 7);

  const chips = [
    { label: "Full Present", value: String(summary.present), hint: "1.0 day credit", className: "bg-success/15 text-success" },
    { label: "Half Days", value: String(summary.halfDay), hint: "0.5 day credit", className: summary.halfDay > 0 ? "bg-amber-500/20 text-amber-700 dark:text-amber-400 font-semibold" : "bg-muted text-muted-foreground" },
    { label: "Effective Paid", value: `${summary.effectivePaidDays}d`, hint: "salary credit", className: "bg-primary/10 text-primary font-semibold" },
    { label: "Absent", value: String(summary.absent), hint: "unexcused", className: summary.absent > 0 ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground" },
    { label: "Holiday", value: String(summary.holiday), hint: "declared, paid", className: "bg-muted text-muted-foreground" },
    { label: "Week Off", value: String(summary.weekOff), hint: "weekly off", className: "bg-muted text-muted-foreground" },
  ];

  return (
    <div className="space-y-2.5">
      <div className={`grid grid-cols-3 gap-2 sm:grid-cols-6`}>
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
          <span className="font-medium text-foreground">Attendance Policy: </span>
          Shift runs until <strong>6:00 PM</strong>. Checking in after <strong>10:30 AM</strong> counts as a late arrival — the first 3 in a calendar month still credit a full paid day; the 4th and later auto-marks that day Half-Day. A Super Admin can also mark a day Half-Day/Absent by hand for any other reason.
          {isOffice && (
            <>
              {" "}Office staff get <strong>1 paid Leave per month</strong> — a missed working day counts as Leave automatically; taking a 2nd day off (missed, Leave or Absent) makes them all unpaid, shown as Absent.
            </>
          )}
          {siteNoPaidLeave && <>{" "}Site staff have <strong>no paid leave</strong> — a Leave day is unpaid and shown as Absent.</>}
        </div>
      </div>
    </div>
  );
}
