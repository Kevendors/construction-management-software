import Link from "next/link";
import { ArrowRight, IndianRupee, TrendingUp, Wallet, Receipt } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrendChart, MarginTrendChart } from "@/components/charts/trend-charts";
import { BudgetVsActualChart, ProjectMarginChart } from "@/components/charts/bar-charts";
import { CashFlowChart } from "@/components/charts/cashflow-chart";
import { getCompanyDashboard } from "@/lib/data/dashboard";
import { projectStatusMeta } from "@/lib/labels";
import { formatINR } from "@/lib/utils";

export default async function CompanyDashboardPage() {
  const { totals, trend, margins, budget, flow, portfolio } = await getCompanyDashboard();

  return (
    <>
      <PageHeader
        title="Company Dashboard"
        description="Portfolio health across all active projects · 2026 H1"
      />

      {/* KPI cards (chart 12) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Portfolio Value"
          value={formatINR(totals.value, { compact: true })}
          icon={IndianRupee}
          accent="primary"
          hint={`${portfolio.length} projects`}
        />
        <StatCard
          label="Total Invoiced"
          value={formatINR(totals.invoiced, { compact: true })}
          icon={Receipt}
          accent="info"
          delta={{ value: `${formatINR(totals.received, { compact: true })} received`, positive: true }}
        />
        <StatCard
          label="Total Expense"
          value={formatINR(totals.expense, { compact: true })}
          icon={Wallet}
          accent="destructive"
        />
        <StatCard
          label="Gross Margin"
          value={formatINR(totals.margin, { compact: true })}
          icon={TrendingUp}
          accent="success"
          hint={`${((totals.margin / totals.value) * 100).toFixed(1)}% of value`}
        />
      </div>

      {/* trends */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sales Invoice Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={trend} dataKey="invoice" color="var(--chart-3)" label="Invoiced" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expense Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={trend} dataKey="expense" color="var(--chart-1)" label="Expense" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Margin Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <MarginTrendChart data={trend} />
          </CardContent>
        </Card>
      </div>

      {/* cash-flow (chart 14) */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Cash Flow — In / Out & Running Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <CashFlowChart data={flow} />
        </CardContent>
      </Card>

      {/* budget vs actual + margins */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Budget (BOQ) vs Actual Spend</CardTitle>
          </CardHeader>
          <CardContent>
            <BudgetVsActualChart data={budget} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Per-Project Margin</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectMarginChart data={margins} />
          </CardContent>
        </Card>
      </div>

      {/* portfolio table */}
      <Card className="mt-4">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Project Portfolio</CardTitle>
          <Link
            href="/projects"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            All projects <ArrowRight className="h-4 w-4" />
          </Link>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-48">Progress</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {portfolio.map(({ project: p, pnl, client }) => {
                const meta = projectStatusMeta[p.status];
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/projects/${p.id}`} className="font-medium hover:underline">
                        {p.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{p.code}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {client?.company}
                    </TableCell>
                    <TableCell>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={p.percentComplete} className="flex-1" />
                        <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                          {p.percentComplete}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatINR(p.value, { compact: true })}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      <span className={pnl.margin >= 0 ? "text-success" : "text-destructive"}>
                        {formatINR(pnl.margin, { compact: true })}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
