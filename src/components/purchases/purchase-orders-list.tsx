"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { poTotals } from "@/lib/data/compute";
import { poStatusMeta } from "@/lib/labels";
import { formatINR } from "@/lib/utils";
import { poToBillState } from "@/lib/purchases/compute";
import type { POStatus, Project, PurchaseOrder, Supplier } from "@/lib/types";

const PO_STATUSES: POStatus[] = ["draft", "sent", "received", "closed"];

const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";

function haystack(po: PurchaseOrder, supplier: Supplier | null, project: Project | null): string {
  return [po.number, supplier?.company, supplier?.name, project?.code, project?.name, poStatusMeta[po.status]?.label, po.status, po.date, fmtDate(po.date)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * Read-only reuse of the Material module's own Purchase Order data — no "New
 * PO" button here, PO creation stays in Material. This view exists so the
 * Commercial section has one place to see purchasing documents and convert
 * a PO into a Bill, mirroring the Quotation card's "Convert to Invoice".
 */
export function PurchaseOrdersList({
  purchaseOrders,
  suppliers,
  projects,
}: {
  purchaseOrders: PurchaseOrder[];
  suppliers: Supplier[];
  projects: Project[];
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<string>("all");

  const supplierById = React.useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);
  const projectById = React.useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  function convertToBill(po: PurchaseOrder) {
    const supplier = supplierById.get(po.supplierId) ?? null;
    const project = projectById.get(po.projectId) ?? null;
    try {
      localStorage.setItem(
        "sitehub:newBillPrefill",
        JSON.stringify({ state: poToBillState(po, supplier, project), sourcePoId: po.id })
      );
    } catch {
      /* ignore (quota/private-browsing) */
    }
    router.push("/purchases/bill/new");
  }

  const filtered = React.useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return purchaseOrders.filter((po) => {
      if (status !== "all" && po.status !== status) return false;
      if (!terms.length) return true;
      const hay = haystack(po, supplierById.get(po.supplierId) ?? null, projectById.get(po.projectId) ?? null);
      return terms.every((t) => hay.includes(t));
    });
  }, [purchaseOrders, query, status, supplierById, projectById]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by PO no, supplier, project, or date…"
            className="pl-9 pr-9"
            aria-label="Search purchase orders"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status" className="sm:w-44">
          <option value="all">All statuses</option>
          {PO_STATUSES.map((sv) => (
            <option key={sv} value={sv}>
              {poStatusMeta[sv].label}
            </option>
          ))}
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} of {purchaseOrders.length} purchase order{purchaseOrders.length === 1 ? "" : "s"}
      </p>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No purchase orders match your search.
          </CardContent>
        </Card>
      ) : (
        filtered.map((po) => {
          const supplier = supplierById.get(po.supplierId) ?? null;
          const project = projectById.get(po.projectId) ?? null;
          const meta = poStatusMeta[po.status];
          const totals = poTotals(po);
          return (
            <Card key={po.id}>
              <CardHeader className="flex-col gap-3 border-b border-border sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{po.number}</span>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {project && <>{project.code} · </>}
                    {supplier?.company || supplier?.name || "—"} · {fmtDate(po.date)}
                  </p>
                </div>
                {po.status !== "draft" && (
                  <Button size="sm" onClick={() => convertToBill(po)}>
                    <ArrowRightLeft /> Convert to Bill
                  </Button>
                )}
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
                    {po.items.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell className="font-medium">{it.description}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {it.qty} {it.unit}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatINR(it.rate)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatINR(it.qty * it.rate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-3 ml-auto w-full max-w-xs space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums">{formatINR(totals.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="tabular-nums">{formatINR(totals.discount)}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-1.5 font-semibold">
                    <span>Grand Total</span>
                    <span className="tabular-nums">{formatINR(totals.grandTotal)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
