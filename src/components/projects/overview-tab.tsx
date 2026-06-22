"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { attendance } from "@/lib/mock/data";
import {
  expenseByCategory,
  expenseByCostCode,
  getProjectInvoices,
  lineTotalWithTax,
  projectPnL,
  taskProgressPercent,
} from "@/lib/mock/selectors";
import { useProjectTasks } from "@/lib/store/project-store";
import { taskStatusMeta } from "@/lib/labels";
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
  const pnl = projectPnL(projectId);
  const byCat = expenseByCategory(projectId);
  const byCode = expenseByCostCode(projectId);
  const invoices = getProjectInvoices(projectId);

  // Tasks come from the live store so newly added tasks update the gauge,
  // donut and schedule table immediately.
  const allTasks = useProjectTasks(projectId);
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

  const invoicedTotal = invoices.reduce((s, i) => s + lineTotalWithTax(i.items, i.taxRate), 0);
  const receivedTotal = invoices.reduce((s, i) => s + i.received, 0);
  const pendingTotal = invoicedTotal - receivedTotal;
  const receivedPct = invoicedTotal > 0 ? (receivedTotal / invoicedTotal) * 100 : 0;

  const financialHealth = [
    { label: "Value", value: pnl.projectValue },
    { label: "Expense", value: pnl.totalExpense },
    { label: "Invoiced", value: pnl.salesInvoiced },
    { label: "BOQ", value: pnl.boqValue },
  ];

  return (
    <div className="space-y-4">
      {/* top row: gauge + task donut + invoices KPI */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Project Completion</CardTitle>
          </CardHeader>
          <CardContent>
            <CompletionGauge value={completion} />
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Auto-calculated from task progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Task Status</CardTitle>
          </CardHeader>
          <CardContent>
            <TaskStatusDonut counts={counts} />
          </CardContent>
        </Card>

        <Card>
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
      </div>

      {/* financial health + expense category */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Financial Health</CardTitle>
          </CardHeader>
          <CardContent>
            <FinancialHealthChart data={financialHealth} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Total Expense by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpenseCategoryChart data={byCat} />
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
            <CostCodePie data={byCode} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Labour Attendance · last 7 days</CardTitle>
          </CardHeader>
          <CardContent>
            <AttendanceChart data={attendance} />
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
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
