"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { taskStatusMeta } from "@/lib/labels";
import { tooltipStyle } from "./task-status-donut";

const axisTick = { fontSize: 11, fill: "var(--muted-foreground)" };

type Row = {
  name: string;
  not_started: number;
  ongoing: number;
  delayed: number;
  completed: number;
};

const SERIES: { key: keyof Omit<Row, "name">; color: string }[] = [
  { key: "completed", color: "var(--chart-4)" },
  { key: "ongoing", color: "var(--chart-3)" },
  { key: "delayed", color: "var(--destructive)" },
  { key: "not_started", color: "var(--muted-foreground)" },
];

/* Chart 15 — Portfolio health: task status mix across all projects */
export function PortfolioHealthChart({ data }: { data: Row[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={false} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "var(--secondary)", opacity: 0.4 }}
          formatter={(v, n) => [`${v} tasks`, taskStatusMeta[n as keyof typeof taskStatusMeta]?.label ?? n]}
        />
        <Legend
          iconType="circle"
          wrapperStyle={{ fontSize: 12 }}
          formatter={(v) => taskStatusMeta[v as keyof typeof taskStatusMeta]?.label ?? v}
        />
        {SERIES.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            stackId="a"
            fill={s.color}
            maxBarSize={48}
            radius={i === SERIES.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
