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
import { categoryLabel } from "@/lib/labels";
import { tooltipStyle } from "./task-status-donut";

const axisTick = { fontSize: 11, fill: "var(--muted-foreground)" };
const inrTick = (v: number) => formatINR(v, { compact: true });

/* Chart 3 — Financial Health */
export function FinancialHealthChart({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  const colors = ["var(--chart-1)", "var(--destructive)", "var(--chart-4)", "var(--chart-2)"];
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={inrTick} tick={axisTick} tickLine={false} axisLine={false} width={56} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "var(--secondary)", opacity: 0.4 }}
          formatter={(v) => [formatINR(Number(v)), "Amount"]}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={64}>
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* Chart 4 — Expense by category */
export function ExpenseCategoryChart({
  data,
}: {
  data: { category: string; amount: number }[];
}) {
  const rows = data.map((d) => ({ ...d, label: categoryLabel[d.category] ?? d.category }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={inrTick} tick={axisTick} tickLine={false} axisLine={false} width={56} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "var(--secondary)", opacity: 0.4 }}
          formatter={(v) => [formatINR(Number(v)), "Expense"]}
        />
        <Bar dataKey="amount" fill="var(--chart-1)" radius={[6, 6, 0, 0]} maxBarSize={56} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* Chart 6 — Attendance (last 7 days) */
export function AttendanceChart({
  data,
}: {
  data: { date: string; present: number; absent: number }[];
}) {
  const rows = data.map((d) => ({
    ...d,
    day: new Date(d.date).toLocaleDateString("en-IN", { weekday: "short" }),
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="day" tick={axisTick} tickLine={false} axisLine={false} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={28} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--secondary)", opacity: 0.4 }} />
        <Bar dataKey="present" stackId="a" fill="var(--chart-4)" radius={[0, 0, 0, 0]} maxBarSize={40} name="Present" />
        <Bar dataKey="absent" stackId="a" fill="var(--destructive)" radius={[6, 6, 0, 0]} maxBarSize={40} name="Absent" />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* Chart 13 — Budget vs Actual (company) */
export function BudgetVsActualChart({
  data,
}: {
  data: { name: string; budget: number; actual: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={inrTick} tick={axisTick} tickLine={false} axisLine={false} width={56} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "var(--secondary)", opacity: 0.4 }}
          formatter={(v, n) => [formatINR(Number(v)), n === "budget" ? "BOQ budget" : "Actual spend"]}
        />
        <Bar dataKey="budget" fill="var(--chart-1)" radius={[6, 6, 0, 0]} maxBarSize={36} name="budget" />
        <Bar dataKey="actual" fill="var(--chart-2)" radius={[6, 6, 0, 0]} maxBarSize={36} name="actual" />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* Chart 16 — Per-project margin (horizontal) */
export function ProjectMarginChart({
  data,
}: {
  data: { name: string; margin: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart layout="vertical" data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
        <XAxis type="number" tickFormatter={inrTick} tick={axisTick} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" tick={axisTick} tickLine={false} axisLine={false} width={56} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "var(--secondary)", opacity: 0.4 }}
          formatter={(v) => [formatINR(Number(v)), "Margin"]}
        />
        <Bar dataKey="margin" radius={[0, 6, 6, 0]} maxBarSize={28}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.margin >= 0 ? "var(--chart-4)" : "var(--destructive)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
