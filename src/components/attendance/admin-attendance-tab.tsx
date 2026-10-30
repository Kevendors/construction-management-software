"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Building2, Download, Eye, Pencil, Plus, Search, Trash2, UserPlus } from "lucide-react";
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
  autoLeaveLabel,
  beforeJoiningLabel,
  dayStatus,
  daysOfMonth,
  evaluateEmployeeMonthAttendance,
  formatDuration,
  formatTime,
  isBeforeJoining,
  isHolidayFor,
  missedAbsentReason,
  orgThisMonth,
  orgToday,
  weekOffUiEnabled,
  type AttendanceAdminBoard,
  type AttendanceMember,
} from "@/lib/attendance/compute";
import type { EmployeeAttendance, Project } from "@/lib/types";
import { paidDaysFromRecords } from "@/lib/payroll/paid-days";
import { getSpotCheckSummaryAction } from "@/app/attendance/spot-check-actions";
import { getSiteVisitCountsAction } from "@/app/attendance/actions";
import { deleteWeekOffSwapAction } from "@/app/attendance/week-off-actions";
import { useRole } from "@/components/layout/role-provider";
import { RecordDetailDialog } from "./record-detail-dialog";
import { AdminMarkAttendanceDialog } from "./admin-mark-attendance-dialog";
import { OfficeLocationCard } from "./office-location-card";
import { HolidaysCard } from "./holidays-card";
import { UnfencedSitesCard } from "./unfenced-sites-card";
import { LiveLocationsMap } from "./live-locations-map";
import { WeekOffSwapDialog } from "./week-off-swap-dialog";

const STATUS_LABEL: Record<string, string> = {
  half_day: "Half Day",
  leave: "Leave",
  absent: "Absent",
};

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
  const { role } = useRole();
  const router = useRouter();
  const [view, setView] = React.useState<"daily" | "monthly" | "employee" | "live">("daily");
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
  const [swapOpen, setSwapOpen] = React.useState(false);
  const [deletingSwap, setDeletingSwap] = React.useState<string | null>(null);

  const projectById = new Map(projects.map((p) => [p.id, p]));
  const q = search.trim().toLowerCase();
  const members = board.members.filter(
    (m) => !q || m.name.toLowerCase().includes(q) || m.employeeId.toLowerCase().includes(q)
  );

  const recordFor = (userId: string, d: string) =>
    board.records.find((r) => r.userId === userId && r.date === d);

  /** A no-record day that's a weekly off in `weekOffDates` (not a declared holiday, which reads as Holiday). */
  const isWeekOffFor = (m: AttendanceMember, d: string, weekOffDates: ReadonlySet<string>) =>
    !isHolidayFor(d, board.holidays, m.isOffice) && weekOffDates.has(d);

  /**
   * A record's `status` column alone can't tell paid Leave from unpaid, or
   * from a declarative mark that actually falls on a company holiday — both
   * only come out of the monthly evaluation (which also needs the member's
   * weekly off, since an office member's missed working days count as Leave).
   */
  const evaluationFor = (userId: string, recordMonth: string, isOffice: boolean) => {
    const member = board.members.find((m) => m.userId === userId);
    return evaluateEmployeeMonthAttendance(
      board.records.filter((r) => r.userId === userId && r.date.startsWith(recordMonth)),
      recordMonth,
      isOffice,
      board.holidays,
      member?.weekOff,
      undefined,
      member?.startDate
    );
  };
  const creditTypeFor = (userId: string, d: string, isOffice: boolean) =>
    evaluationFor(userId, d.slice(0, 7), isOffice).recordMap.get(d)?.creditType;
  const isLeaveUnpaidFor = (userId: string, d: string, isOffice: boolean) => creditTypeFor(userId, d, isOffice) === "leave_unpaid";
  /** Why a Leave row is unpaid (office 2nd+ day off, or site staff — no paid leave). */
  const unpaidLeaveReasonFor = (userId: string, d: string, isOffice: boolean) =>
    evaluationFor(userId, d.slice(0, 7), isOffice).recordMap.get(d)?.reason || "Unpaid Leave";
  const isDeclaredHolidayFor = (userId: string, d: string, isOffice: boolean) => creditTypeFor(userId, d, isOffice) === "declared_holiday";

  /* ---- daily view rows: one per member, "Missed" when no record ---- */
  // The evaluation (once per row) says whether a no-record day is a weekly
  // off (incl. flexible offs), the office member's paid auto-leave, or Absent.
  const dailyRows = members
    .map((m) => ({ member: m, record: recordFor(m.userId, date), evaluation: evaluationFor(m.userId, date.slice(0, 7), m.isOffice) }))
    .filter((r) => !projectId || r.record?.projectId === projectId);
  /**
   * A no-record day in the daily view: paid auto-leave, Absent (an office
   * member's missed day once they have 2+ days off), Week Off / Holiday,
   * Not joined (before the member's start date), or Missed.
   */
  const noRecordLabel = (m: AttendanceMember, evaluation: (typeof dailyRows)[number]["evaluation"]) => {
    if (isBeforeJoining(date, m.startDate)) return "Not joined";
    const autoLeave = autoLeaveLabel(evaluation, date);
    if (autoLeave) return autoLeave.label;
    if (missedAbsentReason(evaluation, date)) return "Absent";
    const isDeclared = isHolidayFor(date, board.holidays, m.isOffice);
    if (dayStatus(date, false, orgToday(), isDeclared, m.weekOff, evaluation.weekOffDates) !== "holiday") return "Missed";
    return isWeekOffFor(m, date, evaluation.weekOffDates) ? "Week Off" : "Holiday";
  };

  /* ---- monthly matrix ---- */
  const monthDays = daysOfMonth(month);
  const monthlyRows = members
    .map((m) => {
      // Weekly offs (incl. flexible), auto-leave and the summary come from ALL
      // of the member's records this month — same as the daily view and the
      // detail dialog. The project filter only picks rows and hides cells.
      const allRecs = board.records.filter((r) => r.userId === m.userId && r.date.startsWith(month));
      const recs = allRecs.filter((r) => !projectId || r.projectId === projectId);
      // Same function payroll pays from (src/lib/payroll/paid-days.ts), so the
      // grid's "Nd" total always equals the salary paid days.
      const pay = paidDaysFromRecords({
        records: allRecs,
        month,
        today: orgToday(),
        holidays: board.holidays,
        isOffice: m.isOffice,
        weekOff: m.weekOff,
        startDate: m.startDate,
      });
      return {
        member: m,
        records: recs,
        summary: pay.summary,
        pay,
        evaluation: evaluateEmployeeMonthAttendance(allRecs, month, m.isOffice, board.holidays, m.weekOff, undefined, m.startDate),
      };
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
  const [checkSummary, setCheckSummary] = React.useState<
    Record<string, { total: number; ok: number; missed: number }>
  >({});
  const siteRecordIds = React.useMemo(
    // Office-day rows included: a "Can work from office" member's office
    // check-in (no project) can still switch to projects (0050).
    // Half-day self rows with a real punch (late-arrival Half-Day) count too.
    () =>
      employeeRecords
        .filter((r) => (r.status === "present" || (r.status === "half_day" && Boolean(r.checkInAt))) && r.source === "self")
        .map((r) => r.id),
    [employeeRecords]
  );
  const siteRecordKey = siteRecordIds.join(",");
  React.useEffect(() => {
    if (!siteRecordKey) return;
    let ignore = false;
    getSpotCheckSummaryAction(siteRecordKey.split(",")).then((s) => {
      if (!ignore) setCheckSummary(s);
    });
    return () => {
      ignore = true;
    };
  }, [siteRecordKey]);
  // Switch Site (0050): site switches per day, for the "N sites" badge.
  const [siteVisitCounts, setSiteVisitCounts] = React.useState<Record<string, number>>({});
  React.useEffect(() => {
    if (!siteRecordKey) return;
    let ignore = false;
    getSiteVisitCountsAction(siteRecordKey.split(",")).then((c) => {
      if (!ignore) setSiteVisitCounts(c);
    });
    return () => {
      ignore = true;
    };
  }, [siteRecordKey]);
  // Swaps touching the selected range, plus any upcoming ones (the range
  // stops at today, so a just-recorded future swap would otherwise vanish).
  const today = orgToday();
  const employeeSwaps = board.weekOffSwaps
    .filter(
      (s) =>
        s.userId === employeeId &&
        ((s.workedDate >= fromDate && s.workedDate <= toDate) ||
          (s.offDate >= fromDate && s.offDate <= toDate) ||
          s.workedDate >= today ||
          s.offDate >= today)
    )
    .sort((a, b) => b.workedDate.localeCompare(a.workedDate));

  async function deleteSwap(id: string) {
    if (!window.confirm("Remove this weekly-off swap? The default weekly off applies again.")) return;
    setDeletingSwap(id);
    const res = await deleteWeekOffSwapAction(id);
    setDeletingSwap(null);
    if (res.error) window.alert(res.error);
    else router.refresh();
  }

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
    const projectLabel = (r: EmployeeAttendance) =>
      r.status !== "present" ? "" : r.projectId ? projectById.get(r.projectId)?.name ?? "" : "Office";
    const declarativeLabel = (r: EmployeeAttendance, isOffice: boolean) => {
      if (isDeclaredHolidayFor(r.userId, r.date, isOffice)) return "Holiday";
      if (r.status === "leave" && isLeaveUnpaidFor(r.userId, r.date, isOffice)) return "Absent";
      return STATUS_LABEL[r.status];
    };

    if (view === "employee") {
      downloadCsv(
        `attendance-${employee?.employeeId || employee?.name || "employee"}-${fromDate}-to-${toDate}.csv`,
        ["Date", "Employee", "Employee ID", "Project", "Check In", "Check Out", "Hours", "Overtime", "Source"],
        employeeRecords.map((r) => [
          r.date,
          employee?.name ?? "",
          employee?.employeeId || "—",
          projectLabel(r),
          r.status === "present" ? formatTime(r.checkInAt) : "",
          r.status === "present" ? formatTime(r.checkOutAt) : "",
          r.totalMinutes > 0 ? formatDuration(r.totalMinutes) : "",
          r.overtimeMinutes > 0 ? formatDuration(r.overtimeMinutes) : "",
          r.status !== "present" ? declarativeLabel(r, employee?.isOffice ?? false) : r.source === "admin" ? "Manual" : "Self",
        ])
      );
      return;
    }
    if (view === "daily") {
      downloadCsv(
        `attendance-${date}.csv`,
        ["Date", "Employee", "Employee ID", "Project", "Check In", "Check Out", "Hours", "Overtime", "Status"],
        dailyRows.map(({ member, record, evaluation }) => [
          date,
          member.name,
          member.employeeId || "—",
          record ? projectLabel(record) : "",
          record && record.status === "present" ? formatTime(record.checkInAt) : "",
          record && record.status === "present" ? formatTime(record.checkOutAt) : "",
          record && record.totalMinutes > 0 ? formatDuration(record.totalMinutes) : "",
          record && record.overtimeMinutes > 0 ? formatDuration(record.overtimeMinutes) : "",
          record
            ? record.status !== "present" ? declarativeLabel(record, member.isOffice) : "Present"
            : noRecordLabel(member, evaluation),
        ])
      );
    } else {
      downloadCsv(
        `attendance-${month}.csv`,
        ["Employee", "Employee ID", "Paid Days (salary)", "Present", "Leave", "Half-Day", "Absent", "Holiday", "Week Off", "Not Joined", "Overtime"],
        monthlyRows.map(({ member, records, summary, pay }) => [
          member.name,
          member.employeeId || "—",
          pay.paidDays,
          summary.present,
          summary.leave,
          summary.halfDay,
          summary.absent,
          summary.holiday,
          summary.weekOff,
          summary.notJoined,
          formatDuration(records.reduce((s, r) => s + r.overtimeMinutes, 0)),
        ])
      );
    }
  }

  return (
    <div className="space-y-4">
      <UnfencedSitesCard projects={projects} />
      <OfficeLocationCard />
      <HolidaysCard />

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
          <Button
            size="sm"
            variant={view === "live" ? "secondary" : "ghost"}
            onClick={() => setView("live")}
          >
            Live Map
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
        {view !== "employee" && view !== "live" && (
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
        {view !== "live" && (
          <>
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
          </>
        )}
      </div>

      {view === "live" && <LiveLocationsMap />}

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
                  {dailyRows.map(({ member, record, evaluation }) => {
                    const isDeclarative = Boolean(record && record.status !== "present");
                    const isOpenShift = Boolean(record && record.status === "present" && !record.checkOutAt);
                    const isUnpaidLeave = Boolean(
                      record?.status === "leave" && isLeaveUnpaidFor(member.userId, date, member.isOffice)
                    );
                    const isDeclaredHoliday = Boolean(isDeclarative && isDeclaredHolidayFor(member.userId, date, member.isOffice));
                    const autoLeave = record ? null : autoLeaveLabel(evaluation, date);
                    const noRecord = record ? null : noRecordLabel(member, evaluation);

                    return (
                    <TableRow key={member.userId}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEmployee(member.userId)}
                            className="text-left hover:text-primary hover:underline"
                            title="See this employee's attendance"
                          >
                            {member.name}
                          </button>
                          <Badge
                            variant="outline"
                            className="text-[10px]"
                            title={member.isOffice ? "Office staff — 1 paid Leave per month, office holiday rules" : "Site staff — no paid leave, site weekly-off types"}
                          >
                            {member.isOffice ? "Office" : "Site"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {member.employeeId || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {!record
                          ? "—"
                          : isDeclarative
                          ? "—"
                          : record.projectId
                          ? projectById.get(record.projectId)?.name ?? "—"
                          : "Office"}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {record && !isDeclarative ? formatTime(record.checkInAt) : "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {record && !isDeclarative ? formatTime(record.checkOutAt) : "—"}
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
                            {isDeclarative ? (
                              isDeclaredHoliday ? (
                                <Badge variant="muted" title={`Falls on a company holiday — recorded as Holiday, not ${STATUS_LABEL[record.status]}`}>
                                  Holiday
                                </Badge>
                              ) : (
                                <Badge
                                  variant={record.status === "absent" || isUnpaidLeave ? "destructive" : record.status === "leave" ? "success" : "warning"}
                                  className={record.status === "half_day" ? "border-amber-400 bg-amber-500/15 text-amber-800 dark:text-amber-400 font-semibold" : undefined}
                                  title={isUnpaidLeave ? unpaidLeaveReasonFor(member.userId, date, member.isOffice) : undefined}
                                >
                                  {record.status === "leave" && isUnpaidLeave ? "Absent" : STATUS_LABEL[record.status]}
                                </Badge>
                              )
                            ) : isOpenShift ? (
                              <Badge variant="warning">Open Shift</Badge>
                            ) : (
                              <Badge variant="success">Present</Badge>
                            )}
                            {record.source === "admin" && <Badge variant="outline">Manual</Badge>}
                          </div>
                        ) : autoLeave ? (
                          <Badge
                            variant="outline"
                            className="border-transparent bg-blue-500/20 text-blue-700 dark:text-blue-300"
                            title={autoLeave.reason}
                          >
                            {autoLeave.label}
                          </Badge>
                        ) : noRecord === "Not joined" ? (
                          <Badge variant="muted" title={member.startDate ? beforeJoiningLabel(member.startDate) : undefined}>
                            {noRecord}
                          </Badge>
                        ) : noRecord === "Week Off" || noRecord === "Holiday" ? (
                          <Badge variant="muted">{noRecord}</Badge>
                        ) : (
                          <Badge variant="destructive" title={missedAbsentReason(evaluation, date) ?? undefined}>
                            {noRecord}
                          </Badge>
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
                          {isOpenShift ? (
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
                            noRecord !== "Week Off" && noRecord !== "Holiday" && noRecord !== "Not joined" && (
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
              <LegendDot className="bg-orange-500" label="Half day (late-limit or manual)" />
              <LegendDot className="bg-blue-500" label="Leave (paid)" />
              <LegendDot className="bg-slate-500" label="Leave (unpaid: office 2nd+/mo, site staff)" />
              <LegendDot className="bg-destructive" label="Absent" />
              <LegendDot className="bg-indigo-500" label="Company Holiday" />
              <LegendDot className="bg-muted-foreground/40" label="Week Off" />
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
                      // Shared header: shade a day only when it's a weekly off for every
                      // listed member (plain Sundays while everyone is on the default).
                      const isAllWeekOff =
                        monthlyRows.length > 0 && monthlyRows.every(({ evaluation }) => evaluation.weekOffDates.has(d));
                      return (
                        <th
                          key={d}
                          className={`w-8 px-0.5 py-2 text-center font-normal tabular-nums ${isAllWeekOff ? "bg-muted-foreground/5" : ""}`}
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
                  {monthlyRows.map(({ member, records, summary, evaluation, pay }, rowIdx) => {
                    const rowBg = rowIdx % 2 === 1 ? "bg-muted" : "bg-card";
                    return (
                      <tr key={member.userId} className={rowBg}>
                        <td
                          className={`sticky left-0 z-10 whitespace-nowrap border-r border-border px-3 py-1.5 font-medium ${rowBg}`}
                        >
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEmployee(member.userId)}
                              className="text-left hover:text-primary hover:underline"
                              title="See this employee's attendance"
                            >
                              {member.name}
                            </button>
                            <Badge variant="outline" className="text-[10px]">
                              {member.isOffice ? "Office" : "Site"}
                            </Badge>
                          </div>
                        </td>
                        {monthDays.map((d) => {
                          const ev = evaluation.recordMap.get(d);
                          const record = ev?.record;
                          if (record && projectId && record.projectId !== projectId) {
                            // Filtered out by the project filter — not shown here (still counted in Paid).
                            return (
                              <td key={d} className="px-0.5 py-1.5 text-center align-middle">
                                <span
                                  className="mx-auto flex h-6 w-6 items-center justify-center rounded-md text-[11px] text-muted-foreground/40"
                                  title="Recorded outside the selected project"
                                >
                                  ·
                                </span>
                              </td>
                            );
                          }
                          const rawStatus = dayStatus(
                            d,
                            Boolean(record),
                            orgToday(),
                            isHolidayFor(d, board.holidays, member.isOffice),
                            member.weekOff,
                            evaluation.weekOffDates,
                            member.startDate
                          );
                          // Before the member joined: blank and muted, like a future day — never "A" / "H".
                          const notJoined = rawStatus === "not_joined";
                          const isDeclaredHoliday = !notJoined && isHolidayFor(d, board.holidays, member.isOffice);
                          // explicit_absent/declared_holiday have a real row, so dayStatus()
                          // (which only knows "does a row exist") would otherwise call them present.
                          const status =
                            ev?.creditType === "explicit_absent"
                              ? "absent"
                              : ev?.creditType === "declared_holiday"
                              ? "holiday"
                              : rawStatus;
                          // Office member's only missed working day: shown as paid Leave, not "A"
                          // (with 2+ days off the missed days stay "A" — missedAbsentReason says why).
                          const autoLeave = record ? null : autoLeaveLabel(evaluation, d);
                          const isLeave = ev?.creditType === "leave" || Boolean(autoLeave);
                          const isUnpaidLeave = ev?.creditType === "leave_unpaid";
                          const glyph =
                            isDeclaredHoliday
                              ? "H"
                              : isLeave
                              ? "LV"
                              : isUnpaidLeave
                              ? "A"
                              : status === "present"
                              ? ev?.glyph || (record?.source === "admin" ? "P*" : "P")
                              : status === "absent" ? "A" : status === "holiday" ? "" : "";
                          const isHalf = ev?.creditType === "explicit_half_day";
                          const holidayLabel = board.holidays.find((h) => h.date === d)?.label;
                          const tooltip =
                            (notJoined && member.startDate ? beforeJoiningLabel(member.startDate) : undefined) ||
                            ev?.reason ||
                            (record?.source === "admin" ? `Manually marked — ${record.note}` : undefined) ||
                            autoLeave?.reason ||
                            (record ? undefined : missedAbsentReason(evaluation, d)) ||
                            (status === "absent" ? "Absent — click to mark attendance" : undefined) ||
                            (status === "holiday"
                              ? isDeclaredHoliday && holidayLabel
                                ? `${holidayLabel} — click to record if worked`
                                : "Week Off — click to record if worked"
                              : undefined);

                          return (
                            <td key={d} className="px-0.5 py-1.5 text-center align-middle">
                              <button
                                type="button"
                                title={tooltip}
                                onClick={() => setMarkContext({ userId: member.userId, date: d, existing: record ?? null })}
                                className={
                                  "mx-auto flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-semibold transition-colors hover:ring-2 hover:ring-primary/40 " +
                                  (isDeclaredHoliday
                                    ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300"
                                    : isLeave
                                    ? "bg-blue-500/20 text-blue-700 dark:text-blue-300"
                                    : isUnpaidLeave
                                    ? "bg-destructive/15 text-destructive"
                                    : status === "present" && isHalf
                                    ? "bg-orange-500/20 text-orange-700 dark:text-orange-300"
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
                            <span
                              className="font-semibold text-foreground"
                              title={
                                pay.noAttendance
                                  ? "No attendance this month — 0 paid days"
                                  : `Paid days (salary): ${pay.daysElapsed} days elapsed − ${pay.unpaidDays} unpaid (Absent, ½ Half-Day, Not Joined). Week offs, holidays and paid leave are paid.`
                              }
                            >
                              {pay.paidDays}d
                            </span>
                          </div>
                          <div className="mt-0.5 flex justify-end gap-1.5 whitespace-nowrap text-[10px] tabular-nums text-muted-foreground">
                            <span className="text-success">{summary.present}P</span>
                            {summary.leave > 0 && <span className="text-blue-600 dark:text-blue-400">{summary.leave}LV</span>}
                            {summary.halfDay > 0 && <span className="text-orange-600 dark:text-orange-400">{summary.halfDay}HD</span>}
                            <span className="text-destructive">{summary.absent}A</span>
                            {summary.notJoined > 0 && (
                              <span title={member.startDate ? `Joined ${member.startDate}` : undefined}>{summary.notJoined}NJ</span>
                            )}
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
              <CardTitle className="flex items-center gap-2 text-base">
                {employee.name}
                {employee.employeeId && (
                  <span className="font-normal text-muted-foreground">{employee.employeeId}</span>
                )}
                <Badge variant="outline" className="text-[10px] font-normal">
                  {employee.isOffice ? "Office" : "Site"}
                </Badge>
                {weekOffUiEnabled(employee.isOffice) && (
                  <Button size="sm" variant="outline" className="ml-auto font-normal" onClick={() => setSwapOpen(true)}>
                    <ArrowLeftRight /> Swap weekly off
                  </Button>
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

              {/* Always listed when present (even if the swap UI is off for this
                  category), so existing swaps can still be seen and deleted. */}
              {employeeSwaps.length > 0 && (
                <div className="rounded-md border border-border">
                  <p className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
                    Weekly-off swaps (this range + upcoming)
                  </p>
                  <ul className="divide-y divide-border">
                    {employeeSwaps.map((s) => (
                      <li key={s.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                        <span className="tabular-nums">
                          Works <span className="font-medium">{shortDate(s.workedDate)}</span>
                          {" → "}
                          <Badge variant="muted">Week Off</Badge>{" "}
                          <span className="font-medium">{shortDate(s.offDate)}</span>
                        </span>
                        {s.note && <span className="truncate text-xs text-muted-foreground">{s.note}</span>}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="ml-auto h-7 w-7 text-muted-foreground hover:text-destructive"
                          aria-label="Delete swap"
                          title="Delete swap"
                          disabled={deletingSwap === s.id}
                          onClick={() => deleteSwap(s.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

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
                      <TableHead>Checks</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employeeRecords.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                          No attendance recorded in this range.
                        </TableCell>
                      </TableRow>
                    )}
                    {employeeRecords.map((record) => {
                      const isDeclarative = record.status !== "present";
                      const isOpenShift = record.status === "present" && !record.checkOutAt;
                      const isUnpaidLeave =
                        record.status === "leave" && isLeaveUnpaidFor(record.userId, record.date, employee?.isOffice ?? false);
                      const isDeclaredHoliday =
                        isDeclarative && isDeclaredHolidayFor(record.userId, record.date, employee?.isOffice ?? false);
                      return (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium tabular-nums">
                          {new Date(`${record.date}T00:00:00`).toLocaleDateString("en-IN", {
                            weekday: "short",
                            day: "2-digit",
                            month: "short",
                          })}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {isDeclarative ? "—" : record.projectId ? projectById.get(record.projectId)?.name ?? "—" : "Office"}
                          {(siteVisitCounts[record.id] ?? 0) > 0 && (
                            <Badge
                              variant="outline"
                              className="ml-1"
                              title={`Switched site ${siteVisitCounts[record.id]} time(s) — open the day for the timeline`}
                            >
                              {siteVisitCounts[record.id] + 1} sites
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums">{isDeclarative ? "—" : formatTime(record.checkInAt)}</TableCell>
                        <TableCell className="tabular-nums">{isDeclarative ? "—" : formatTime(record.checkOutAt)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {record.totalMinutes > 0 ? formatDuration(record.totalMinutes) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {record.overtimeMinutes > 0 ? formatDuration(record.overtimeMinutes) : "—"}
                        </TableCell>
                        <TableCell>
                          {isDeclarative ? (
                            isDeclaredHoliday ? (
                              <Badge variant="muted" title={`Falls on a company holiday — recorded as Holiday, not ${STATUS_LABEL[record.status]}`}>
                                Holiday
                              </Badge>
                            ) : (
                              <Badge
                                variant={record.status === "absent" || isUnpaidLeave ? "destructive" : record.status === "leave" ? "success" : "warning"}
                                className={record.status === "half_day" ? "border-amber-400 bg-amber-500/15 text-amber-800 dark:text-amber-400 font-semibold" : undefined}
                                title={isUnpaidLeave ? unpaidLeaveReasonFor(record.userId, record.date, employee?.isOffice ?? false) : undefined}
                              >
                                {record.status === "leave" && isUnpaidLeave ? "Absent" : STATUS_LABEL[record.status]}
                              </Badge>
                            )
                          ) : isOpenShift ? (
                            <Badge variant="warning">Open Shift</Badge>
                          ) : record.source === "admin" ? (
                            <Badge variant="outline">Manual</Badge>
                          ) : (
                            <Badge variant="success">Self</Badge>
                          )}
                          {record.note.includes("outside site") && (
                            <Badge variant="warning" className="ml-1" title={record.note}>
                              Outside site
                            </Badge>
                          )}
                          {/* 0051: Office "Client visits allowed" punch away from the office. */}
                          {record.note.includes("away from office") && (
                            <Badge variant="warning" className="ml-1" title={record.note}>
                              Away from office
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const s = checkSummary[record.id];
                            if (!s || s.total === 0) return <span className="text-muted-foreground">—</span>;
                            return (
                              <Badge
                                variant={s.missed > 0 ? "destructive" : s.ok === s.total ? "success" : "warning"}
                                title={`${s.ok} confirmed/on site, ${s.total - s.ok - s.missed} off site, ${s.missed} missed`}
                              >
                                {s.ok}/{s.total}
                              </Badge>
                            );
                          })()}
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
                            {isOpenShift ? (
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
                      );
                    })}
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
              selected.date.slice(0, 7),
              board.members.find((m) => m.userId === selected.userId)?.isOffice ?? false,
              board.holidays,
              board.members.find((m) => m.userId === selected.userId)?.weekOff,
              undefined,
              board.members.find((m) => m.userId === selected.userId)?.startDate
            ).recordMap.get(selected.date)
          }
          onClose={() => setSelected(null)}
          canExcuse={role === "super_admin" || role === "hr"}
          showName
        />
      )}

      {swapOpen && employee && (
        <WeekOffSwapDialog
          member={employee}
          holidays={board.holidays}
          onClose={() => setSwapOpen(false)}
          onSaved={() => router.refresh()}
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

function shortDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-2 shrink-0 rounded-full ${className}`} />
      {label}
    </span>
  );
}
