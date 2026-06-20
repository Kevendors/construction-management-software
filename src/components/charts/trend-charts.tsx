"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatINR } from "@/lib/utils";
import { tooltipStyle } from "./task-status-donut";

const axisTick = { fontSize: 11, fill: "var(--muted-foreground)" };
const inrTick = (v: number) => formatINR(v, { compact: true });

type Row = { month: string; invoice: number; expense: number; margin: number };

/* Charts 9 & 10 — invoice / expense monthly trend */
export function TrendChart({
  data,
  dataKey,
  color,
  label,
}: {
  data: Row[];
  dataKey: "invoice" | "expense";
  color: string;
  label: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="month" tick={axisTick} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={inrTick} tick={axisTick} tickLine={false} axisLine={false} width={56} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "var(--secondary)", opacity: 0.4 }}
          formatter={(v) => [formatINR(Number(v)), label]}
        />
        <Bar dataKey={dataKey} fill={color} radius={[6, 6, 0, 0]} maxBarSize={44} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* Chart 11 — margin trend (negatives red) */
export function MarginTrendChart({ data }: { data: Row[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="month" tick={axisTick} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={inrTick} tick={axisTick} tickLine={false} axisLine={false} width={56} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "var(--secondary)", opacity: 0.4 }}
          formatter={(v) => [formatINR(Number(v)), "Margin"]}
        />
        <Bar dataKey="margin" radius={[6, 6, 0, 0]} maxBarSize={44}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.margin >= 0 ? "var(--chart-4)" : "var(--destructive)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
