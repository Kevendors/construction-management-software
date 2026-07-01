"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { FinancialHealthChart } from "@/components/charts/bar-charts";
import type { ExpensesBoard } from "@/lib/data/expenses";
import { formatINR } from "@/lib/utils";

/** Sum expense amounts grouped by a key, sorted desc. */
function totalsBy<K extends string>(
  expenses: ExpensesBoard["expenses"],
  keyOf: (e: ExpensesBoard["expenses"][number]) => K
) {
  const map = new Map<K, number>();
  for (const e of expenses) map.set(keyOf(e), (map.get(keyOf(e)) ?? 0) + e.amount);
  return Array.from(map, ([key, amount]) => ({ key, amount })).sort((a, b) => b.amount - a.amount);
}

export function ExpensesReportsTab({ board }: { board: ExpensesBoard }) {
  const { expenses, projects, users } = board;
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const userById = new Map(users.map((u) => [u.id, u]));

  const byProject = totalsBy(expenses, (e) => e.projectId).map((r) => ({
    ...r,
    label: projectById.get(r.key)?.code ?? "—",
    name: projectById.get(r.key)?.name ?? "Unassigned",
  }));
  const byPerson = totalsBy(expenses, (e) => e.byId).map((r) => ({
    ...r,
    user: userById.get(r.key) ?? null,
    name: userById.get(r.key)?.name ?? "Unknown",
  }));

  const grandTotal = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-4">
      {/* Project-wise */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Project-wise Expenses</CardTitle></CardHeader>
          <CardContent>
            {byProject.length ? (
              <FinancialHealthChart data={byProject.map((r) => ({ label: r.label, value: r.amount }))} />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">No expenses yet.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Total by Project</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {byProject.map((r) => (
              <div key={r.key} className="flex items-center justify-between border-b border-border/60 py-1.5 text-sm last:border-0">
                <div className="min-w-0">
                  <span className="font-medium">{r.label}</span>
                  <span className="ml-2 truncate text-xs text-muted-foreground">{r.name}</span>
                </div>
                <span className="font-semibold tabular-nums">{formatINR(r.amount)}</span>
              </div>
            ))}
            {byProject.length > 0 && (
              <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatINR(grandTotal)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Person-wise */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Employee-wise Expenses</CardTitle></CardHeader>
          <CardContent>
            {byPerson.length ? (
              <FinancialHealthChart data={byPerson.map((r) => ({ label: r.name.split(" ")[0], value: r.amount }))} />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">No expenses yet.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Total by Person</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {byPerson.map((r) => (
              <div key={r.key} className="flex items-center justify-between border-b border-border/60 py-1.5 text-sm last:border-0">
                <div className="flex items-center gap-2">
                  {r.user && <Avatar initials={r.user.initials} color={r.user.avatarColor} className="h-6 w-6 text-[10px]" />}
                  <span className="font-medium">{r.name}</span>
                </div>
                <span className="font-semibold tabular-nums">{formatINR(r.amount)}</span>
              </div>
            ))}
            {byPerson.length > 0 && (
              <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatINR(grandTotal)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
