"use client";

import * as React from "react";
import { Download, Eye, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  dayStatus,
  daysOfMonth,
  formatDuration,
  formatTime,
  monthlySummary,
  orgThisMonth,
  orgToday,
  type AttendanceAdminBoard,
} from "@/lib/attendance/compute";
import type { EmployeeAttendance, Project } from "@/lib/types";
import { RecordDetailDialog } from "./record-detail-dialog";

function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [header, ...rows].map((r) => r.map(escape).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Org-wide employee attendance dashboard (Payroll → Attendance, admin/hr). */
export function AdminAttendanceTab({
  board,
  projects,
}: {
  board: AttendanceAdminBoard;
  projects: Project[];
}) {
  const [view, setView] = React.useState<"daily" | "monthly">("daily");
  const [date, setDate] = React.useState(orgToday());
  const [month, setMonth] = React.useState(orgThisMonth());
  const [search, setSearch] = React.useState("");
  const [projectId, setProjectId] = React.useState("");
  const [selected, setSelected] = React.useState<EmployeeAttendance | null>(null);

  const projectById = new Map(projects.map((p) => [p.id, p]));
  const q = search.trim().toLowerCase();
  const members = board.members.filter(
    (m) => !q || m.name.toLowerCase().includes(q) || m.employeeId.toLowerCase().includes(q)
  );

  const recordFor = (userId: string, d: string) =>
    board.records.find((r) => r.userId === userId && r.date === d);

  /* ---- daily view rows: one per member, "Missed" when no record ---- */
  const dailyRows = members
    .map((m) => ({ member: m, record: recordFor(m.userId, date) }))
    .filter((r) => !projectId || r.record?.projectId === projectId);

  /* ---- monthly matrix ---- */
  const monthDays = daysOfMonth(month);
  const monthlyRows = members
    .map((m) => {
      const recs = board.records.filter(
        (r) => r.userId === m.userId && r.date.startsWith(month) && (!projectId || r.projectId === projectId)
      );
      return { member: m, records: recs, summary: monthlySummary(recs, month) };
    })
    .filter((r) => !projectId || r.records.length > 0);

  function exportCsv() {
    if (view === "daily") {
      downloadCsv(
        `attendance-${date}.csv`,
        ["Date", "Employee", "Employee ID", "Project", "Check In", "Check Out", "Hours", "Overtime", "Status"],
        dailyRows.map(({ member, record }) => [
          date,
          member.name,
          member.employeeId || "—",
          record ? projectById.get(record.projectId)?.name ?? "" : "",
          record ? formatTime(record.checkInAt) : "",
          record ? formatTime(record.checkOutAt) : "",
          record && record.totalMinutes > 0 ? formatDuration(record.totalMinutes) : "",
          record && record.overtimeMinutes > 0 ? formatDuration(record.overtimeMinutes) : "",
          record ? "Present" : "Missed",
        ])
      );
    } else {
      downloadCsv(
        `attendance-${month}.csv`,
        ["Employee", "Employee ID", "Present", "Absent", "Holiday", "Overtime"],
        monthlyRows.map(({ member, records, summary }) => [
          member.name,
          member.employeeId || "—",
          summary.present,
          summary.absent,
          summary.holiday,
          formatDuration(records.reduce((s, r) => s + r.overtimeMinutes, 0)),
        ])
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-border p-0.5">
          <Button
            size="sm"
            variant={view === "daily" ? "secondary" : "ghost"}
            onClick={() => setView("daily")}
          >
            Daily
          </Button>
          <Button
            size="sm"
            variant={view === "monthly" ? "secondary" : "ghost"}
            onClick={() => setView("monthly")}
          >
            Monthly
          </Button>
        </div>
        {view === "daily" ? (
          <Input
            type="date"
            value={date}
            max={orgToday()}
            onChange={(e) => setDate(e.target.value)}
            className="w-40"
          />
        ) : (
          <Input
            type="month"
            value={month}
            max={orgThisMonth()}
            onChange={(e) => setMonth(e.target.value)}
            className="w-44"
          />
        )}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name / ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-44 pl-8"
          />
        </div>
        <Select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="w-auto min-w-40"
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} · {p.name}
            </option>
          ))}
        </Select>
        <Button size="sm" variant="outline" className="ml-auto" onClick={exportCsv}>
          <Download /> Export CSV
        </Button>
      </div>

      {view === "daily" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Daily Attendance —{" "}
              {new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
                weekday: "short",
                day: "2-digit",
                month: "short",
              })}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>In</TableHead>
                    <TableHead>Out</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">OT</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                        No members match the filters.
                      </TableCell>
                    </TableRow>
                  )}
                  {dailyRows.map(({ member, record }) => (
                    <TableRow key={member.userId}>
                      <TableCell className="font-medium">{member.name}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {member.employeeId || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {record ? projectById.get(record.projectId)?.name ?? "—" : "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {record ? formatTime(record.checkInAt) : "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {record ? formatTime(record.checkOutAt) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {record && record.totalMinutes > 0 ? formatDuration(record.totalMinutes) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {record && record.overtimeMinutes > 0
                          ? formatDuration(record.overtimeMinutes)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {record ? (
                          <Badge variant="success">Present</Badge>
                        ) : dayStatus(date, false) === "holiday" ? (
                          <Badge variant="muted">Holiday</Badge>
                        ) : (
                          <Badge variant="destructive">Missed</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {record && (
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="View details"
                            onClick={() => setSelected(record)}
                          >
                            <Eye />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {view === "monthly" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Monthly Attendance —{" "}
              {new Date(`${month}-01T00:00:00`).toLocaleDateString("en-IN", {
                month: "long",
                year: "numeric",
              })}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="sticky left-0 bg-card py-2 pr-3 text-left font-medium">Employee</th>
                    {monthDays.map((d) => (
                      <th key={d} className="min-w-6 px-0.5 py-2 text-center font-normal tabular-nums">
                        {Number(d.slice(-2))}
                      </th>
                    ))}
                    <th className="py-2 pl-3 text-right font-medium">P / A</th>
                    <th className="py-2 pl-3 text-right font-medium">OT</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyRows.map(({ member, records, summary }) => {
                    const byDate = new Map(records.map((r) => [r.date, r]));
                    return (
                      <tr key={member.userId} className="border-b border-border/60">
                        <td className="sticky left-0 whitespace-nowrap bg-card py-1.5 pr-3 font-medium">
                          {member.name}
                        </td>
                        {monthDays.map((d) => {
                          const record = byDate.get(d);
                          const status = dayStatus(d, Boolean(record));
                          const glyph =
                            status === "present" ? "P" : status === "absent" ? "A" : status === "holiday" ? "H" : "";
                          return (
                            <td
                              key={d}
                              className={
                                status === "present"
                                  ? "cursor-pointer px-0.5 py-1.5 text-center font-medium text-success"
                                  : status === "absent"
                                    ? "px-0.5 py-1.5 text-center text-destructive"
                                    : "px-0.5 py-1.5 text-center text-muted-foreground/60"
                              }
                              onClick={() => record && setSelected(record)}
                            >
                              {glyph}
                            </td>
                          );
                        })}
                        <td className="py-1.5 pl-3 text-right tabular-nums">
                          <span className="text-success">{summary.present}</span>
                          {" / "}
                          <span className="text-destructive">{summary.absent}</span>
                        </td>
                        <td className="py-1.5 pl-3 text-right tabular-nums">
                          {formatDuration(records.reduce((s, r) => s + r.overtimeMinutes, 0))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {selected && (
        <RecordDetailDialog record={selected} onClose={() => setSelected(null)} showName />
      )}
    </div>
  );
}
