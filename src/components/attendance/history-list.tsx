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
import { formatDuration, formatTime } from "@/lib/attendance/compute";
import type { EmployeeAttendance } from "@/lib/types";
import { RecordDetailDialog } from "./record-detail-dialog";

/** List view of the month's records with a from/to date filter. */
export function HistoryList({ records }: { records: EmployeeAttendance[] }) {
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [selected, setSelected] = React.useState<EmployeeAttendance | null>(null);

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
            <TableHead className="text-right">OT</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                No attendance in this range.
              </TableCell>
            </TableRow>
          )}
          {rows.map((r) => (
            <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
              <TableCell className="tabular-nums">
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
              <TableCell className="text-right">
                {r.overtimeMinutes > 0 ? (
                  <Badge variant="warning">{formatDuration(r.overtimeMinutes)}</Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {selected && <RecordDetailDialog record={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
