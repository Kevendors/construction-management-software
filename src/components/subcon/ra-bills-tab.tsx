"use client";

import { Plus } from "lucide-react";
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
import type { SubconBoard } from "@/lib/data/subcon";
import { raStatusMeta } from "@/lib/labels";
import { formatINR } from "@/lib/utils";

export function RaBillsTab({ board }: { board: SubconBoard }) {
  const { raBills, workOrders, subcontractors } = board;
  const woById = new Map(workOrders.map((w) => [w.id, w]));
  const subById = new Map(subcontractors.map((s) => [s.id, s]));

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm font-medium">{raBills.length} running-account bills</p>
        <Button size="sm">
          <Plus /> New RA Bill
        </Button>
      </div>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>RA Bill</TableHead>
              <TableHead>Work Order</TableHead>
              <TableHead>Subcontractor</TableHead>
              <TableHead className="text-right">% Complete</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead className="text-right">Deductions</TableHead>
              <TableHead className="text-right">Net Payable</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {raBills.map((ra) => {
              const wo = woById.get(ra.workOrderId) ?? null;
              const sc = wo ? subById.get(wo.subcontractorId) ?? null : null;
              const meta = raStatusMeta[ra.status];
              return (
                <TableRow key={ra.id}>
                  <TableCell className="font-medium">{ra.number}</TableCell>
                  <TableCell className="text-muted-foreground">{wo?.number}</TableCell>
                  <TableCell className="text-muted-foreground">{sc?.company}</TableCell>
                  <TableCell className="text-right tabular-nums">{ra.percentComplete}%</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(ra.grossAmount)}</TableCell>
                  <TableCell className="text-right tabular-nums text-destructive">
                    − {formatINR(ra.deductions)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatINR(ra.netAmount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
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
