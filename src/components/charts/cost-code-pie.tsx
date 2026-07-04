"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { costCodeLabel } from "@/lib/labels";
import { formatINR } from "@/lib/utils";
import { tooltipStyle } from "./task-status-donut";

// Cost codes are dynamic (org-defined); map known ones to a colour and cycle
// through the palette for any custom ones.
const COLORS: Record<string, string> = {
  material: "var(--chart-1)",
  machinery: "var(--chart-3)",
  diesel: "var(--chart-2)",
  labour: "var(--chart-4)",
  other: "var(--chart-5)",
};
const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function CostCodePie({
  data,
}: {
  data: { costCode: string; amount: number }[];
}) {
  const rows = data.map((d, i) => ({
    ...d,
    label: costCodeLabel[d.costCode] ?? d.costCode,
    color: COLORS[d.costCode] ?? PALETTE[i % PALETTE.length],
  }));
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="amount"
              nameKey="label"
              outerRadius="100%"
              strokeWidth={0}
            >
              {rows.map((d) => (
                <Cell key={d.costCode} fill={d.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [formatINR(Number(v)), n]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="grid flex-1 grid-cols-1 gap-2 text-sm">
        {rows.map((d) => (
          <li key={d.costCode} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
            <span className="text-muted-foreground">{d.label}</span>
            <span className="ml-auto font-semibold">{formatINR(d.amount, { compact: true })}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
