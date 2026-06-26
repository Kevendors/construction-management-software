import Link from "next/link";
import { Plus, ArrowRightLeft, Download } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getQuotationsView } from "@/lib/data/commercial";
import { lineSubtotal, lineTotalWithTax } from "@/lib/data/compute";
import { quotationStatusMeta } from "@/lib/labels";
import { formatINR } from "@/lib/utils";

export default async function QuotationsPage() {
  const views = await getQuotationsView();
  return (
    <>
      <PageHeader
        title="Quotations"
        description="Proposals & estimates — convert accepted quotes to projects"
        action={
          <Link href="/quotations/new">
            <Button>
              <Plus /> New Quotation
            </Button>
          </Link>
        }
      />

      <div className="space-y-4">
        {views.map(({ quotation: q, client }) => {
          const meta = quotationStatusMeta[q.status];
          const sub = lineSubtotal(q.items);
          const tax = (sub * q.taxRate) / 100;
          const total = lineTotalWithTax(q.items, q.taxRate);
          return (
            <Card key={q.id}>
              <CardHeader className="flex-col gap-3 border-b border-border sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{q.number}</span>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {q.projectName} ·{" "}
                    <Link href={`/clients/${q.clientId}`} className="hover:underline">
                      {client?.company}
                    </Link>{" "}
                    · valid till{" "}
                    {new Date(q.validUntil).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/quotations/new?id=${q.id}`}>
                    <Button size="sm" variant="outline">
                      <Download /> Open / PDF
                    </Button>
                  </Link>
                  {q.status === "accepted" && (
                    <Button size="sm">
                      <ArrowRightLeft /> Convert to Project
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {q.items.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell className="font-medium">{it.description}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {it.qty} {it.unit}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatINR(it.rate)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatINR(it.qty * it.rate)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-3 ml-auto w-full max-w-xs space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums">{formatINR(sub)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">GST ({q.taxRate}%)</span>
                    <span className="tabular-nums">{formatINR(tax)}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-1.5 font-semibold">
                    <span>Total</span>
                    <span className="tabular-nums">{formatINR(total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
