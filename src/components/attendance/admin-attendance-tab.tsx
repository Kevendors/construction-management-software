"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, Eye, Pencil, Plus, Search, UserPlus } from "lucide-react";
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
  evaluateEmployeeMonthAttendance,
  formatDuration,
  formatTime,
  monthlySummary,
  orgThisMonth,
  orgToday,
  type AttendanceAdminBoard,
} from "@/lib/attendance/compute";
import type { EmployeeAttendance, Project } from "@/lib/types";
import { RecordDetailDialog } from "./record-detail-dialog";
import { AdminMarkAttendanceDialog } from "./admin-mark-attendance-dialog";

interface MarkContext {
  userId?: string;
  date: string;
  existing?: EmployeeAttendance | null;
}

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
  const router = useRouter();
  const [view, setView] = React.useState<"daily" | "monthly" | "employee">("daily");
  // Employee view: one person across a range, rather than one day or one month.
  const [employeeId, setEmployeeId] = React.useState("");
  const [fromDate, setFromDate] = React.useState(`${orgThisMonth()}-01`);
  const [toDate, setToDate] = React.useState(orgToday());
  const [date, setDate] = React.useState(orgToday());
  const [month, setMonth] = React.useState(orgThisMonth());
  const [search, setSearch] = React.useState("");
  const [projectId, setProjectId] = React.useState("");
  const [selected, setSelected] = React.useState<EmployeeAttendance | null>(null);
  const [markContext, setMarkContext] = React.useState<MarkContext | null>(null);

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

  /* ---- employee view: one member's records between two dates ---- */
  const employee = board.members.find((m) => m.userId === employeeId) ?? null;
  const employeeRecords = board.records
    .filter(
      (r) =>
        r.userId === employeeId &&
        r.date >= fromDate &&
        r.date <= toDate &&
        (!projectId || r.projectId === projectId)
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const employeeTotals = employeeRecords.reduce(
    (acc, r) => ({
      days: acc.days + 1,
      minutes: acc.minutes + r.totalMinutes,
      overtime: acc.overtime + r.overtimeMinutes,
    }),
    { days: 0, minutes: 0, overtime: 0 }
  );

  /** Clicking a name in the daily/monthly tables drills into that person. */
  function openEmployee(userId: string) {
    setEmployeeId(userId);
    setView("employee");
  }

  function exportCsv() {
    if (view === "employee") {
      downloadCsv(
        `attendance-${employee?.employeeId || employee?.name || "employee"}-${fromDate}-to-${toDate}.csv`,
        ["Date", "Employee", "Employee ID", "Project", "Check In", "Check Out", "Hours", "Overtime", "Source"],
        employeeRecords.map((r) => [
          r.date,
          employee?.name ?? "",
          employee?.employeeId || "—",
          projectById.get(r.projectId)?.name ?? "",
          formatTime(r.checkInAt),
          formatTime(r.checkOutAt),
          r.totalMinutes > 0 ? formatDuration(r.totalMinutes) : "",
          r.overtimeMinutes > 0 ? formatDuration(r.overtimeMinutes) : "",
          r.source === "admin" ? "Manual" : "Self",
        ])
      );
      return;
    }
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
          <Button
            size="sm"
            variant={view === "employee" ? "secondary" : "ghost"}
            onClick={() => setView("employee")}
          >
            Employee
          </Button>
        </div>
        {view === "daily" && (
          <Input
            type="date"
            value={date}
            max={orgToday()}
            onChange={(e) => setDate(e.target.value)}
            className="w-40"
          />
        )}
        {view === "monthly" && (
          <Input
            type="month"
            value={month}
            max={orgThisMonth()}
            onChange={(e) => setMonth(e.target.value)}
            className="w-44"
          />
        )}
        {view === "employee" && (
          <>
            <Select
              aria-label="Employee"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-auto min-w-48"
            >
              <option value="">Select an employee…</option>
              {board.members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                  {m.employeeId ? ` · ${m.employeeId}` : ""}
                </option>
              ))}
            </Select>
            <Input
              type="date"
              aria-label="From date"
              value={fromDate}
              max={toDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-40"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              aria-label="To date"
              value={toDate}
              min={fromDate}
              max={orgToday()}
              onChange={(e) => setToDate(e.target.value)}
              className="w-40"
            />
          </>
        )}
        {view !== "employee" && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name / ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-44 pl-8"
          />
        </div>
        )}
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
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={() => setMarkContext({ date, existing: null })}
        >
          <Plus /> Manual Entry
        </Button>
        <Button size="sm" variant="outline" onClick={exportCsv}>
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
                  {dailyRows.map(({ member, record }) => {
                    const memberMonthRecords = board.records.filter(
                      (r) => r.userId === member.userId && r.date.startsWith(date.slice(0, 7))
                    );
                    const evalRecord = evaluateEmployeeMonthAttendance(memberMonthRecords, date.slice(0, 7)).recordMap.get(date);

                    return (
                    <TableRow key={member.userId}>
                      <TableCell className="font-medium">
                        <button
                          type="button"
                          onClick={() => openEmployee(member.userId)}
                          className="text-left hover:text-primary hover:underline"
                          title="See this employee's attendance"
                        >
                          {member.name}
                        </button>
                      </TableCell>
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
                          <div className="flex items-center gap-1.5">
                            {!record.checkOutAt ? (
                              <Badge variant="warning">Open Shift</Badge>
                            ) : evalRecord?.creditType === "late_half_day" || evalRecord?.creditType === "late_cutoff_half_day" ? (
                              <Badge variant="warning" className="border-amber-400 bg-amber-500/15 text-amber-800 dark:text-amber-400 font-semibold" title={evalRecord.reason}>
                                {evalRecord.badgeLabel}
                              </Badge>
                            ) : evalRecord?.creditType === "late_grace" ? (
                              <Badge variant="warning" title={evalRecord.reason}>
                                {evalRecord.badgeLabel}
                              </Badge>
                            ) : (
                              <Badge variant="success">Present</Badge>
                            )}
                            {record.source === "admin" && <Badge variant="outline">Manual</Badge>}
                          </div>
                        ) : dayStatus(date, false) === "holiday" ? (
                          <Badge variant="muted">Holiday</Badge>
                        ) : (
                          <Badge variant="destructive">Missed</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
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
                          {record && !record.checkOutAt ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2.5 text-xs text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer"
                              onClick={() => setMarkContext({ userId: member.userId, date, existing: record })}
                              title="Close open shift"
                            >
                              Close Shift
                            </Button>
                          ) : record ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Correct attendance"
                              onClick={() => setMarkContext({ userId: member.userId, date, existing: record })}
                            >
                              <Pencil />
                            </Button>
                          ) : (
                            dayStatus(date, false) !== "holiday" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setMarkContext({ userId: member.userId, date, existing: null })}
                              >
                                <UserPlus /> Mark
                              </Button>
                            )
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
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
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md border border-border bg-secondary/30 px-3 py-2 text-[11px] text-muted-foreground">
              <LegendDot className="bg-success" label="Present" />
              <LegendDot className="bg-amber-500" label="Late grace (≤10:15, 1–3/mo)" />
              <LegendDot className="bg-orange-500" label="Half day (4th late / after 10:15)" />
              <LegendDot className="bg-destructive" label="Absent" />
              <LegendDot className="bg-muted-foreground/40" label="Sunday" />
              <span className="ml-auto text-muted-foreground/70">Click any day to mark or correct it</span>
            </div>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted text-muted-foreground">
                    <th className="sticky left-0 z-10 border-r border-border bg-muted px-3 py-2 text-left font-medium">
                      Employee
                    </th>
                    {monthDays.map((d) => {
                      const isSunday = new Date(`${d}T00:00:00`).getDay() === 0;
                      return (
                        <th
                          key={d}
                          className={`w-8 px-0.5 py-2 text-center font-normal tabular-nums ${isSunday ? "bg-muted-foreground/5" : ""}`}
                        >
                          {Number(d.slice(-2))}
                        </th>
                      );
                    })}
                    <th className="border-l border-border px-3 py-2 text-right font-medium">Paid</th>
                    <th className="px-3 py-2 text-right font-medium">OT</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyRows.length === 0 && (
                    <tr>
                      <td colSpan={monthDays.length + 3} className="py-8 text-center text-sm text-muted-foreground">
                        No members match the filters.
                      </td>
                    </tr>
                  )}
                  {monthlyRows.map(({ member, records, summary }, rowIdx) => {
                    const evaluation = evaluateEmployeeMonthAttendance(records, month);
                    const rowBg = rowIdx % 2 === 1 ? "bg-muted" : "bg-card";
                    return (
                      <tr key={member.userId} className={rowBg}>
                        <td
                          className={`sticky left-0 z-10 whitespace-nowrap border-r border-border px-3 py-1.5 font-medium ${rowBg}`}
                        >
                          <button
                            type="button"
                            onClick={() => openEmployee(member.userId)}
                            className="text-left hover:text-primary hover:underline"
                            title="See this employee's attendance"
                          >
                            {member.name}
                          </button>
                        </td>
                        {monthDays.map((d) => {
                          const ev = evaluation.recordMap.get(d);
                          const record = ev?.record;
                          const status = dayStatus(d, Boolean(record));
                          const glyph =
                            status === "present"
                              ? ev?.glyph || (record?.source === "admin" ? "P*" : "P")
                              : status === "absent" ? "A" : status === "holiday" ? "" : "";
                          const isGrace = ev?.creditType === "late_grace";
                          const isHalf = ev?.creditType === "late_half_day" || ev?.creditType === "late_cutoff_half_day";
                          const tooltip =
                            ev?.reason ||
                            (record?.source === "admin" ? `Manually marked — ${record.note}` : undefined) ||
                            (status === "absent" ? "Absent — click to mark attendance" : undefined) ||
                            (status === "holiday" ? "Sunday — click to record if worked" : undefined);

                          return (
                            <td key={d} className="px-0.5 py-1.5 text-center align-middle">
                              <button
                                type="button"
                                title={tooltip}
                                onClick={() => setMarkContext({ userId: member.userId, date: d, existing: record ?? null })}
                                className={
                                  "mx-auto flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-semibold transition-colors hover:ring-2 hover:ring-primary/40 " +
                                  (status === "present" && isHalf
                                    ? "bg-orange-500/20 text-orange-700 dark:text-orange-300"
                                    : status === "present" && isGrace
                                    ? "bg-amber-500/20 text-amber-700 dark:text-amber-400"
                                    : status === "present"
                                    ? "bg-success/15 text-success"
                                    : status === "absent"
                                    ? "bg-destructive/10 text-destructive"
                                    : "text-muted-foreground/40")
                                }
                              >
                                {glyph}
                              </button>
                            </td>
                          );
                        })}
                        <td className="border-l border-border px-3 py-1.5 text-right align-middle">
                          <div className="tabular-nums">
                            <span className="font-semibold text-foreground">{summary.effectivePaidDays}d</span>
                          </div>
                          <div className="mt-0.5 flex justify-end gap-1.5 whitespace-nowrap text-[10px] tabular-nums text-muted-foreground">
                            <span className="text-success">{summary.present}P</span>
                            {summary.halfDay > 0 && <span className="text-orange-600 dark:text-orange-400">{summary.halfDay}HD</span>}
                            {summary.lateCount > 0 && <span className="text-amber-600 dark:text-amber-400">{summary.lateCount}L</span>}
                            <span className="text-destructive">{summary.absent}A</span>
                          </div>
                        </td>
                        <td className="px-3 py-1.5 text-right align-middle tabular-nums">
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

      {view === "employee" && (
        !employee ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Choose an employee above to see their attendance.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {employee.name}
                {employee.employeeId && (
                  <span className="ml-2 font-normal text-muted-foreground">{employee.employeeId}</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-md border border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">Days present</p>
                  <p className="text-lg font-semibold tabular-nums">{employeeTotals.days}</p>
                </div>
                <div className="rounded-md border border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">Total hours</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {employeeTotals.minutes > 0 ? formatDuration(employeeTotals.minutes) : "—"}
                  </p>
                </div>
                <div className="rounded-md border border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">Overtime</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {employeeTotals.overtime > 0 ? formatDuration(employeeTotals.overtime) : "—"}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>In</TableHead>
                      <TableHead>Out</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead className="text-right">OT</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employeeRecords.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                          No attendance recorded in this range.
                        </TableCell>
                      </TableRow>
                    )}
                    {employeeRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium tabular-nums">
                          {new Date(`${record.date}T00:00:00`).toLocaleDateString("en-IN", {
                            weekday: "short",
                            day: "2-digit",
                            month: "short",
                          })}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {projectById.get(record.projectId)?.name ?? "—"}
                        </TableCell>
                        <TableCell className="tabular-nums">{formatTime(record.checkInAt)}</TableCell>
                        <TableCell className="tabular-nums">{formatTime(record.checkOutAt)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {record.totalMinutes > 0 ? formatDuration(record.totalMinutes) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {record.overtimeMinutes > 0 ? formatDuration(record.overtimeMinutes) : "—"}
                        </TableCell>
                        <TableCell>
                          {!record.checkOutAt ? (
                            <Badge variant="warning">Open Shift</Badge>
                          ) : record.source === "admin" ? (
                            <Badge variant="outline">Manual</Badge>
                          ) : (
                            <Badge variant="success">Self</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="View details"
                              onClick={() => setSelected(record)}
                            >
                              <Eye />
                            </Button>
                            {!record.checkOutAt ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2 text-xs text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer"
                                onClick={() =>
                                  setMarkContext({ userId: record.userId, date: record.date, existing: record })
                                }
                                title="Close open shift"
                              >
                                Close Shift
                              </Button>
                            ) : (
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label="Correct attendance"
                                onClick={() =>
                                  setMarkContext({ userId: record.userId, date: record.date, existing: record })
                                }
                              >
                                <Pencil />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )
      )}

      {selected && (
        <RecordDetailDialog
          record={selected}
          evaluated={
            evaluateEmployeeMonthAttendance(
              board.records.filter((r) => r.userId === selected.userId),
              selected.date.slice(0, 7)
            ).recordMap.get(selected.date)
          }
          onClose={() => setSelected(null)}
          showName
        />
      )}

      <AdminMarkAttendanceDialog
        open={markContext !== null}
        onClose={() => setMarkContext(null)}
        onSaved={() => router.refresh()}
        members={board.members}
        projects={projects}
        defaultUserId={markContext?.userId}
        defaultDate={markContext?.date ?? date}
        existing={markContext?.existing}
      />
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-2 shrink-0 rounded-full ${className}`} />
      {label}
    </span>
  );
}
