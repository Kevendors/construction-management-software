"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Receipt, IndianRupee, Wallet, Users, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CompletionGauge } from "@/components/charts/completion-gauge";
import { TaskStatusDonut } from "@/components/charts/task-status-donut";
import { FinancialHealthChart, ExpenseCategoryChart, AttendanceChart } from "@/components/charts/bar-charts";
import { CostCodePie } from "@/components/charts/cost-code-pie";
import {
  AddAttendanceDialog,
  AddExpenseDialog,
  AddInvoiceDialog,
  RecordPaymentDialog,
} from "./project-dialogs";
import { Dialog } from "@/components/ui/dialog";
import { boqValue, lineTotalWithTax, taskProgressPercent } from "@/lib/mock/selectors";
import {
  useProject,
  useProjectAttendance,
  useProjectExpenses,
  useProjectInvoices,
  useProjectTasks,
  useProjectTransactions,
} from "@/lib/store/project-store";
import { taskStatusMeta, approvalMeta } from "@/lib/labels";
import { useRole } from "@/components/layout/role-provider";
import { formatINR } from "@/lib/utils";
import type { ProgressUnit, TaskStatus } from "@/lib/types";

function progressText(value: number, target: number, unit: ProgressUnit) {
  if (unit === "percent" || unit === "lumpsum") return `${Math.round(taskProgressPercentRaw(value, target))}%`;
  return `${value} / ${target} ${unit}`;
}
function taskProgressPercentRaw(value: number, target: number) {
  return target > 0 ? Math.min(100, (value / target) * 100) : 0;
}

export function OverviewTab({ projectId }: { projectId: string }) {
  const project = useProject(projectId);
  const { role } = useRole();
  const isSupervisor = role === "supervisor";
  const canSeeValue = role === "super_admin";

  // Everything reads from the live store so all charts update on any edit.
  const allTasks = useProjectTasks(projectId);
  const txns = useProjectTransactions(projectId);
  const invoices = useProjectInvoices(projectId);
  const attendance = useProjectAttendance(projectId);
  const pettyExpenses = useProjectExpenses(projectId);

  const [expenseOpen, setExpenseOpen] = React.useState(false);
  const [invoiceOpen, setInvoiceOpen] = React.useState(false);
  const [paymentOpen, setPaymentOpen] = React.useState(false);
  const [attendanceOpen, setAttendanceOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<null | "completion" | "tasks" | "invoices">(null);

  const tasks = allTasks.filter((t) => t.parentId === null);
  const counts = allTasks.reduce(
    (acc, t) => {
      acc[t.status]++;
      return acc;
    },
    { not_started: 0, ongoing: 0, delayed: 0, completed: 0 } as Record<TaskStatus, number>
  );
  const completion = tasks.length
    ? Math.round(tasks.reduce((s, t) => s + taskProgressPercent(t), 0) / tasks.length)
    : 0;

  const out = txns.filter((t) => t.direction === "out");
  const catMap = new Map<string, number>();
  const codeMap = new Map<string, number>();
  for (const t of out) {
    catMap.set(t.category, (catMap.get(t.category) ?? 0) + t.amount);
    codeMap.set(t.costCode, (codeMap.get(t.costCode) ?? 0) + t.amount);
  }
  const byCat = Array.from(catMap, ([category, amount]) => ({ category, amount }));
  const byCode = Array.from(codeMap, ([costCode, amount]) => ({ costCode, amount }));

  const invoicedTotal = invoices.reduce((s, i) => s + lineTotalWithTax(i.items, i.taxRate), 0);
  const receivedTotal = invoices.reduce((s, i) => s + i.received, 0);
  const pendingTotal = invoicedTotal - receivedTotal;
  const receivedPct = invoicedTotal > 0 ? (receivedTotal / invoicedTotal) * 100 : 0;

  const totalExpense = out.reduce((s, t) => s + t.amount, 0);

  // Petty expenses logged against this project (separate from ledger transactions).
  const pettyTotal = pettyExpenses.reduce((s, e) => s + e.amount, 0);
  const pettyApproved = pettyExpenses.filter((e) => e.status === "approved").reduce((s, e) => s + e.amount, 0);
  const pettyPending = pettyExpenses.filter((e) => e.status === "pending").reduce((s, e) => s + e.amount, 0);
  const financialHealth = [
    { label: "Value", value: project?.value ?? 0 },
    { label: "Expense", value: totalExpense },
    { label: "Invoiced", value: invoicedTotal },
    { label: "BOQ", value: boqValue(projectId) },
  ];

  const nextInvoiceNumber = `INV-2026-${100 + invoices.length + 1}`;

  return (
    <div className="space-y-4">
      {/* live-data action toolbar */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setExpenseOpen(true)}>
          <Wallet /> Add Expense
        </Button>
        {!isSupervisor && (
          <>
            <Button size="sm" variant="outline" onClick={() => setInvoiceOpen(true)}>
              <Receipt /> Add Invoice
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPaymentOpen(true)}>
              <IndianRupee /> Record Payment
            </Button>
          </>
        )}
        <Button size="sm" variant="outline" onClick={() => setAttendanceOpen(true)}>
          <Users /> Add Attendance
        </Button>
      </div>

      {/* top row: gauge + task donut + invoices KPI — click any card to drill in */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card
          role="button"
          tabIndex={0}
          onClick={() => setDetail("completion")}
          onKeyDown={(e) => { if (e.key === "Enter") setDetail("completion"); }}
          className="cursor-pointer transition hover:border-primary/40 hover:shadow-sm"
        >
          <CardHeader>
            <CardTitle className="text-base">Project Completion</CardTitle>
          </CardHeader>
          <CardContent>
            <CompletionGauge value={completion} />
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Auto-calculated from task progress · click for details
            </p>
          </CardContent>
        </Card>

        <Card
          role="button"
          tabIndex={0}
          onClick={() => setDetail("tasks")}
          onKeyDown={(e) => { if (e.key === "Enter") setDetail("tasks"); }}
          className="cursor-pointer transition hover:border-primary/40 hover:shadow-sm"
        >
          <CardHeader>
            <CardTitle className="text-base">Task Status</CardTitle>
          </CardHeader>
          <CardContent>
            <TaskStatusDonut counts={counts} />
          </CardContent>
        </Card>

        {!isSupervisor && (
          <Card
            role="button"
            tabIndex={0}
            onClick={() => setDetail("invoices")}
            onKeyDown={(e) => { if (e.key === "Enter") setDetail("invoices"); }}
            className="cursor-pointer transition hover:border-primary/40 hover:shadow-sm"
          >
            <CardHeader>
              <CardTitle className="text-base">Sales Invoices</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">Total raised</p>
                <p className="text-2xl font-bold">{formatINR(invoicedTotal, { compact: true })}</p>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Received</span>
                  <span className="font-medium text-success">
                    {formatINR(receivedTotal, { compact: true })}
                  </span>
                </div>
                <Progress value={receivedPct} indicatorClassName="bg-success" />
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Pending</span>
                  <span className="font-medium">{formatINR(pendingTotal, { compact: true })}</span>
                </div>
                <p className="text-xs text-muted-foreground">{receivedPct.toFixed(0)}% collected</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* petty expenses logged against this project */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Petty Expenses</CardTitle>
          <Link
            href="/expenses"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Open module <ArrowRight className="h-4 w-4" />
          </Link>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Total ({pettyExpenses.length})</p>
              <p className="mt-1 text-lg font-bold tabular-nums">{formatINR(pettyTotal)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Approved</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-success">{formatINR(pettyApproved)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-amber-500">{formatINR(pettyPending)}</p>
            </div>
          </div>
          {pettyExpenses.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No petty expenses logged for this project yet.
            </p>
          ) : (
            <Table className="mt-3">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pettyExpenses.slice(0, 5).map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {new Date(e.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </TableCell>
                    <TableCell className="font-medium">{e.title || e.note || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={approvalMeta[e.status].variant}>{approvalMeta[e.status].label}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(e.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* financial health + expense category */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {canSeeValue && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Financial Health</CardTitle>
            </CardHeader>
            <CardContent>
              <FinancialHealthChart data={financialHealth} />
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Total Expense by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {byCat.length ? (
              <ExpenseCategoryChart data={byCat} />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">No expenses recorded yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* cost code pie + attendance */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expense Analysis by Cost Code</CardTitle>
          </CardHeader>
          <CardContent>
            {byCode.length ? (
              <CostCodePie data={byCode} />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">No expenses recorded yet.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Labour Attendance · last 7 days</CardTitle>
          </CardHeader>
          <CardContent>
            {attendance.length ? (
              <AttendanceChart data={attendance} />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No attendance logged yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* schedule table (chart 7) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Task Schedule</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-56">Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((t) => {
                const meta = taskStatusMeta[t.status];
                const pct = taskProgressPercent(t);
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(t.startDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(t.endDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                      {t.delayDays > 0 && (
                        <span className="ml-1 text-xs font-medium text-destructive">
                          +{t.delayDays}d
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={pct}
                          className="flex-1"
                          indicatorClassName={t.status === "delayed" ? "bg-destructive" : undefined}
                        />
                        <span className="w-28 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                          {progressText(t.progressValue, t.progressTarget, t.unit)}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {tasks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                    No tasks yet — add one from the Tasks tab.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AddExpenseDialog projectId={projectId} open={expenseOpen} onClose={() => setExpenseOpen(false)} />
      <AddInvoiceDialog
        projectId={projectId}
        clientId={project?.clientId ?? ""}
        open={invoiceOpen}
        onClose={() => setInvoiceOpen(false)}
        nextNumber={nextInvoiceNumber}
      />
      <RecordPaymentDialog projectId={projectId} open={paymentOpen} onClose={() => setPaymentOpen(false)} />
      <AddAttendanceDialog projectId={projectId} open={attendanceOpen} onClose={() => setAttendanceOpen(false)} />

      {/* card drill-downs */}
      <Dialog
        open={detail === "completion" || detail === "tasks"}
        onClose={() => setDetail(null)}
        title={detail === "completion" ? "Project Completion" : "Task Status"}
        description={
          detail === "completion"
            ? `${completion}% complete · progress by task`
            : `${allTasks.length} tasks — ${counts.completed} completed, ${counts.ongoing} ongoing, ${counts.delayed} delayed`
        }
        className="max-w-2xl"
      >
        <div className="max-h-[60vh] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-40 text-right">Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((t) => {
                const meta = taskStatusMeta[t.status];
                const pct = taskProgressPercent(t);
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell><Badge variant={meta.variant}>{meta.label}</Badge></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={pct} className="flex-1" indicatorClassName={t.status === "delayed" ? "bg-destructive" : undefined} />
                        <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{Math.round(pct)}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {tasks.length === 0 && (
                <TableRow><TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">No tasks yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Dialog>

      <Dialog
        open={detail === "invoices"}
        onClose={() => setDetail(null)}
        title="Sales Invoices"
        description={`${invoices.length} invoice(s) · ${formatINR(receivedTotal)} of ${formatINR(invoicedTotal)} received`}
        className="max-w-2xl"
      >
        <div className="max-h-[60vh] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Pending</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => {
                const total = lineTotalWithTax(inv.items, inv.taxRate);
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.number}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {new Date(inv.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(total)}</TableCell>
                    <TableCell className="text-right tabular-nums text-success">{formatINR(inv.received)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(Math.max(0, total - inv.received))}</TableCell>
                  </TableRow>
                );
              })}
              {invoices.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">No invoices raised for this project.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Dialog>
    </div>
  );
}
