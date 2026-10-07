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
  evaluateEmployeeMonthAttendance,
  formatDuration,
  formatTime,
  type EvaluatedAttendanceRecord,
} from "@/lib/attendance/compute";
import type { EmployeeAttendance } from "@/lib/types";
import { RecordDetailDialog } from "./record-detail-dialog";

/** List view of the month's records with a from/to date filter and late policy badges. */
export function HistoryList({ records }: { records: EmployeeAttendance[] }) {
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [selected, setSelected] = React.useState<EmployeeAttendance | null>(null);

  const evalMap = React.useMemo(() => {
    const months = new Set(records.map((r) => r.date.slice(0, 7)));
    const map = new Map<string, EvaluatedAttendanceRecord>();
    for (const m of months) {
      const res = evaluateEmployeeMonthAttendance(records, m);
      for (const [d, ev] of res.recordMap) {
        map.set(d, ev);
      }
    }
    return map;
  }, [records]);

  const rows = records.filter((r) => (!from || r.date >= from) && (!to || r.date <= to));

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
          {rows.map((r) => {
            const ev = evalMap.get(r.date);
            return (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                <TableCell className="tabular-nums font-medium">
                  {new Date(`${r.date}T00:00:00`).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                  })}
                </TableCell>
                <TableCell className="tabular-nums">{formatTime(r.checkInAt)}</TableCell>
                <TableCell className="tabular-nums">{formatTime(r.checkOutAt)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.totalMinutes > 0 ? formatDuration(r.totalMinutes) : "—"}
                </TableCell>
                <TableCell>
                  {ev ? (
                    ev.creditType === "on_time" ? (
                      <Badge variant="success">Present</Badge>
                    ) : ev.creditType === "late_grace" ? (
                      <Badge variant="warning">{ev.badgeLabel}</Badge>
                    ) : ev.creditType === "late_half_day" || ev.creditType === "late_cutoff_half_day" ? (
                      <Badge variant="warning" className="border-amber-400 bg-amber-500/15 text-amber-800 dark:text-amber-400">
                        {ev.badgeLabel}
                      </Badge>
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
