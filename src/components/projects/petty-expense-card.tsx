"use client";

import { Receipt } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useProjectExpenses, useProjectTransactions } from "@/lib/store/project-store";
import { categoryLabel } from "@/lib/labels";
import { formatINR } from "@/lib/utils";

export function PettyExpenseCard({ projectId }: { projectId: string }) {
  const expenses = useProjectExpenses(projectId);
  const txns = useProjectTransactions(projectId);

  // Derive petty expense data from out-direction transactions + direct expenses
  const outTxns = txns.filter((t) => t.direction === "out");
  const txnTotal = outTxns.reduce((s, t) => s + t.amount, 0);
  const expTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const totalExpense = txnTotal + expTotal;
  const pendingCount = expenses.filter((e) => e.status === "pending").length;
  const recentExpenses = expenses.slice(0, 3);

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2">
        <Receipt className="h-4 w-4 text-amber-500" />
        <CardTitle className="text-base">Petty Expenses</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Total Spent</p>
            <p className="text-xl font-bold tabular-nums">{formatINR(totalExpense, { compact: true })}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pending Approvals</p>
            <p className="text-xl font-bold tabular-nums">
              {pendingCount}
              {pendingCount > 0 && (
                <Badge variant="warning" className="ml-2 text-[10px]">
                  needs review
                </Badge>
              )}
            </p>
          </div>
        </div>

        {recentExpenses.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Recent</p>
            {recentExpenses.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {categoryLabel[e.category] || e.category}
                  </Badge>
                  <span className="text-muted-foreground truncate max-w-[120px]">{e.note}</span>
                </div>
                <span className="font-medium tabular-nums">{formatINR(e.amount)}</span>
              </div>
            ))}
          </div>
        )}

        {expenses.length === 0 && outTxns.length === 0 && (
          <p className="py-2 text-center text-xs text-muted-foreground">No petty expenses recorded.</p>
        )}
      </CardContent>
    </Card>
  );
}
