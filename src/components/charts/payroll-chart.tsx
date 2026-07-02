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
import { departmentLabel } from "@/lib/labels";
import type { Department } from "@/lib/types";
import { tooltipStyle } from "./task-status-donut";

const axisTick = { fontSize: 11, fill: "var(--muted-foreground)" };
const inrTick = (v: number) => formatINR(v, { compact: true });

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

/* Chart 19 — Payroll cost breakdown by department */
export function PayrollBreakdownChart({
  data,
}: {
  data: { department: string; amount: number }[];
}) {
  const rows = data
    .map((d) => ({ ...d, label: departmentLabel[d.department as Department] ?? d.department }))
    .sort((a, b) => b.amount - a.amount);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={inrTick} tick={axisTick} tickLine={false} axisLine={false} width={56} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "var(--secondary)", opacity: 0.4 }}
          formatter={(v) => [formatINR(Number(v)), "Net pay"]}
        />
        <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={56}>
          {rows.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
