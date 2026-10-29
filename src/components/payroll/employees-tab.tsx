"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calculator, FileText, Pencil, Plus, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Dialog, Select } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PayrollBreakdownChart } from "@/components/charts/payroll-chart";
import { SetSalaryDialog } from "./set-salary-dialog";
import { DepartmentOptions, DesignationSuggestions } from "./department-fields";
import type { PayrollBoard } from "@/lib/payroll/compute";
import { monthlySummary, orgToday, type AttendanceAdminBoard } from "@/lib/attendance/compute";
import { payrollByDepartment, SALARY_BASIS_DAYS, slipTotals } from "@/lib/payroll/compute";
import { addEmployeeAction, generateSlipAction } from "@/app/payroll/actions";
import { salarySlipStatusMeta, roleLabel } from "@/lib/labels";
import { useRole } from "@/components/layout/role-provider";
import { isAdminRole } from "@/lib/auth/permissions";
import { EMPLOYEE_ROLES, isExternalRole } from "@/lib/auth/roles";
import { cn, formatINR } from "@/lib/utils";
import type { Department, Employee, Role } from "@/lib/types";

export function EmployeesTab({
  board,
  attendanceBoard,
  month,
  onMonthChange,
}: {
  board: PayrollBoard;
  attendanceBoard?: AttendanceAdminBoard;
  month: string;
  onMonthChange: (m: string) => void;
}) {
  const router = useRouter();
  const { role } = useRole();
  const canManageSalary = isAdminRole(role) || role === "hr";

  const { employees, slips } = board;
  const [addOpen, setAddOpen] = React.useState(false);
  const [salaryTarget, setSalaryTarget] = React.useState<Employee | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const breakdown = payrollByDepartment(slips, employees, month);
  const slipFor = (empId: string) => slips.find((s) => s.employeeId === empId && s.month === month) ?? null;
  const monthLabel = new Date(`${month}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  // Whether this employee has a project assigned (Site, in the attendance sense) or not (Office) --
  // independent of the manually-set `department` field (Admin/Sales/Site/Projects/…),
  // which is a separate HR label and can legitimately disagree with this (e.g. an "Admin"
  // department employee who is also assigned to a project is still "Site" here).
  const memberFor = (emp: Employee) =>
    attendanceBoard?.members.find(
      (m) =>
        (emp.profileId && m.userId === emp.profileId) ||
        m.employeeId.toLowerCase() === emp.id.toLowerCase() ||
        m.name.toLowerCase() === emp.name.toLowerCase()
    );
  const isOfficeFor = (emp: Employee): boolean | null => {
    const m = memberFor(emp);
    return m ? m.isOffice : null;
  };

  // Fixed Day Basis: per-day pay = salary ÷ 30, whatever the month's length.
  const perDayFor = (ctc: number) =>
    (ctc / SALARY_BASIS_DAYS).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Salary days of `month` earned so far (Fixed Day Basis, max 30): the full
  // 30 once the month is over, today's day-of-month (capped at 30) while it's
  // in progress, 0 for a future month.
  const daysElapsedIn = (m: string): number => {
    const today = orgToday();
    if (m < today.slice(0, 7)) return SALARY_BASIS_DAYS;
    if (m === today.slice(0, 7)) return Math.min(SALARY_BASIS_DAYS, Number(today.slice(8, 10)));
    return 0;
  };

  // Count GPS verified attendance days and half-day evaluation for this employee in the active month
  const attendanceStatsFor = (emp: Employee) => {
    if (!attendanceBoard?.records?.length) return null;
    const matching = attendanceBoard.records.filter((r) => {
      if (!r.date.startsWith(month)) return false;
      if (emp.profileId && r.userId === emp.profileId) return true;
      if (r.employeeId && r.employeeId.toLowerCase() === emp.id.toLowerCase()) return true;
      if (r.userName && r.userName.toLowerCase() === emp.name.toLowerCase()) return true;
      return false;
    });
    if (matching.length === 0) return null;
    const isOffice = isOfficeFor(emp) ?? false;
    const member = memberFor(emp);
    // Calendar-days method: every day of the month is paid except unpaid ones
    // (Absent incl. unpaid Leave = 1 day, Half-Day = 0.5). Weekly offs and
    // declared holidays are paid. For the month in progress only days up to
    // and including today are paid (a draft till the 28th pays 28 − absent);
    // Recalc after the month ends pays the full month.
    const summary = monthlySummary(
      matching,
      month,
      orgToday(),
      attendanceBoard.holidays,
      isOffice,
      member?.weekOff,
      member?.startDate
    );
    // Days before joining aren't Absent any more, but stay unpaid exactly as
    // before (notJoinedUnpaid = the ones that used to count as Absent).
    const unpaidDays = summary.absent + summary.halfDay * 0.5 + summary.notJoinedUnpaid;
    return {
      rawDays: matching.length,
      unpaidDays,
      halfDays: summary.halfDay,
      paidDays: Math.max(0, daysElapsedIn(month) - unpaidDays),
    };
  };

  async function generate(empId: string) {
    setBusyId(empId);
    const emp = employees.find((e) => e.id === empId);
    const stats = emp ? attendanceStatsFor(emp) : null;
    // Whether this employee has an attendance identity at all (a roster entry
    // in the Attendance board) -- not whether they have records *this month*.
    const tracked = emp ? isOfficeFor(emp) !== null : false;
    // Trust the computed attendance days whenever this employee is tracked,
    // including a genuine 0 (no attendance recorded this month) -- that must
    // NOT silently become a full paid month. Only pay the full month when
    // there's no attendance tracking for them at all (e.g. a manually-paid
    // employee with no login/roster entry), where there's nothing to compute from.
    const daysToPay = tracked ? stats?.paidDays ?? 0 : SALARY_BASIS_DAYS;
    const res = await generateSlipAction(empId, month, daysToPay);
    setBusyId(null);
    if (!res.error) router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="pay-month" className="text-xs text-muted-foreground">Month</Label>
          <Input id="pay-month" type="month" value={month} onChange={(e) => onMonthChange(e.target.value)} className="h-8 w-40" />
        </div>
        {canManageSalary && (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus /> Add Employee
          </Button>
        )}
      </div>

      {breakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payroll Cost by Department — {monthLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            <PayrollBreakdownChart data={breakdown} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Salary Run — {monthLabel}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Site / Office</TableHead>
                <TableHead className="text-right">Monthly CTC</TableHead>
                <TableHead className="text-right">Net Pay</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Slip / Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    No employees yet — click &quot;Add Employee&quot; to get started.
                  </TableCell>
                </TableRow>
              )}
              {employees.map((emp) => {
                const s = slipFor(emp.id);
                const t = s ? slipTotals(s) : null;
                const meta = s ? salarySlipStatusMeta[s.status] : null;
                const stats = attendanceStatsFor(emp);
                const isOffice = isOfficeFor(emp);

                return (
                  <TableRow key={emp.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar initials={emp.initials} color={emp.avatarColor} className="h-7 w-7 text-[11px]" />
                        <div>
                          <div className="font-medium text-foreground">{emp.name}</div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span>{emp.designation || "Staff"}</span>
                            {stats !== null && (
                              <span
                                className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:text-emerald-400"
                                title={`${daysElapsedIn(month)} of ${SALARY_BASIS_DAYS} days − ${stats.unpaidDays} unpaid (Absent = 1, Half-Day = 0.5, working day before joining = 1). Weekly offs and holidays are paid. Fixed Day Basis: salary ÷ 30 × paid days.`}
                              >
                                {stats.paidDays}d paid
                                {stats.halfDays > 0 && (
                                  <span className="text-orange-700 dark:text-orange-300 font-semibold">
                                    ({stats.halfDays} HD)
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {isOffice === null ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <Badge variant="outline">{isOffice ? "Office" : "Site"}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {canManageSalary ? (
                        <button
                          type="button"
                          onClick={() => setSalaryTarget(emp)}
                          className="group inline-flex items-center gap-1.5 rounded px-2 py-1 text-right font-medium tabular-nums transition-colors hover:bg-muted"
                          title="Click to set or adjust salary"
                        >
                          {emp.monthlyCtc > 0 ? (
                            <span className="flex flex-col items-end">
                              <span className="inline-flex items-center gap-1.5">
                                <span className="text-foreground">{formatINR(emp.monthlyCtc)}</span>
                                <Pencil className="h-3 w-3 text-muted-foreground opacity-30 transition-opacity group-hover:opacity-100" />
                              </span>
                              <span className="text-[10px] tabular-nums text-muted-foreground" title={`${formatINR(emp.monthlyCtc)} ÷ ${SALARY_BASIS_DAYS} days (Fixed Day Basis)`}>
                                ₹{perDayFor(emp.monthlyCtc)}/day
                              </span>
                              <span className={cn(
                                "text-[10px]",
                                emp.deductPf !== false ? "text-muted-foreground" : "text-amber-600 dark:text-amber-400 font-medium"
                              )}>
                                {emp.deductPf !== false ? "PF 12%" : "No PF"}
                              </span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                              <Pencil className="h-3 w-3" /> Set Salary
                            </span>
                          )}
                        </button>
                      ) : (
                        <div className="flex flex-col items-end">
                          <span className="tabular-nums text-muted-foreground">{formatINR(emp.monthlyCtc)}</span>
                          {emp.monthlyCtc > 0 && (
                            <span className="text-[10px] tabular-nums text-muted-foreground">₹{perDayFor(emp.monthlyCtc)}/day</span>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {emp.deductPf !== false ? "PF 12%" : "No PF"}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {t ? formatINR(t.net) : "—"}
                    </TableCell>
                    <TableCell>
                      {meta ? (
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not generated</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {s ? (
                          <>
                            <Link
                              href={`/payroll/slip/${s.id}/print`}
                              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                              prefetch={false}
                            >
                              <FileText className="h-3.5 w-3.5" /> View
                            </Link>
                            {s.status === "draft" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => generate(emp.id)}
                                disabled={busyId === emp.id}
                                title="Recalculate slip with latest salary"
                              >
                                {busyId === emp.id ? "…" : "Recalc"}
                              </Button>
                            )}
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => generate(emp.id)}
                            disabled={busyId === emp.id}
                          >
                            {busyId === emp.id ? "…" : "Generate"}
                          </Button>
                        )}

                        {canManageSalary && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground hover:border-primary/50"
                            onClick={() => setSalaryTarget(emp)}
                            title="Set Salary & Job Details"
                          >
                            <Pencil className="h-3 w-3" />
                            <span>Set Salary</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Set / Edit Salary Dialog */}
      <SetSalaryDialog
        open={salaryTarget !== null}
        onClose={() => setSalaryTarget(null)}
        employee={salaryTarget}
        month={month}
        existingSlip={salaryTarget ? slipFor(salaryTarget.id) : null}
      />

      {/* Add New Employee Dialog */}
      <AddEmployeeDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        members={attendanceBoard?.members}
        existingEmployees={employees}
      />
    </div>
  );
}

function AddEmployeeDialog({
  open,
  onClose,
  members,
  existingEmployees,
}: {
  open: boolean;
  onClose: () => void;
  members?: AttendanceAdminBoard["members"];
  existingEmployees?: Employee[];
}) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [designation, setDesignation] = React.useState("");
  const [department, setDepartment] = React.useState<Department>("site");
  const [monthlyCtc, setMonthlyCtc] = React.useState("");
  const [joinDate, setJoinDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [phone, setPhone] = React.useState("");
  const { role } = useRole();
  const canCreateAccount = isAdminRole(role);
  const [createAccount, setCreateAccount] = React.useState(false);
  const [accountPassword, setAccountPassword] = React.useState("");
  const [accountRole, setAccountRole] = React.useState<Role>("supervisor");
  const [deductPf, setDeductPf] = React.useState(true);
  const [deductEsi, setDeductEsi] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Live breakdown calculations
  const numCtc = Math.max(0, Number(monthlyCtc) || 0);
  // Per-day pay this month (salary ÷ days in the current month), to the paisa.
  const perDay = (numCtc / SALARY_BASIS_DAYS).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const basic = numCtc;
  const pf = deductPf ? Math.round(basic * 0.12) : 0;
  const esi = deductEsi ? Math.round(numCtc * 0.0075) : 0;
  const estNet = Math.max(0, numCtc - pf - esi);

  // Find unlinked team members
  const unlinkedMembers = React.useMemo(() => {
    if (!members?.length || !existingEmployees) return [];
    const existingNames = new Set(existingEmployees.map((e) => e.name.toLowerCase()));
    // Employees only — client / subcontractor logins never go on payroll.
    return members.filter((m) => !isExternalRole(m.role) && !existingNames.has(m.name.toLowerCase()));
  }, [members, existingEmployees]);

  function handleSelectMember(userId: string) {
    const found = members?.find((m) => m.userId === userId);
    if (found) {
      setName(found.name);
      setDesignation(found.role ? roleLabel[found.role] || found.role : "");
      setDepartment(
        found.role === "pm" || found.role === "supervisor"
          ? "site"
          : found.role === "accountant"
          ? "accounts"
          : found.role === "architect"
          ? "design"
          : "site"
      );
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Name is required.");
    if (createAccount) {
      if (phone.replace(/\D/g, "").length < 6) return setError("A valid phone number is required for the login.");
      if (accountPassword.length < 6) return setError("Account password must be at least 6 characters.");
    }
    setSaving(true);
    setError(null);
    const res = await addEmployeeAction({
      name: name.trim(),
      designation: designation.trim(),
      department,
      monthlyCtc: numCtc,
      joinDate,
      phone: phone.trim(),
      deductPf,
      deductEsi,
      createAccount: createAccount && canCreateAccount,
      accountPassword: createAccount ? accountPassword : undefined,
      accountRole: createAccount ? accountRole : undefined,
    });
    setSaving(false);
    if (res.error) return setError(res.error);
    onClose();
    setName(""); setDesignation(""); setMonthlyCtc(""); setPhone("");
    setDeductPf(true); setDeductEsi(true);
    setCreateAccount(false); setAccountPassword("");
    router.refresh();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Add Employee to Payroll" description="Enroll an employee and configure their monthly salary." className="max-w-lg">
      <form onSubmit={submit} className="space-y-4">
        {unlinkedMembers.length > 0 && (
          <div className="rounded-lg border border-border/80 bg-muted/40 p-2.5">
            <Label htmlFor="m-link" className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <Users className="h-3 w-3" /> Quick pick from existing Team Members
            </Label>
            <Select id="m-link" value="" onChange={(e) => handleSelectMember(e.target.value)}>
              <option value="">-- Choose a team member (or type below) --</option>
              {unlinkedMembers.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name} ({m.employeeId || roleLabel[m.role] || m.role})
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="e-name">Name *</Label>
            <Input id="e-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-desig">Designation</Label>
            <Input id="e-desig" list="e-desig-suggestions" value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Site Engineer" />
            <DesignationSuggestions id="e-desig-suggestions" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-dept">Department</Label>
            <Select id="e-dept" value={department} onChange={(e) => setDepartment(e.target.value as Department)}>
              <DepartmentOptions />
            </Select>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="e-ctc">Monthly CTC (₹) *</Label>
              {numCtc > 0 && <span className="text-xs font-semibold text-primary">{formatINR(numCtc)}</span>}
            </div>
            <Input
              id="e-ctc"
              type="number"
              min="0"
              step="500"
              value={monthlyCtc}
              onChange={(e) => setMonthlyCtc(e.target.value)}
              placeholder="e.g. 30000"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-join">Join Date</Label>
            <Input id="e-join" type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-phone">Phone{createAccount ? " *" : ""}</Label>
            <Input id="e-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>

        {/* Statutory Deductions Options */}
        <div className="rounded-lg border border-border bg-muted/40 p-2.5 space-y-2">
          <div className="text-xs font-semibold text-foreground flex items-center justify-between">
            <span>Statutory Deductions (PF & ESI)</span>
            <span className="text-[11px] font-normal text-muted-foreground">Toggle per employee</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="flex items-start gap-2 cursor-pointer select-none rounded border border-border/70 bg-card p-2">
              <input
                type="checkbox"
                checked={deductPf}
                onChange={(e) => setDeductPf(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 rounded border-border text-primary"
              />
              <div>
                <span className="font-medium text-foreground block">Deduct PF</span>
                <span className="text-[10px] text-muted-foreground">
                  {deductPf ? "12% of basic" : "Exempt"}
                </span>
              </div>
            </label>
            <label className="flex items-start gap-2 cursor-pointer select-none rounded border border-border/70 bg-card p-2">
              <input
                type="checkbox"
                checked={deductEsi}
                onChange={(e) => setDeductEsi(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 rounded border-border text-primary"
              />
              <div>
                <span className="font-medium text-foreground block">Deduct ESI</span>
                <span className="text-[10px] text-muted-foreground">
                  {deductEsi ? "0.75% of gross" : "Exempt"}
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Live Payroll Breakdown Card */}
        {numCtc > 0 && (
          <div className="rounded-lg border border-border bg-card p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-1.5 text-foreground">
                <Calculator className="h-3 w-3 text-primary" /> Salary Breakdown
              </span>
              <span className="font-medium text-foreground">₹{perDay}/day (30-day basis)</span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs pt-1.5 border-t border-border/60">
              <div>
                <span className="text-muted-foreground block text-[10px]">Monthly Gross</span>
                <span className="font-semibold text-foreground">{formatINR(numCtc)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">{deductPf ? "PF (12%)" : "PF (Exempt)"}</span>
                <span className={cn("font-semibold", deductPf ? "text-destructive" : "text-muted-foreground")}>
                  {deductPf ? `-${formatINR(pf)}` : "₹0"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">{deductEsi ? "ESI (0.75%)" : "ESI (Exempt)"}</span>
                <span className={cn("font-semibold", deductEsi ? "text-destructive" : "text-muted-foreground")}>
                  {deductEsi ? `-${formatINR(esi)}` : "₹0"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">Est. Take-Home</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatINR(estNet)}</span>
              </div>
            </div>
          </div>
        )}

        {canCreateAccount && (
          <div className="rounded-lg border border-border p-3">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={createAccount}
                onChange={(e) => setCreateAccount(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <span className="text-sm font-medium">Create a login account for this employee</span>
            </label>
            {createAccount && (
              <>
                <p className="mt-1 text-xs text-muted-foreground">
                  They&apos;ll sign in with their <span className="font-medium">phone number</span> and this password.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="e-pass">Password *</Label>
                    <Input id="e-pass" type="password" value={accountPassword} onChange={(e) => setAccountPassword(e.target.value)} placeholder="Min 6 characters" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="e-role">Role</Label>
                    <Select id="e-role" value={accountRole} onChange={(e) => setAccountRole(e.target.value as Role)}>
                      {EMPLOYEE_ROLES.map((r) => <option key={r} value={r}>{roleLabel[r] ?? r}</option>)}
                    </Select>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Add Employee"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
