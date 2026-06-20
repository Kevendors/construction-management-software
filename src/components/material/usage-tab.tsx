"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { materialConsumption } from "@/lib/data/compute";
import type { MaterialBoard } from "@/lib/data/material";
import { formatINR, formatNumber } from "@/lib/utils";

export function UsageTab({ board }: { board: MaterialBoard }) {
  const { usage: materialUsage, items, projects } = board;
  const itemById = new Map(items.map((i) => [i.id, i]));
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const consumption = materialConsumption(materialUsage, items);
  const totalValue = consumption.reduce((s, c) => s + c.value, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Consumption by Material</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead className="text-right">Qty Used</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consumption.map((c) => (
                <TableRow key={c.name}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(c.qty, 1)} {c.unit}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(c.value)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 border-border font-semibold hover:bg-transparent">
                <TableCell colSpan={2}>Total consumed value</TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(totalValue)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usage Log</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materialUsage.map((u) => {
                const item = itemById.get(u.materialItemId) ?? null;
                const project = projectById.get(u.projectId) ?? null;
                return (
                  <TableRow key={u.id}>
                    <TableCell className="text-muted-foreground">
                      {new Date(u.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </TableCell>
                    <TableCell className="font-medium">{item?.name}</TableCell>
                    <TableCell>{project?.code}</TableCell>
                    <TableCell className="text-muted-foreground">{u.ref}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(u.qty, 1)} {item?.unit}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
