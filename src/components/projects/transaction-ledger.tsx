"use client";

import * as React from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useProjectTransactions } from "@/lib/store/project-store";
import { costCodeLabel, categoryLabel } from "@/lib/labels";
import { formatINR } from "@/lib/utils";

export function TransactionLedger({ projectId }: { projectId: string }) {
  const txns = useProjectTransactions(projectId);
  const [filter, setFilter] = React.useState<"all" | "in" | "out">("all");

  const sorted = [...txns].sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const filtered = filter === "all" ? sorted : sorted.filter((t) => t.direction === filter);

  let runningBalance = 0;
  const rows = filtered.map((t) => {
    runningBalance += t.direction === "in" ? t.amount : -t.amount;
    return { ...t, balance: runningBalance };
  });

  const totalIn = txns.filter((t) => t.direction === "in").reduce((s, t) => s + t.amount, 0);
  const totalOut = txns.filter((t) => t.direction === "out").reduce((s, t) => s + t.amount, 0);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Transaction Ledger</CardTitle>
        <div className="flex gap-1">
          {(["all", "in", "out"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : f === "in" ? "Inflow" : "Outflow"}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="mb-4 flex gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Total In: </span>
            <span className="font-semibold text-success">{formatINR(totalIn, { compact: true })}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Total Out: </span>
            <span className="font-semibold text-destructive">{formatINR(totalOut, { compact: true })}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Net: </span>
            <span className="font-semibold">{formatINR(totalIn - totalOut, { compact: true })}</span>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Direction</TableHead>
              <TableHead>Cost Code</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="text-muted-foreground">
                  {new Date(t.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                </TableCell>
                <TableCell>
                  {t.direction === "in" ? (
                    <Badge variant="success" className="gap-1">
                      <ArrowDownLeft className="h-3 w-3" /> In
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1">
                      <ArrowUpRight className="h-3 w-3" /> Out
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{costCodeLabel[t.costCode] || t.costCode}</TableCell>
                <TableCell>{categoryLabel[t.category] || t.category}</TableCell>
                <TableCell className="max-w-[200px] truncate text-muted-foreground">{t.note}</TableCell>
                <TableCell className={`text-right font-medium tabular-nums ${t.direction === "in" ? "text-success" : "text-destructive"}`}>
                  {t.direction === "in" ? "+" : "−"}{formatINR(t.amount)}
                </TableCell>
                <TableCell className={`text-right tabular-nums ${t.balance >= 0 ? "" : "text-destructive"}`}>
                  {formatINR(Math.abs(t.balance))}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                  No transactions recorded yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
