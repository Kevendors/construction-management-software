"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, IndianRupee, CheckCircle2, AlertCircle, Pencil } from "lucide-react";
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
import { salesInvoices as mockInvoices, clients as mockClients, projects as mockProjects } from "@/lib/mock/data";
import { invoiceStatusMeta } from "@/lib/labels";
import { formatINR } from "@/lib/utils";
import type { InvoiceState } from "@/lib/invoice/compute";

interface InvoiceRow {
  id: string;
  number: string;
  date: string;
  dueDate: string;
  projectName: string;
  clientName: string;
  total: number;
  received: number;
  status: "draft" | "sent" | "partial" | "paid" | "overdue";
  source: "mock" | "local";
}

function loadLocalInvoices(): InvoiceRow[] {
  try {
    const indexRaw = localStorage.getItem("sitehub:invoices:index");
    if (!indexRaw) return [];
    const keys: string[] = JSON.parse(indexRaw);
    return keys
      .map((key) => {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) return null;
          const s: InvoiceState = JSON.parse(raw);
          const subtotal = s.lines.reduce((sum, l) => sum + l.qty * l.rate, 0);
          const gst = (subtotal * (s.gstRate || 0)) / 100;
          const total = Math.round((subtotal - (s.discount || 0) + gst) * 100) / 100;
          return {
            id: key,
            number: s.number || "—",
            date: s.date,
            dueDate: s.dueDate,
            projectName: s.projectName || "—",
            clientName: s.clientName || s.company || "—",
            total,
            received: 0,
            status: "draft" as const,
            source: "local" as const,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean) as InvoiceRow[];
  } catch {
    return [];
  }
}

function mockToRows(): InvoiceRow[] {
  return mockInvoices.map((inv) => {
    const sub = inv.items.reduce((s, it) => s + it.qty * it.rate, 0);
    const total = sub + (sub * inv.taxRate) / 100;
    const project = mockProjects.find((p) => p.id === inv.projectId);
    const client = mockClients.find((c) => c.id === inv.clientId);
    return {
      id: inv.id,
      number: inv.number,
      date: inv.date,
      dueDate: inv.dueDate,
      projectName: project?.name || "—",
      clientName: client?.company || "—",
      total,
      received: inv.received,
      status: inv.status,
      source: "mock" as const,
    };
  });
}

export default function InvoicesPage() {
  const [rows, setRows] = React.useState<InvoiceRow[]>([]);

  React.useEffect(() => {
    const mock = mockToRows();
    const local = loadLocalInvoices();
    setRows([...local, ...mock]);
  }, []);

  const totalRaised = rows.reduce((s, r) => s + r.total, 0);
  const totalReceived = rows.reduce((s, r) => s + r.received, 0);
  const outstanding = totalRaised - totalReceived;

  return (
    <>
      <PageHeader
        title="Sales Invoices"
        description="Client billing — raised vs received"
        action={
          <Link href="/invoices/new">
            <Button>
              <Plus /> New Invoice
            </Button>
          </Link>
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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const meta = invoiceStatusMeta[row.status];
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.number}</TableCell>
                    <TableCell className="text-muted-foreground">{row.projectName}</TableCell>
                    <TableCell className="text-muted-foreground">{row.clientName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(row.date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(row.total)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(row.received)}</TableCell>
                    <TableCell className="text-right">
                      {row.source === "local" && (
                        <Link href={`/invoices/new?id=${row.number}`}>
                          <Button size="sm" variant="ghost">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                    No invoices yet. Click &quot;New Invoice&quot; to create one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
