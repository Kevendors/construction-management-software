"use client";

import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { supervisorBalancesFrom } from "./compute";
import type { ExpensesBoard } from "@/lib/data/expenses";
import { cn, formatINR } from "@/lib/utils";

export function SupervisorBalanceTab({ board }: { board: ExpensesBoard }) {
  const { ledger, users, projects } = board;
  const userById = new Map(users.map((u) => [u.id, u]));
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const balances = supervisorBalancesFrom(ledger);

  if (balances.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No supervisor imprest entries yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {balances.map((b) => {
        const sup = userById.get(b.supervisorId) ?? null;
        const entries = ledger
          .filter((e) => e.supervisorId === b.supervisorId)
          .sort((a, z) => +new Date(z.date) - +new Date(a.date));
        return (
          <Card key={b.supervisorId}>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {sup && <Avatar initials={sup.initials} color={sup.avatarColor} className="h-8 w-8 text-xs" />}
                <div>
                  <CardTitle className="text-base">{sup?.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">Site supervisor imprest</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Balance in hand</p>
                <p className={cn("text-lg font-bold tabular-nums", b.balance >= 0 ? "text-success" : "text-destructive")}>
                  {formatINR(b.balance)}
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-success/10 px-3 py-2">
                  <p className="text-xs text-muted-foreground">I Received</p>
                  <p className="font-semibold tabular-nums text-success">{formatINR(b.received)}</p>
                </div>
                <div className="rounded-lg bg-destructive/10 px-3 py-2">
                  <p className="text-xs text-muted-foreground">I Paid</p>
                  <p className="font-semibold tabular-nums text-destructive">{formatINR(b.paid)}</p>
                </div>
              </div>
              <ul className="space-y-1.5">
                {entries.map((e) => {
                  const received = e.direction === "received";
                  return (
                    <li key={e.id} className="flex items-center gap-2 border-b border-border/60 py-1.5 text-sm last:border-0">
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                          received ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                        )}
                      >
                        {received ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{e.note}</p>
                        <p className="text-xs text-muted-foreground">
                          {projectById.get(e.projectId)?.code} ·{" "}
                          {new Date(e.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                        </p>
                      </div>
                      <span className={cn("tabular-nums font-medium", received ? "text-success" : "text-destructive")}>
                        {received ? "+" : "−"}
                        {formatINR(e.amount)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
