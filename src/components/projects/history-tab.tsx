"use client";

import { FileText, AlertTriangle, Wallet, IndianRupee, ReceiptText, Receipt, History as HistoryIcon, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  useProjectDprs,
  useProjectExpenses,
  useProjectInstructions,
  useProjectInvoices,
  useProjectTransactions,
} from "@/lib/store/project-store";
import { deriveProjectHistory, type HistoryKind } from "@/lib/projects/history";

const META: Record<HistoryKind, { icon: LucideIcon; className: string }> = {
  dpr: { icon: FileText, className: "bg-sky-500/10 text-sky-500" },
  instruction: { icon: AlertTriangle, className: "bg-amber-500/10 text-amber-500" },
  expense_out: { icon: Wallet, className: "bg-destructive/10 text-destructive" },
  expense_in: { icon: IndianRupee, className: "bg-success/10 text-success" },
  invoice: { icon: ReceiptText, className: "bg-primary/10 text-primary" },
  petty: { icon: Receipt, className: "bg-muted text-muted-foreground" },
};

export function HistoryTab({ projectId }: { projectId: string }) {
  const events = deriveProjectHistory({
    dprs: useProjectDprs(projectId),
    instructions: useProjectInstructions(projectId),
    transactions: useProjectTransactions(projectId),
    invoices: useProjectInvoices(projectId),
    expenses: useProjectExpenses(projectId),
  });

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <HistoryIcon className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No activity yet</p>
          <p className="text-sm text-muted-foreground">
            DPRs, instructions, expenses, invoices and payments logged against this project will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-4">
        <ol className="relative space-y-4 border-l border-border pl-6">
          {events.map((e) => {
            const meta = META[e.kind];
            const Icon = meta.icon;
            return (
              <li key={e.id} className="relative">
                <span className={`absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full ${meta.className}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{e.title}</p>
                    <p className="text-sm text-muted-foreground">{e.detail}</p>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(e.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
