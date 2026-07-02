"use client";

import Link from "next/link";
import { Plus, FileText, PackageCheck, BookText } from "lucide-react";
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
import { poTotals } from "@/lib/data/compute";
import type { MaterialBoard } from "@/lib/data/material";
import { poStatusMeta } from "@/lib/labels";
import { formatINR } from "@/lib/utils";

export function PurchaseOrdersTab({ board }: { board: MaterialBoard }) {
  const { purchaseOrders, suppliers, projects, receiptPoIds, bookedPoIds } = board;
  const supplierById = new Map(suppliers.map((s) => [s.id, s]));
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const receivedSet = new Set(receiptPoIds);
  const bookedSet = new Set(bookedPoIds);

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm font-medium">{purchaseOrders.length} purchase orders</p>
        <Button size="sm">
          <Plus /> New PO
        </Button>
      </div>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Doc</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchaseOrders.map((po) => {
              const supplier = supplierById.get(po.supplierId) ?? null;
              const project = projectById.get(po.projectId) ?? null;
              const meta = poStatusMeta[po.status];
              const totals = poTotals(po);
              const received = receivedSet.has(po.id);
              const booked = bookedSet.has(po.id);
              return (
                <TableRow key={po.id}>
                  <TableCell className="font-medium">{po.number}</TableCell>
                  <TableCell className="text-muted-foreground">{supplier?.company}</TableCell>
                  <TableCell>{project?.code}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                      {received && (
                        <Badge variant="success">
                          <PackageCheck className="h-3 w-3" /> GRN
                        </Badge>
                      )}
                      {booked && (
                        <Badge variant="info">
                          <BookText className="h-3 w-3" /> Booked
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatINR(totals.grandTotal)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/material/po/${po.id}/print`}
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
