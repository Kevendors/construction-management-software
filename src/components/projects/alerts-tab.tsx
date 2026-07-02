"use client";

import {
  ClipboardCheck,
  AlertTriangle,
  ReceiptText,
  PackageX,
  Info,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { generateProjectAlerts } from "@/lib/alerts";
import {
  useProjectTasks,
  useProjectInvoices,
  useProjectTransactions,
  useProjectExpenses,
} from "@/lib/store/project-store";
import { getProject } from "@/lib/mock/selectors";
import type { NotificationKind } from "@/lib/types";

const ICON: Record<NotificationKind, { icon: LucideIcon; tint: string }> = {
  approval: { icon: ClipboardCheck, tint: "bg-blue-500/15 text-blue-500" },
  delay: { icon: AlertTriangle, tint: "bg-destructive/15 text-destructive" },
  payment: { icon: ReceiptText, tint: "bg-amber-500/15 text-amber-600" },
  stock: { icon: PackageX, tint: "bg-destructive/15 text-destructive" },
  info: { icon: Info, tint: "bg-primary/10 text-primary" },
};

const KIND_LABEL: Record<NotificationKind, string> = {
  approval: "Approval",
  delay: "Delay",
  payment: "Payment",
  stock: "Stock",
  info: "Info",
};

export function AlertsTab({ projectId }: { projectId: string }) {
  const tasks = useProjectTasks(projectId);
  const invoices = useProjectInvoices(projectId);
  const expenses = useProjectExpenses(projectId);
  const transactions = useProjectTransactions(projectId);
  const project = getProject(projectId);

  const alerts = generateProjectAlerts(
    projectId,
    tasks,
    invoices,
    expenses,
    transactions,
    project?.value,
  );

  if (alerts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">No alerts for this project. Everything looks good!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Project Alerts
            <Badge variant="destructive" className="ml-2">{alerts.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {alerts.map((alert) => {
            const { icon: Icon, tint } = ICON[alert.kind];
            return (
              <div
                key={alert.id}
                className="flex items-start gap-3 rounded-lg border border-border p-3"
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tint}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{alert.title}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {KIND_LABEL[alert.kind]}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{alert.body}</p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

/** Returns the count of project alerts (for badge display). */
export function useProjectAlertCount(projectId: string) {
  const tasks = useProjectTasks(projectId);
  const invoices = useProjectInvoices(projectId);
  const expenses = useProjectExpenses(projectId);
  const transactions = useProjectTransactions(projectId);
  const project = getProject(projectId);

  return generateProjectAlerts(projectId, tasks, invoices, expenses, transactions, project?.value).length;
}
