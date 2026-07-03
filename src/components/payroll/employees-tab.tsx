"use client";

import * as React from "react";
import Link from "next/link";
import { FileText, Plus, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PayrollBreakdownChart } from "@/components/charts/payroll-chart";
import { EmployeeDialog } from "./employee-dialog";
import { salarySlips } from "@/lib/mock/data";
import { getEmployee, payrollByDepartment, slipTotals } from "@/lib/mock/selectors";
import { departmentLabel, salarySlipStatusMeta } from "@/lib/labels";
import { formatINR } from "@/lib/utils";
import { useStore } from "@/lib/store/project-store";
import type { Employee } from "@/lib/types";

export function EmployeesTab({ month }: { month: string }) {
  const { employees, addEmployee, updateEmployee, deleteEmployee } = useStore();
  const slips = salarySlips.filter((s) => s.month === month);
  const breakdown = payrollByDepartment(month);
  const monthLabel = new Date(`${month}-01`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingEmployee, setEditingEmployee] = React.useState<Employee | undefined>();

  function handleAdd() {
    setEditingEmployee(undefined);
    setDialogOpen(true);
  }

  function handleEdit(emp: Employee) {
    setEditingEmployee(emp);
    setDialogOpen(true);
  }

  function handleSave(data: Omit<Employee, "id">) {
    if (editingEmployee) {
      updateEmployee(editingEmployee.id, data);
    } else {
      addEmployee(data);
    }
  }

  const [deleteTarget, setDeleteTarget] = React.useState<string | null>(null);

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteEmployee(deleteTarget);
    setDeleteTarget(null);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payroll Cost by Department — {monthLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <PayrollBreakdownChart data={breakdown} />
        </CardContent>
      </Card>

      {/* Employee Roster */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Employee Roster</CardTitle>
          <Button size="sm" onClick={handleAdd}>
            <Plus className="h-4 w-4" /> Add Employee
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead className="text-right">Monthly CTC</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar initials={emp.initials} color={emp.avatarColor} className="h-7 w-7 text-[11px]" />
                      <span className="font-medium">{emp.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{departmentLabel[emp.department]}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{emp.designation}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(emp.monthlyCtc)}</TableCell>
                  <TableCell className="text-muted-foreground">{emp.phone}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(emp)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(emp.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {employees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                    No employees yet. Click &quot;Add Employee&quot; to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Salary Run */}
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
                <TableHead className="text-right">Earnings</TableHead>
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Net Pay</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Slip</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slips.map((s) => {
                const emp = getEmployee(s.employeeId);
                const t = slipTotals(s);
                const meta = salarySlipStatusMeta[s.status];
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {emp && <Avatar initials={emp.initials} color={emp.avatarColor} className="h-7 w-7 text-[11px]" />}
                        <div>
                          <div className="font-medium">{emp?.name}</div>
                          <div className="text-xs text-muted-foreground">{emp?.designation}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{emp ? departmentLabel[emp.department] : ""}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(t.earnings)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      −{formatINR(t.deductions)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatINR(t.net)}</TableCell>
                    <TableCell>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/payroll/slip/${s.id}/print`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5" /> View
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
              {slips.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                    No salary slips for this month.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Employee" description="Are you sure you want to delete this employee?">
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
        </div>
      </Dialog>

      <EmployeeDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        initial={editingEmployee}
      />
    </div>
  );
}
