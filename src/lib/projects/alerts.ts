import type { Dpr, Project, Task } from "@/lib/types";

export type AlertSeverity = "high" | "medium" | "low";

export interface ProjectAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
}

export interface AlertInput {
  project: Project;
  tasks: Task[];
  dprs: Dpr[];
  completion: number; // 0-100, from task progress
  invoicedTotal: number;
  receivedTotal: number;
  totalExpense: number;
}

const DAY = 86400000;
const daysBetween = (a: number, b: number) => Math.round((a - b) / DAY);
const parse = (d: string) => (d ? new Date(d).getTime() : NaN);

/**
 * Derive live health alerts for a project from its schedule, site logs and
 * finances. Pure + deterministic so it can run on the client from the store.
 */
export function deriveProjectAlerts(input: AlertInput): ProjectAlert[] {
  const { project, tasks, dprs, completion, invoicedTotal, receivedTotal, totalExpense } = input;
  const alerts: ProjectAlert[] = [];
  const now = Date.now();
  const done = project.status === "completed" || completion >= 100;

  // 1. Project past its planned end date.
  const end = parse(project.endDate);
  if (!Number.isNaN(end) && end < now && !done) {
    const overdue = daysBetween(now, end);
    alerts.push({
      id: "deadline",
      severity: "high",
      title: "Project past deadline",
      detail: `Planned completion was ${overdue} day${overdue === 1 ? "" : "s"} ago and the project is at ${completion}%.`,
    });
  }

  // 2. Overdue tasks (incomplete + end date passed).
  const overdueTasks = tasks.filter(
    (t) => t.status !== "completed" && !Number.isNaN(parse(t.endDate)) && parse(t.endDate) < now
  );
  if (overdueTasks.length) {
    alerts.push({
      id: "overdue-tasks",
      severity: "high",
      title: `${overdueTasks.length} overdue task${overdueTasks.length === 1 ? "" : "s"}`,
      detail: overdueTasks.slice(0, 3).map((t) => t.name).join(", ") + (overdueTasks.length > 3 ? "…" : ""),
    });
  }

  // 3. Delayed tasks flagged with delay days (not already counted as overdue).
  const delayed = tasks.filter((t) => t.delayDays > 0 && !overdueTasks.includes(t));
  if (delayed.length) {
    const maxDelay = Math.max(...delayed.map((t) => t.delayDays));
    alerts.push({
      id: "delayed-tasks",
      severity: "medium",
      title: `${delayed.length} delayed task${delayed.length === 1 ? "" : "s"}`,
      detail: `Up to ${maxDelay} day${maxDelay === 1 ? "" : "s"} behind — ${delayed.slice(0, 3).map((t) => t.name).join(", ")}.`,
    });
  }

  // 4. Behind schedule: elapsed time far ahead of completion.
  const start = parse(project.startDate);
  if (!Number.isNaN(start) && !Number.isNaN(end) && end > start && !done) {
    const elapsedPct = Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)));
    if (elapsedPct - completion >= 20) {
      alerts.push({
        id: "behind-schedule",
        severity: "medium",
        title: "Behind schedule",
        detail: `${elapsedPct}% of the timeline has elapsed but only ${completion}% is complete.`,
      });
    }
  }

  // 5. Budget: expenses vs project value.
  if (project.value > 0) {
    const pct = Math.round((totalExpense / project.value) * 100);
    if (totalExpense > project.value) {
      alerts.push({
        id: "budget-over",
        severity: "high",
        title: "Expenses exceed project value",
        detail: `Spent ${pct}% of the project value in booked expenses.`,
      });
    } else if (pct >= 85) {
      alerts.push({
        id: "budget-near",
        severity: "medium",
        title: "Expenses nearing budget",
        detail: `${pct}% of the project value already spent.`,
      });
    }
  }

  // 6. Outstanding client payments.
  const outstanding = invoicedTotal - receivedTotal;
  if (outstanding > 0 && invoicedTotal > 0) {
    const pct = Math.round((outstanding / invoicedTotal) * 100);
    alerts.push({
      id: "payment-pending",
      severity: pct >= 50 ? "medium" : "low",
      title: "Client payment outstanding",
      detail: `${pct}% of invoiced amount is yet to be received.`,
    });
  }

  // 7. Stale site updates: no DPR recently.
  if (!done) {
    const latest = dprs.reduce((m, d) => Math.max(m, parse(d.date) || 0), 0);
    if (latest === 0) {
      alerts.push({
        id: "no-dpr",
        severity: "low",
        title: "No site updates logged",
        detail: "No daily progress report has been recorded for this project yet.",
      });
    } else {
      const gap = daysBetween(now, latest);
      if (gap >= 7) {
        alerts.push({
          id: "stale-dpr",
          severity: "medium",
          title: "Site updates are stale",
          detail: `The last daily progress report was ${gap} days ago.`,
        });
      }
    }
  }

  const order: Record<AlertSeverity, number> = { high: 0, medium: 1, low: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}
