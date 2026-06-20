"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getProjectBoq,
  getProjectInvoices,
  lineSubtotal,
  lineTotalWithTax,
  projectPnL,
} from "@/lib/mock/selectors";
import { costCodeLabel, invoiceStatusMeta } from "@/lib/labels";
import { formatINR } from "@/lib/utils";

export function CommercialTab({ projectId }: { projectId: string }) {
  const pnl = projectPnL(projectId);
  const boq = getProjectBoq(projectId);
  const invoices = getProjectInvoices(projectId);

  const pnlRows = [
    { label: "Project Value", value: pnl.projectValue, accent: "text-foreground" },
    { label: "BOQ Value (baseline)", value: pnl.boqValue, accent: "text-foreground" },
    { label: "Total Expense", value: -pnl.totalExpense, accent: "text-destructive" },
    { label: "Sales Invoiced", value: pnl.salesInvoiced, accent: "text-foreground" },
    { label: "Received", value: pnl.salesReceived, accent: "text-success" },
  ];

  return (
    <div className="space-y-4">
      {/* P&L summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project P&amp;L</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
            {pnlRows.map((r) => (
              <div key={r.label}>
                <p className="text-xs text-muted-foreground">{r.label}</p>
                <p className={`text-lg font-semibold tabular-nums ${r.accent}`}>
                  {formatINR(r.value, { compact: true })}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between rounded-lg bg-secondary px-4 py-3">
            <span className="text-sm font-medium">Estimated Margin</span>
            <span
              className={`text-xl font-bold tabular-nums ${
                pnl.margin >= 0 ? "text-success" : "text-destructive"
              }`}
            >
              {formatINR(pnl.margin)} · {pnl.marginPct.toFixed(1)}%
            </span>
          </div>
        </CardContent>
      </Card>

      {/* BOQ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bill of Quantities</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {boq ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Cost Code</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {boq.items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium">{it.description}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{costCodeLabel[it.costCode]}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {it.qty} {it.unit}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(it.rate)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatINR(it.qty * it.rate)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 border-border font-semibold hover:bg-transparent">
                  <TableCell colSpan={4}>BOQ Total</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatINR(lineSubtotal(boq.items))}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No BOQ baseline set.</p>
          )}
        </CardContent>
      </Card>

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sales Invoices</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {invoices.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => {
                  const total = lineTotalWithTax(inv.items, inv.taxRate);
                  const meta = invoiceStatusMeta[inv.status];
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.number}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(inv.date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(total)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatINR(inv.received)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No invoices raised.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
