"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { orgToday, type AttendanceAdminBoard } from "@/lib/attendance/compute";
import { SALARY_BASIS_DAYS, slipTotals } from "@/lib/payroll/compute";
import { dayBucketSum, differsOnlyByElapsedDays, expectedGross, paidDaysFor, slipRefusal } from "@/lib/payroll/paid-days";
import { generateSlipAction } from "@/app/payroll/actions";
import { salarySlipStatusMeta } from "@/lib/labels";
import { cn, formatINR } from "@/lib/utils";
import type { Employee, SalarySlip } from "@/lib/types";

const fmtDays = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const perDay = (ctc: number) =>
  (ctc / SALARY_BASIS_DAYS).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Read-only Payroll Audit: recomputes every employee's paid days and gross
 * with the same shared functions the slips are generated from
 * (paidDaysFor / expectedGross) and compares them with the saved slip.
 */
export function PayrollAuditDialog({
  open,
  onClose,
  month,
  monthLabel,
  employees,
  slips,
  attendanceBoard,
  boardProblem,
}: {
  open: boolean;
  onClose: () => void;
  month: string;
  monthLabel: string;
  employees: Employee[];
  slips: SalarySlip[];
  attendanceBoard?: AttendanceAdminBoard;
  /** Attendance didn't (fully) load — expected figures can't be trusted, Recalc refused. */
  boardProblem: string | null;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  if (!open) return null;

  const today = orgToday();
  type AuditStatus = "no_slip" | "match" | "in_progress" | "salary_changed" | "mismatch";
  const rows = employees.map((emp) => {
    const info = paidDaysFor(emp, attendanceBoard, month, today, employees);
    const gross = expectedGross(emp.monthlyCtc, info.paidDays);
    const slip = slips.find((s) => s.employeeId === emp.id && s.month === month) ?? null;
    const slipGross = slip ? slipTotals(slip).earnings : null;
    const slipDays = slip ? Number(slip.paidDays) : null;
    const daysDiffer = slipDays !== null && Math.abs(slipDays - info.paidDays) > 0.001;
    let status: AuditStatus = "no_slip";
    if (slip && slipDays !== null && slipGross !== null) {
      if (info.blocked) status = "mismatch"; // can't be verified at all
      else if (!daysDiffer && slipGross === gross) status = "match";
      // Same days; gross differs only because the CTC changed after an approved/paid slip.
      else if (!daysDiffer && slip.status !== "draft") status = "salary_changed";
      // Current-month draft equal to what payroll computed on an earlier day this month.
      else if (
        slip.status === "draft" &&
        differsOnlyByElapsedDays(emp, attendanceBoard, month, today, employees, slipDays, slipGross)
      )
        status = "in_progress";
      else status = "mismatch";
    }
    const bucketSum = info.summary ? dayBucketSum(info.summary) : null;
    return { emp, info, gross, slip, slipGross, status, bucketSum, bucketOk: bucketSum === null || bucketSum === info.daysInMonth };
  });
  const mismatches = rows.filter((r) => r.status === "mismatch").length;
  const bucketFails = rows.filter((r) => !r.bucketOk).length;
  const noSlip = rows.filter((r) => !r.slip).length;
  const blockedCount = rows.filter((r) => r.info.blocked).length;

  async function recalc(emp: Employee) {
    // Recomputed at click time with a fresh orgToday().
    const check = slipRefusal(emp, attendanceBoard, month, orgToday(), employees);
    if ("error" in check) return setError(check.error);
    setBusyId(emp.id);
    setError(null);
    const res = await generateSlipAction(emp.id, month, check.paidDays);
    setBusyId(null);
    if (res.error) setError(res.error);
    else router.refresh();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Payroll Audit — ${monthLabel}`}
      description="Read-only. Every number is recomputed from attendance with the same code that generates the slips."
      className="max-w-[min(98vw,1600px)]"
    >
      <div className="space-y-3">
        <p className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Formula: </span>
          Paid Days = days elapsed (30 for a finished month, today&apos;s date while in progress) − Absent − ½ × Half-Days − Not Joined;
          Per Day = CTC ÷ 30; Expected Gross = round(CTC × Paid Days ÷ 30). Week offs, holidays and paid leave are paid.
          No attendance member = full 30 days; a tracked employee with no attendance at all this month = 0. A linked login
          missing from attendance (with no rows) or a name matching 2+ people can&apos;t be paid until fixed.
        </p>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant={mismatches ? "warning" : "success"}>{mismatches} mismatch{mismatches === 1 ? "" : "es"}</Badge>
          <Badge variant="outline">{noSlip} without slip</Badge>
          {blockedCount > 0 && <Badge variant="destructive">{blockedCount} can&apos;t be paid until fixed</Badge>}
          <Badge variant={bucketFails ? "destructive" : "success"}>{bucketFails} day-check failure{bucketFails === 1 ? "" : "s"}</Badge>
        </div>

        {boardProblem && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {boardProblem} The expected figures below can&apos;t be trusted.
          </p>
        )}
        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        <div className="overflow-x-auto">
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Emp ID</TableHead>
                <TableHead>Office / Site</TableHead>
                <TableHead className="text-right" title="Days actually worked">Present</TableHead>
                <TableHead className="text-right">Paid Leave</TableHead>
                <TableHead className="text-right">Week Off</TableHead>
                <TableHead className="text-right">Holidays</TableHead>
                <TableHead className="text-right">Absent</TableHead>
                <TableHead className="text-right">Half-Days</TableHead>
                <TableHead className="text-right">Not Joined</TableHead>
                <TableHead className="text-right" title="Today / future working days, not decided yet">Upcoming</TableHead>
                <TableHead className="text-right" title="Sum of the day buckets = days in month">Day Check</TableHead>
                <TableHead className="text-right">Paid Days</TableHead>
                <TableHead className="text-right">Per Day</TableHead>
                <TableHead className="text-right">Expected Gross</TableHead>
                <TableHead className="text-right">Slip Days</TableHead>
                <TableHead className="text-right">Slip Gross</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={18} className="py-6 text-center text-muted-foreground">No employees.</TableCell>
                </TableRow>
              )}
              {rows.map(({ emp, info, gross, slip, slipGross, status, bucketSum, bucketOk }) => {
                const mismatch = status === "mismatch";
                const s = info.summary;
                const cell = (n: number | undefined) => (s && n !== undefined ? fmtDays(n) : "—");
                return (
                  <TableRow key={emp.id} className={cn(mismatch && "bg-amber-500/5", !bucketOk && "bg-destructive/5")}>
                    <TableCell className="font-medium text-foreground">
                      {emp.name}
                      {info.ambiguous && (
                        <div className="text-[10px] font-normal text-destructive">
                          ⚠️ Matches more than one person — link their login first
                        </div>
                      )}
                      {info.linkedMissing && (
                        <div className="text-[10px] font-normal text-destructive">
                          ⚠️ Linked login missing{info.tracked ? " — paid from its rows with defaults (Sunday off, no start date)" : " — can't be paid"}
                        </div>
                      )}
                      {info.matchedBy === "name" && (
                        <div className="text-[10px] font-normal text-muted-foreground">matched by name</div>
                      )}
                      {!info.tracked && !info.blocked && (
                        <div className="text-[10px] font-normal text-muted-foreground">not tracked — full 30 days</div>
                      )}
                      {info.noAttendance && (
                        <div className="text-[10px] font-normal text-amber-700 dark:text-amber-400">No attendance this month — 0 paid days</div>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">{info.member?.employeeId || "—"}</TableCell>
                    <TableCell>{info.isOffice === null ? "—" : info.isOffice ? "Office" : "Site"}</TableCell>
                    <TableCell className="text-right tabular-nums">{cell(s?.worked)}</TableCell>
                    <TableCell className="text-right tabular-nums">{cell(s?.leave)}</TableCell>
                    <TableCell className="text-right tabular-nums">{cell(s?.weekOff)}</TableCell>
                    <TableCell className="text-right tabular-nums">{cell(s?.holiday)}</TableCell>
                    <TableCell className="text-right tabular-nums">{cell(s?.absent)}</TableCell>
                    <TableCell className="text-right tabular-nums">{cell(s?.halfDay)}</TableCell>
                    <TableCell className="text-right tabular-nums">{cell(s?.notJoined)}</TableCell>
                    <TableCell className="text-right tabular-nums">{cell(s?.upcoming)}</TableCell>
                    <TableCell
                      className="whitespace-nowrap text-right tabular-nums"
                      title="Present + Paid Leave + Week Off + Holidays + Absent + Half-Days + Not Joined + Upcoming"
                    >
                      {bucketSum === null ? "—" : bucketOk ? `✅ ${bucketSum}/${info.daysInMonth}` : `⚠️ ${bucketSum}/${info.daysInMonth}`}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums" title={info.noAttendance ? "No attendance this month" : undefined}>
                      {info.blocked ? (
                        "—"
                      ) : info.noAttendance ? (
                        <span className="whitespace-nowrap">0 <span className="text-[10px] font-normal text-amber-700 dark:text-amber-400">(No attendance this month)</span></span>
                      ) : (
                        fmtDays(info.paidDays)
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">₹{perDay(emp.monthlyCtc)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{info.blocked ? "—" : formatINR(gross)}</TableCell>
                    <TableCell className="text-right tabular-nums">{slip ? fmtDays(Number(slip.paidDays)) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{slipGross === null ? "—" : formatINR(slipGross)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {info.blocked ? (
                        <span className="text-destructive" title={info.blocked}>
                          ⛔ {info.linkedMissing ? "Linked login missing" : "Matches 2+ people"}
                        </span>
                      ) : status === "no_slip" ? (
                        <span className="text-muted-foreground">— No slip</span>
                      ) : status === "match" ? (
                        <span className="text-emerald-700 dark:text-emerald-400">✅ Match</span>
                      ) : status === "in_progress" ? (
                        <span
                          className="text-muted-foreground"
                          title="Saved earlier this month; the only difference is the days elapsed since. Recalc any time, or after the month ends."
                        >
                          ⏳ In progress (updates daily)
                        </span>
                      ) : status === "salary_changed" ? (
                        <span className="text-muted-foreground" title="Paid days match; the monthly CTC was changed after this slip was approved/paid.">
                          ℹ️ Salary changed since slip
                        </span>
                      ) : slip ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-amber-700 dark:text-amber-400">⚠️ Mismatch</span>
                          {slip.status === "draft" && !boardProblem ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[11px]"
                              disabled={busyId === emp.id}
                              onClick={() => recalc(emp)}
                              title={`Regenerate the draft slip with ${fmtDays(info.paidDays)} paid days`}
                            >
                              {busyId === emp.id ? "…" : "Recalc"}
                            </Button>
                          ) : (
                            <span className="text-[10px] text-muted-foreground" title="Only draft slips can be recalculated">
                              {salarySlipStatusMeta[slip.status]?.label ?? slip.status}
                            </span>
                          )}
                        </span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </Dialog>
  );
}
