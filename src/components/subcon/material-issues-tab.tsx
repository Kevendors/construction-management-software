"use client";

import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SubconBoard } from "@/lib/data/subcon";
import { formatINR, formatNumber } from "@/lib/utils";

export function MaterialIssuesTab({ board }: { board: SubconBoard }) {
  const { materialIssues, subcontractors, materialItems, projects } = board;
  const subById = new Map(subcontractors.map((s) => [s.id, s]));
  const itemById = new Map(materialItems.map((i) => [i.id, i]));
  const projectById = new Map(projects.map((p) => [p.id, p]));

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm font-medium">{materialIssues.length} material issues to subcontractors</p>
        <Button size="sm">
          <Plus /> Issue Material
        </Button>
      </div>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Subcontractor</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Project</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {materialIssues.map((mi) => {
              const sc = subById.get(mi.subcontractorId) ?? null;
              const item = itemById.get(mi.materialItemId) ?? null;
              const project = projectById.get(mi.projectId) ?? null;
              return (
                <TableRow key={mi.id}>
                  <TableCell className="text-muted-foreground">
                    {new Date(mi.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                  </TableCell>
                  <TableCell className="font-medium">{sc?.company}</TableCell>
                  <TableCell>{item?.name}</TableCell>
                  <TableCell>{project?.code}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(mi.qty, 1)} {item?.unit}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatINR(mi.qty * (item?.rate ?? 0))}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
