import Link from "next/link";
import { Plus, IndianRupee, CheckCircle2, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getInvoicesView } from "@/lib/data/commercial";
import { lineTotalWithTax } from "@/lib/data/compute";
import { invoiceStatusMeta } from "@/lib/labels";
import { formatINR } from "@/lib/utils";

export default async function InvoicesPage() {
  const rows = (await getInvoicesView()).map((v) => ({
    ...v,
    total: lineTotalWithTax(v.invoice.items, v.invoice.taxRate),
  }));
  const totalRaised = rows.reduce((s, r) => s + r.total, 0);
  const totalReceived = rows.reduce((s, r) => s + r.invoice.received, 0);
  const outstanding = totalRaised - totalReceived;

  return (
    <>
      <PageHeader
        title="Sales Invoices"
        description="Client billing — raised vs received"
        action={
          <Button>
            <Plus /> New Invoice
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Raised" value={formatINR(totalRaised, { compact: true })} icon={IndianRupee} accent="primary" />
        <StatCard label="Received" value={formatINR(totalReceived, { compact: true })} icon={CheckCircle2} accent="success" />
        <StatCard label="Outstanding" value={formatINR(outstanding, { compact: true })} icon={AlertCircle} accent="destructive" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ invoice: inv, total, project, client }) => {
                const meta = invoiceStatusMeta[inv.status];
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.number}</TableCell>
                    <TableCell>
                      {project && (
                        <Link href={`/projects/${project.id}`} className="hover:underline">
                          {project.code}
                        </Link>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{client?.company}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(inv.date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(total)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(inv.received)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
