"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Plus } from "lucide-react";
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
import type { PayrollBoard } from "@/lib/payroll/compute";
import { payrollByDepartment, slipTotals } from "@/lib/payroll/compute";
import { addEmployeeAction, generateSlipAction } from "@/app/payroll/actions";
import { departmentLabel, salarySlipStatusMeta } from "@/lib/labels";
import { formatINR } from "@/lib/utils";
import type { Department } from "@/lib/types";

const DEPARTMENTS: Department[] = ["engineering", "design", "site", "accounts", "admin"];

export function EmployeesTab({
  board,
  month,
  onMonthChange,
}: {
  board: PayrollBoard;
  month: string;
  onMonthChange: (m: string) => void;
}) {
  const router = useRouter();
  const { employees, slips } = board;
  const [addOpen, setAddOpen] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const breakdown = payrollByDepartment(slips, employees, month);
  const slipFor = (empId: string) => slips.find((s) => s.employeeId === empId && s.month === month) ?? null;
  const monthLabel = new Date(`${month}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  async function generate(empId: string) {
    setBusyId(empId);
    const res = await generateSlipAction(empId, month, 30);
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
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus /> Add Employee
        </Button>
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
                <TableHead className="text-right">Slip</TableHead>
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
                return (
                  <TableRow key={emp.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar initials={emp.initials} color={emp.avatarColor} className="h-7 w-7 text-[11px]" />
                        <div>
                          <div className="font-medium">{emp.name}</div>
                          <div className="text-xs text-muted-foreground">{emp.designation}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{departmentLabel[emp.department]}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{formatINR(emp.monthlyCtc)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{t ? formatINR(t.net) : "—"}</TableCell>
                    <TableCell>{meta ? <Badge variant={meta.variant}>{meta.label}</Badge> : <span className="text-xs text-muted-foreground">Not generated</span>}</TableCell>
                    <TableCell className="text-right">
                      {s ? (
                        <Link
                          href={`/payroll/slip/${s.id}/print`}
                          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                          <FileText className="h-3.5 w-3.5" /> View
                        </Link>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => generate(emp.id)} disabled={busyId === emp.id}>
                          {busyId === emp.id ? "…" : "Generate"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AddEmployeeDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

function AddEmployeeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [designation, setDesignation] = React.useState("");
  const [department, setDepartment] = React.useState<Department>("site");
  const [monthlyCtc, setMonthlyCtc] = React.useState("");
  const [joinDate, setJoinDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [phone, setPhone] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Name is required.");
    setSaving(true);
    setError(null);
    const res = await addEmployeeAction({
      name: name.trim(),
      designation: designation.trim(),
      department,
      monthlyCtc: Number(monthlyCtc) || 0,
      joinDate,
      phone: phone.trim(),
    });
    setSaving(false);
    if (res.error) return setError(res.error);
    onClose();
    setName(""); setDesignation(""); setMonthlyCtc(""); setPhone("");
    router.refresh();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Add Employee" description="Add a staff member to the payroll." className="max-w-lg">
      <form onSubmit={submit} className="space-y-4">
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
            <Label htmlFor="e-ctc">Monthly CTC (₹)</Label>
            <Input id="e-ctc" type="number" value={monthlyCtc} onChange={(e) => setMonthlyCtc(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-join">Join Date</Label>
            <Input id="e-join" type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-phone">Phone</Label>
            <Input id="e-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Add Employee"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
