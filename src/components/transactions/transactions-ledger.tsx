"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, IndianRupee } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TransactionsLedger } from "@/lib/data/transactions";
import { categoryLabel, costCodeLabel } from "@/lib/labels";
import { formatINR } from "@/lib/utils";

export function TransactionsLedgerView({ data }: { data: TransactionsLedger }) {
  const { rows, projects } = data;
  const [projectFilter, setProjectFilter] = React.useState("all");
  const [dirFilter, setDirFilter] = React.useState<"all" | "in" | "out">("all");

  const filtered = rows
    .filter((r) => projectFilter === "all" || r.transaction.projectId === projectFilter)
    .filter((r) => dirFilter === "all" || r.transaction.direction === dirFilter);

  const totals = filtered.reduce(
    (acc, r) => {
      if (r.transaction.direction === "in") acc.in += r.transaction.amount;
      else acc.out += r.transaction.amount;
      return acc;
    },
    { in: 0, out: 0 }
  );
  const net = totals.in - totals.out;

  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Money In" value={formatINR(totals.in, { compact: true })} icon={ArrowDownLeft} accent="success" />
        <StatCard label="Money Out" value={formatINR(totals.out, { compact: true })} icon={ArrowUpRight} accent="destructive" />
        <StatCard label="Net Position" value={formatINR(net, { compact: true })} icon={IndianRupee} accent={net >= 0 ? "primary" : "destructive"} />
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="h-8 w-52 text-xs">
              <option value="all">All projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
            </Select>
            <Select value={dirFilter} onChange={(e) => setDirFilter(e.target.value as "all" | "in" | "out")} className="h-8 w-36 text-xs">
              <option value="all">In &amp; Out</option>
              <option value="in">Money In</option>
              <option value="out">Money Out</option>
            </Select>
          </div>
          <span className="text-xs text-muted-foreground">{filtered.length} transactions</span>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Cost Code</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    No transactions match these filters.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map(({ transaction: t, project }) => {
                const isIn = t.direction === "in";
                return (
                  <TableRow key={t.id}>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {new Date(t.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </TableCell>
                    <TableCell>
                      {project ? (
                        <Link href={`/projects/${project.id}`} className="hover:underline">{project.code}</Link>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={isIn ? "success" : "destructive"}>{isIn ? "In" : "Out"}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{categoryLabel[t.category] ?? t.category}</TableCell>
                    <TableCell className="text-muted-foreground">{costCodeLabel[t.costCode] ?? t.costCode}</TableCell>
                    <TableCell className="max-w-[16rem] truncate text-muted-foreground">{t.note || "—"}</TableCell>
                    <TableCell className={`text-right font-semibold tabular-nums ${isIn ? "text-success" : "text-destructive"}`}>
                      {isIn ? "+" : "−"}{formatINR(t.amount)}
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
