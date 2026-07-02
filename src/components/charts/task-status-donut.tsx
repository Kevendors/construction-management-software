"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { taskStatusMeta } from "@/lib/labels";
import type { TaskStatus } from "@/lib/types";

const COLORS: Record<TaskStatus, string> = {
  not_started: "var(--muted-foreground)",
  ongoing: "var(--chart-3)",
  delayed: "var(--destructive)",
  completed: "var(--chart-4)",
};

export function TaskStatusDonut({
  counts,
}: {
  counts: Record<TaskStatus, number>;
}) {
  const data = (Object.keys(counts) as TaskStatus[])
    .map((status) => ({
      status,
      label: taskStatusMeta[status].label,
      value: counts[status],
      color: COLORS[status],
    }))
    .filter((d) => d.value > 0);

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-40 w-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="62%"
              outerRadius="100%"
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((d) => (
                <Cell key={d.status} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v, n) => {
                const c = Number(v);
                return [`${c} task${c === 1 ? "" : "s"}`, n];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{total}</span>
          <span className="text-[11px] text-muted-foreground">tasks</span>
        </div>
      </div>
      <ul className="grid flex-1 grid-cols-2 gap-2 text-sm sm:grid-cols-1">
        {data.map((d) => (
          <li key={d.status} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
            <span className="text-muted-foreground">{d.label}</span>
            <span className="ml-auto font-semibold">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
};
