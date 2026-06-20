"use client";

import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { woTotals } from "@/lib/data/compute";
import type { SubconBoard } from "@/lib/data/subcon";
import { tradeLabel, woStatusMeta } from "@/lib/labels";
import { formatINR } from "@/lib/utils";

export function WorkOrdersTab({ board }: { board: SubconBoard }) {
  const { workOrders, subcontractors, projects } = board;
  const subById = new Map(subcontractors.map((s) => [s.id, s]));
  const projectById = new Map(projects.map((p) => [p.id, p]));

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm font-medium">{workOrders.length} work orders</p>
        <Button size="sm">
          <Plus /> New Work Order
        </Button>
      </div>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>WO</TableHead>
              <TableHead>Subcontractor</TableHead>
              <TableHead>Trade</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead className="text-right">Doc</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workOrders.map((wo) => {
              const sc = subById.get(wo.subcontractorId) ?? null;
              const project = projectById.get(wo.projectId) ?? null;
              const meta = woStatusMeta[wo.status];
              const totals = woTotals(wo);
              return (
                <TableRow key={wo.id}>
                  <TableCell className="font-medium">{wo.number}</TableCell>
                  <TableCell className="text-muted-foreground">{sc?.company}</TableCell>
                  <TableCell>{sc && <Badge variant="secondary">{tradeLabel[sc.trade]}</Badge>}</TableCell>
                  <TableCell>{project?.code}</TableCell>
                  <TableCell>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatINR(totals.grandTotal, { compact: true })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/subcon/wo/${wo.id}/print`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      <FileText className="h-4 w-4" /> PDF
                    </Link>
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
