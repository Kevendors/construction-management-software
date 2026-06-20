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
import { tooltipStyle } from "./task-status-donut";

const axisTick = { fontSize: 11, fill: "var(--muted-foreground)" };

interface StockRow {
  short: string;
  stock: number;
  reorder: number;
  low: boolean;
  unit: string;
}

/* Chart 18 — material stock levels vs reorder (low-stock bars red) */
export function StockLevelChart({ data }: { data: StockRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
        barGap={-14}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
        <XAxis type="number" tick={axisTick} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="short"
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          width={110}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "var(--secondary)", opacity: 0.4 }}
          formatter={(v, n) => [`${Number(v)}`, n === "stock" ? "In stock" : "Reorder level"]}
        />
        {/* reorder level as a faint backdrop bar */}
        <Bar dataKey="reorder" fill="var(--muted)" radius={[0, 4, 4, 0]} barSize={14} name="reorder" />
        <Bar dataKey="stock" radius={[0, 4, 4, 0]} barSize={14} name="stock">
          {data.map((d, i) => (
            <Cell key={i} fill={d.low ? "var(--destructive)" : "var(--chart-4)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
