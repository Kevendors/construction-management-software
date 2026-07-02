import type { AppNotification, Expense, SalesInvoice, Task, Transaction } from "./types";

function genAlertId(prefix: string, entityId: string) {
  return `alert-${prefix}-${entityId}`;
}

const today = new Date().toISOString().slice(0, 10);

export function generateProjectAlerts(
  projectId: string,
  tasks: Task[],
  invoices: SalesInvoice[],
  expenses: Expense[],
  transactions: Transaction[],
  projectValue?: number,
): AppNotification[] {
  const alerts: AppNotification[] = [];

  // Delayed tasks
  for (const t of tasks) {
    if (t.projectId !== projectId) continue;
    if (t.delayDays > 0) {
      alerts.push({
        id: genAlertId("delay", t.id),
        kind: "delay",
        title: "Task Delayed",
        body: `"${t.name}" is delayed by ${t.delayDays} day${t.delayDays > 1 ? "s" : ""}`,
        date: today,
        read: false,
      });
    }
  }

  // Overdue invoices
  for (const inv of invoices) {
    if (inv.projectId !== projectId) continue;
    const total = inv.items.reduce((s, li) => s + li.qty * li.rate, 0);
    const totalWithTax = total + (total * inv.taxRate) / 100;
    if (inv.dueDate < today && inv.received < totalWithTax && inv.status !== "paid") {
      alerts.push({
        id: genAlertId("overdue", inv.id),
        kind: "payment",
        title: "Invoice Overdue",
        body: `Invoice ${inv.number} is past due date (${new Date(inv.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })})`,
        date: today,
        read: false,
      });
    }
  }

  // Pending expense approvals
  const pendingExpenses = expenses.filter((e) => e.projectId === projectId && e.status === "pending");
  if (pendingExpenses.length > 0) {
    alerts.push({
      id: genAlertId("pending-exp", projectId),
      kind: "approval",
      title: "Pending Approvals",
      body: `${pendingExpenses.length} expense${pendingExpenses.length > 1 ? "s" : ""} awaiting approval`,
      date: today,
      read: false,
    });
  }

  // Budget overrun
  if (projectValue && projectValue > 0) {
    const totalExpense = transactions
      .filter((t) => t.projectId === projectId && t.direction === "out")
      .reduce((s, t) => s + t.amount, 0);
    if (totalExpense > projectValue) {
      alerts.push({
        id: genAlertId("budget", projectId),
        kind: "payment",
        title: "Budget Overrun",
        body: `Total expenses have exceeded the project value`,
        date: today,
        read: false,
      });
    }
  }

  // Tasks approaching deadline (within 7 days) and not completed
  for (const t of tasks) {
    if (t.projectId !== projectId || t.status === "completed") continue;
    const daysLeft = Math.floor((+new Date(t.endDate) - Date.now()) / 86400000);
    if (daysLeft >= 0 && daysLeft <= 7) {
      alerts.push({
        id: genAlertId("deadline", t.id),
        kind: "info",
        title: "Deadline Approaching",
        body: `"${t.name}" is due in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
        date: today,
        read: false,
      });
    }
  }

  return alerts;
}
