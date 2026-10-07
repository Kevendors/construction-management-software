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
import type { PayrollBoard } from "@/lib/payroll/compute";
import { evaluateEmployeeMonthAttendance, type AttendanceAdminBoard } from "@/lib/attendance/compute";
import { payrollByDepartment, slipTotals } from "@/lib/payroll/compute";
import { addEmployeeAction, generateSlipAction } from "@/app/payroll/actions";
import { departmentLabel, salarySlipStatusMeta, roleLabel } from "@/lib/labels";
import { useRole } from "@/components/layout/role-provider";
import { isAdminRole } from "@/lib/auth/permissions";
import { cn, formatINR } from "@/lib/utils";
import type { Department, Employee, Role } from "@/lib/types";

const DEPARTMENTS: Department[] = ["engineering", "design", "site", "accounts", "admin"];
const ACCOUNT_ROLES: Role[] = ["supervisor", "pm", "super_admin"];

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

  // Count GPS verified attendance days and late/half-day evaluation for this employee in the active month
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
    const ev = evaluateEmployeeMonthAttendance(matching, month);
    return {
      rawDays: matching.length,
      fullDays: ev.fullDays,
      halfDays: ev.halfDays,
      lateCount: ev.lateCount,
      paidDays: ev.effectivePaidDays,
    };
  };

  async function generate(empId: string) {
    setBusyId(empId);
    const emp = employees.find((e) => e.id === empId);
    const stats = emp ? attendanceStatsFor(emp) : null;
    // Default to effective paid days (taking into account half days from late arrivals) if available and > 0, otherwise standard 30 days
    const daysToPay = stats && stats.paidDays > 0 ? stats.paidDays : 30;
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
                <TableHead>Department</TableHead>
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
                                title={`${stats.fullDays} full days, ${stats.halfDays} half days, ${stats.lateCount} late arrivals`}
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
                      <Badge variant="outline">{departmentLabel[emp.department]}</Badge>
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
  const perDay = Math.round(numCtc / 30);
  const basic = numCtc;
  const pf = deductPf ? Math.round(basic * 0.12) : 0;
  const esi = deductEsi ? Math.round(numCtc * 0.0075) : 0;
  const estNet = Math.max(0, numCtc - pf - esi);

  // Find unlinked team members
  const unlinkedMembers = React.useMemo(() => {
    if (!members?.length || !existingEmployees) return [];
    const existingNames = new Set(existingEmployees.map((e) => e.name.toLowerCase()));
    return members.filter((m) => !existingNames.has(m.name.toLowerCase()));
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
            <Input id="e-desig" value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Site Engineer" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-dept">Department</Label>
            <Select id="e-dept" value={department} onChange={(e) => setDepartment(e.target.value as Department)}>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{departmentLabel[d]}</option>)}
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
              <span className="font-medium text-foreground">{formatINR(perDay)}/day</span>
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
                      {ACCOUNT_ROLES.map((r) => <option key={r} value={r}>{roleLabel[r] ?? r}</option>)}
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
