"use client";

import { buildGantt } from "@/lib/mock/selectors";
import { taskStatusMeta } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";

const STATUS_BAR: Record<string, string> = {
  not_started: "bg-muted-foreground/40",
  ongoing: "bg-chart-3",
  delayed: "bg-destructive",
  completed: "bg-chart-4",
};

/* Chart 17 — Project timeline / Gantt (tasks across dates, delays in red) */
export function GanttChart({ tasks }: { tasks: Task[] }) {
  const { rows, months } = buildGantt(tasks);

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No scheduled tasks.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        {/* month header */}
        <div className="flex border-b border-border pb-2 text-[11px] text-muted-foreground">
          <div className="w-48 shrink-0" />
          <div className="relative h-4 flex-1">
            {months.map((m) => (
              <span
                key={m.label}
                className="absolute -translate-x-1/2 whitespace-nowrap"
                style={{ left: `${m.leftPct}%` }}
              >
                {m.label}
              </span>
            ))}
          </div>
        </div>

        {/* rows */}
        <div className="divide-y divide-border/60">
          {rows.map(({ task, leftPct, widthPct, progressPct }) => {
            const meta = taskStatusMeta[task.status];
            return (
              <div key={task.id} className="flex items-center py-2">
                <div className="w-48 shrink-0 pr-3">
                  <p className="truncate text-sm font-medium" title={task.name}>
                    {task.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{meta.label}</p>
                </div>
                <div className="relative h-7 flex-1">
                  {/* month gridlines */}
                  {months.map((m) => (
                    <span
                      key={m.label}
                      className="absolute top-0 h-full w-px bg-border/60"
                      style={{ left: `${m.leftPct}%` }}
                    />
                  ))}
                  {/* bar */}
                  <div
                    className="absolute top-1/2 flex h-5 -translate-y-1/2 items-center overflow-hidden rounded-md"
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    title={`${task.name} — ${Math.round(progressPct)}%`}
                  >
                    <div className={cn("h-full w-full opacity-30", STATUS_BAR[task.status])} />
                    <div
                      className={cn("absolute left-0 top-0 h-full rounded-md", STATUS_BAR[task.status])}
                      style={{ width: `${Math.max(4, progressPct)}%` }}
                    />
                  </div>
                  {task.delayDays > 0 && (
                    <span
                      className="absolute top-1/2 ml-1 -translate-y-1/2 whitespace-nowrap text-[10px] font-medium text-destructive"
                      style={{ left: `${leftPct + widthPct}%` }}
                    >
                      +{task.delayDays}d
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
