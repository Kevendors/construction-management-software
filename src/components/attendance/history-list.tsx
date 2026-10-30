"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  autoLeaveLabel,
  evaluateEmployeeMonthAttendance,
  missedAbsentReason,
  formatDuration,
  formatTime,
  isDeclarativeRecord,
  SUNDAY_OFF,
  type EvaluatedAttendanceRecord,
  type OrgHoliday,
  type WeekOffRule,
} from "@/lib/attendance/compute";
import type { EmployeeAttendance } from "@/lib/types";
import { RecordDetailDialog } from "./record-detail-dialog";

/** A no-record office day: paid Leave (the month's only missed day) or Absent (2+ days off). */
type AutoLeave = { label: "Leave" | "Absent"; glyph: "LV" | "A"; reason: string };
type Row = { kind: "record"; record: EmployeeAttendance } | { kind: "auto"; date: string; label: AutoLeave };

/**
 * List view of the month's records with a from/to date filter and late policy
 * badges. For office staff it also lists missed working days (no record) as
 * Leave (the month's only day off) or Absent (2+); `month` makes sure the viewed month is
 * evaluated even when it has no records yet.
 */
export function HistoryList({
  records,
  month,
  isOffice = false,
  holidays = [],
  weekOff = SUNDAY_OFF,
  startDate,
}: {
  records: EmployeeAttendance[];
  month?: string;
  isOffice?: boolean;
  holidays?: OrgHoliday[];
  weekOff?: WeekOffRule;
  startDate?: string;
}) {
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [selected, setSelected] = React.useState<EmployeeAttendance | null>(null);

  const { evalMap, autoLeaves } = React.useMemo(() => {
    const months = new Set(records.map((r) => r.date.slice(0, 7)));
    if (month) months.add(month);
    const map = new Map<string, EvaluatedAttendanceRecord>();
    const auto: { date: string; label: AutoLeave }[] = [];
    for (const m of months) {
      const res = evaluateEmployeeMonthAttendance(records, m, isOffice, holidays, weekOff, undefined, startDate);
      for (const [d, ev] of res.recordMap) {
        map.set(d, ev);
      }
      for (const d of res.autoLeaveDates) {
        const label = autoLeaveLabel(res, d);
        const absentReason = missedAbsentReason(res, d);
        if (label) auto.push({ date: d, label });
        else if (absentReason) auto.push({ date: d, label: { label: "Absent", glyph: "A", reason: absentReason } });
      }
    }
    return { evalMap: map, autoLeaves: auto };
  }, [records, month, isOffice, holidays, weekOff, startDate]);

  const inRange = (d: string) => (!from || d >= from) && (!to || d <= to);
  // Records and auto-leave days (office staff only) share one list, in the
  // records' own order (newest first) — auto-leave days slot in by date.
  const rows: Row[] = [
    ...records.filter((r) => inRange(r.date)).map((r) => ({ kind: "record" as const, record: r })),
    ...autoLeaves.filter((a) => inRange(a.date)).map((a) => ({ kind: "auto" as const, ...a })),
  ];
  const rowDate = (row: Row) => (row.kind === "record" ? row.record.date : row.date);
  if (autoLeaves.length > 0) rows.sort((a, b) => rowDate(b).localeCompare(rowDate(a)));

  return (
    <>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="hist-from" className="text-xs">From</Label>
          <Input id="hist-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="hist-to" className="text-xs">To</Label>
          <Input id="hist-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>In</TableHead>
            <TableHead>Out</TableHead>
            <TableHead className="text-right">Hours</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">OT</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                No attendance in this range.
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => {
            if (row.kind === "auto") {
              return (
                <TableRow key={`auto-${row.date}`} title={row.label.reason}>
                  <TableCell className="tabular-nums font-medium">
                    {new Date(`${row.date}T00:00:00`).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </TableCell>
                  <TableCell className="tabular-nums">—</TableCell>
                  <TableCell className="tabular-nums">—</TableCell>
                  <TableCell className="text-right tabular-nums">—</TableCell>
                  <TableCell>
                    <Badge
                      variant={row.label.glyph === "A" ? "destructive" : "outline"}
                      className={row.label.glyph === "LV" ? "border-transparent bg-blue-500/20 text-blue-700 dark:text-blue-300" : undefined}
                    >
                      {row.label.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-muted-foreground">—</span>
                  </TableCell>
                </TableRow>
              );
            }
            const r = row.record;
            const ev = evalMap.get(r.date);
            return (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                <TableCell className="tabular-nums font-medium">
                  {new Date(`${r.date}T00:00:00`).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                  })}
                </TableCell>
                <TableCell className="tabular-nums">
                  {/* A self Half-Day (late arrival / early check-out) is a real punch — show it. */}
                  {isDeclarativeRecord(r) ? "—" : formatTime(r.checkInAt)}
                </TableCell>
                <TableCell className="tabular-nums">{formatTime(r.checkOutAt)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.totalMinutes > 0 ? formatDuration(r.totalMinutes) : "—"}
                </TableCell>
                <TableCell>
                  {ev ? (
                    ev.creditType === "on_time" ? (
                      <Badge variant="success">Present</Badge>
                    ) : ev.creditType === "declared_holiday" ? (
                      <Badge variant="muted">Holiday</Badge>
                    ) : ev.creditType === "leave" ? (
                      <Badge variant="success">Leave</Badge>
                    ) : ev.creditType === "leave_unpaid" ? (
                      <Badge variant="destructive">Absent</Badge>
                    ) : ev.creditType === "explicit_half_day" ? (
                      <Badge variant="warning">Half Day</Badge>
                    ) : ev.creditType === "explicit_absent" ? (
                      <Badge variant="destructive">Absent</Badge>
                    ) : (
                      <Badge variant="outline">Manual</Badge>
                    )
                  ) : (
                    <Badge variant="success">Present</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {r.overtimeMinutes > 0 ? (
                    <Badge variant="warning">{formatDuration(r.overtimeMinutes)}</Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {selected && (
        <RecordDetailDialog
          record={selected}
          evaluated={evalMap.get(selected.date)}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
