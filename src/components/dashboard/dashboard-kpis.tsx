"use client";

import * as React from "react";
import Link from "next/link";
import { IndianRupee, TrendingUp, Wallet, Receipt } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Dialog } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CompanyDashboard, PortfolioRow } from "@/lib/data/dashboard";
import { formatINR } from "@/lib/utils";

type MetricKey = "value" | "invoiced" | "expense" | "margin";

interface MetricDef {
  key: MetricKey;
  title: string;
  amount: (r: PortfolioRow) => number;
  secondary?: { label: string; value: (r: PortfolioRow) => number };
}

const METRICS: Record<MetricKey, MetricDef> = {
  value: { key: "value", title: "Portfolio Value by Project", amount: (r) => r.pnl.projectValue },
  invoiced: {
    key: "invoiced",
    title: "Invoiced by Project",
    amount: (r) => r.pnl.salesInvoiced,
    secondary: { label: "Received", value: (r) => r.pnl.salesReceived },
  },
  expense: { key: "expense", title: "Expense by Project", amount: (r) => r.pnl.totalExpense },
  margin: {
    key: "margin",
    title: "Gross Margin by Project",
    amount: (r) => r.pnl.margin,
    secondary: { label: "Margin %", value: (r) => r.pnl.marginPct },
  },
};

export function DashboardKpis({
  totals,
  portfolio,
  canSeeValue = true,
}: {
  totals: CompanyDashboard["totals"];
  portfolio: PortfolioRow[];
  canSeeValue?: boolean;
}) {
  const [open, setOpen] = React.useState<MetricKey | null>(null);
  const marginPct = totals.value > 0 ? ((totals.margin / totals.value) * 100).toFixed(1) : "0.0";

  return (
    <>
      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${canSeeValue ? "xl:grid-cols-4" : "xl:grid-cols-2"}`}>
        {canSeeValue && (
          <button type="button" onClick={() => setOpen("value")} className="text-left transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
            <StatCard label="Portfolio Value" value={formatINR(totals.value, { compact: true })} icon={IndianRupee} accent="primary" hint={`${portfolio.length} projects`} />
          </button>
        )}
        <button type="button" onClick={() => setOpen("invoiced")} className="text-left transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
          <StatCard label="Total Invoiced" value={formatINR(totals.invoiced, { compact: true })} icon={Receipt} accent="info" delta={{ value: `${formatINR(totals.received, { compact: true })} received`, positive: true }} />
        </button>
        <button type="button" onClick={() => setOpen("expense")} className="text-left transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
          <StatCard label="Total Expense" value={formatINR(totals.expense, { compact: true })} icon={Wallet} accent="destructive" />
        </button>
        {canSeeValue && (
          <button type="button" onClick={() => setOpen("margin")} className="text-left transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
            <StatCard label="Gross Margin" value={formatINR(totals.margin, { compact: true })} icon={TrendingUp} accent="success" hint={`${marginPct}% of value`} />
          </button>
        )}
      </div>

      {open && (
        <MetricDialog
          metric={METRICS[open]}
          portfolio={portfolio}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

function MetricDialog({
  metric,
  portfolio,
  onClose,
}: {
  metric: MetricDef;
  portfolio: PortfolioRow[];
  onClose: () => void;
}) {
  const rows = [...portfolio].sort((a, b) => metric.amount(b) - metric.amount(a));
  const total = rows.reduce((s, r) => s + metric.amount(r), 0);
  const isPct = metric.key === "margin";

  return (
    <Dialog open onClose={onClose} title={metric.title} description="Per-project breakdown" className="max-w-2xl">
      <div className="max-h-[60vh] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              {metric.secondary && <TableHead className="text-right">{metric.secondary.label}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.project.id}>
                <TableCell>
                  <Link href={`/projects/${r.project.id}`} className="font-medium hover:underline" onClick={onClose}>
                    {r.project.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">{r.project.code}{r.client?.company ? ` · ${r.client.company}` : ""}</div>
                </TableCell>
                <TableCell className={`text-right tabular-nums ${metric.key === "margin" ? (metric.amount(r) >= 0 ? "text-success" : "text-destructive") : ""}`}>
                  {formatINR(metric.amount(r))}
                </TableCell>
                {metric.secondary && (
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {metric.secondary.label === "Margin %"
                      ? `${metric.secondary.value(r).toFixed(1)}%`
                      : formatINR(metric.secondary.value(r))}
                  </TableCell>
                )}
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={metric.secondary ? 3 : 2} className="py-8 text-center text-sm text-muted-foreground">
                  No projects to show.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {!isPct && rows.length > 0 && (
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
          <span className="font-medium">Total</span>
          <span className="font-bold tabular-nums">{formatINR(total)}</span>
        </div>
      )}
    </Dialog>
  );
}
