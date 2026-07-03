"use client";

import { AlertTriangle, AlertCircle, Info, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  useProject,
  useProjectDprs,
  useProjectInvoices,
  useProjectTasks,
  useProjectTransactions,
} from "@/lib/store/project-store";
import { lineTotalWithTax, taskProgressPercent } from "@/lib/mock/selectors";
import { deriveProjectAlerts, type AlertSeverity, type ProjectAlert } from "@/lib/projects/alerts";

/** Shared hook so the tab and its count badge derive the same alerts. */
export function useProjectAlerts(projectId: string): ProjectAlert[] {
  const project = useProject(projectId);
  const allTasks = useProjectTasks(projectId);
  const dprs = useProjectDprs(projectId);
  const invoices = useProjectInvoices(projectId);
  const txns = useProjectTransactions(projectId);

  if (!project) return [];

  const tasks = allTasks.filter((t) => t.parentId === null);
  const completion = tasks.length
    ? Math.round(tasks.reduce((s, t) => s + taskProgressPercent(t), 0) / tasks.length)
    : 0;
  const invoicedTotal = invoices.reduce((s, i) => s + lineTotalWithTax(i.items, i.taxRate), 0);
  const receivedTotal = invoices.reduce((s, i) => s + i.received, 0);
  const totalExpense = txns.filter((t) => t.direction === "out").reduce((s, t) => s + t.amount, 0);

  return deriveProjectAlerts({
    project,
    tasks: allTasks,
    dprs,
    completion,
    invoicedTotal,
    receivedTotal,
    totalExpense,
  });
}

const severityMeta: Record<AlertSeverity, { icon: typeof AlertTriangle; className: string; label: string }> = {
  high: { icon: AlertTriangle, className: "text-destructive", label: "High" },
  medium: { icon: AlertCircle, className: "text-amber-500", label: "Medium" },
  low: { icon: Info, className: "text-sky-500", label: "Low" },
};

export function AlertsTab({ projectId }: { projectId: string }) {
  const alerts = useProjectAlerts(projectId);

  if (alerts.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <CheckCircle2 className="h-8 w-8 text-success" />
          <p className="font-medium">All clear</p>
          <p className="text-sm text-muted-foreground">No schedule, budget or site-update risks detected for this project.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((a) => {
        const meta = severityMeta[a.severity];
        const Icon = meta.icon;
        return (
          <Card key={a.id}>
            <CardContent className="flex items-start gap-3 py-4">
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${meta.className}`} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{a.title}</p>
                  <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{a.detail}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
