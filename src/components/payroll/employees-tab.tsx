"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PayrollBreakdownChart } from "@/components/charts/payroll-chart";
import { salarySlips } from "@/lib/mock/data";
import { getEmployee, payrollByDepartment, slipTotals } from "@/lib/mock/selectors";
import { departmentLabel, salarySlipStatusMeta } from "@/lib/labels";
import { formatINR } from "@/lib/utils";

export function EmployeesTab({ month }: { month: string }) {
  const slips = salarySlips.filter((s) => s.month === month);
  const breakdown = payrollByDepartment(month);
  const monthLabel = new Date(`${month}-01`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

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
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
