"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatINR } from "@/lib/utils";
import { tooltipStyle } from "./task-status-donut";

const axisTick = { fontSize: 11, fill: "var(--muted-foreground)" };
const inrTick = (v: number) => formatINR(v, { compact: true });

type Row = { month: string; inflow: number; outflow: number; balance: number };

/* Chart 14 — Cash-flow in/out over time (with running balance line) */
export function CashFlowChart({ data }: { data: Row[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="cfIn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="cfOut" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="month" tick={axisTick} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={inrTick} tick={axisTick} tickLine={false} axisLine={false} width={56} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v, n) => [
            formatINR(Number(v)),
            n === "inflow" ? "Cash in" : n === "outflow" ? "Cash out" : "Balance",
          ]}
        />
        <Legend
          iconType="circle"
          wrapperStyle={{ fontSize: 12 }}
          formatter={(v) => (v === "inflow" ? "Cash in" : v === "outflow" ? "Cash out" : "Running balance")}
        />
        <Area type="monotone" dataKey="inflow" stroke="var(--chart-4)" strokeWidth={2} fill="url(#cfIn)" />
        <Area type="monotone" dataKey="outflow" stroke="var(--chart-1)" strokeWidth={2} fill="url(#cfOut)" />
        <Line type="monotone" dataKey="balance" stroke="var(--chart-3)" strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
