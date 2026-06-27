"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRightLeft, Download, Search, X } from "lucide-react";
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
import { lineSubtotal, lineTotalWithTax } from "@/lib/data/compute";
import { quotationStatusMeta } from "@/lib/labels";
import { formatINR } from "@/lib/utils";
import type { Client, Quotation } from "@/lib/types";

export interface QuotationListItem {
  quotation: Quotation;
  client: Client | null;
}

const fmtDate = (d: string) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "";

/** Lower-cased haystack of every field a user might search a quotation by. */
function haystack({ quotation: q, client }: QuotationListItem): string {
  return [
    q.number,
    q.projectName,
    client?.company,
    client?.name,
    quotationStatusMeta[q.status]?.label,
    q.status,
    q.date,
    fmtDate(q.date),
    q.validUntil,
    fmtDate(q.validUntil),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function QuotationsList({ items }: { items: QuotationListItem[] }) {
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<string>("all");

  const filtered = React.useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return items.filter((it) => {
      if (status !== "all" && it.quotation.status !== status) return false;
      if (!terms.length) return true;
      const hay = haystack(it);
      return terms.every((t) => hay.includes(t));
    });
  }, [items, query, status]);

  return (
    <div className="space-y-4">
      {/* search + filter toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by quotation no, client, project, or date…"
            className="pl-9 pr-9"
            aria-label="Search quotations"
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
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
          className="sm:w-44"
        >
          <option value="all">All statuses</option>
          {Object.entries(quotationStatusMeta).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} of {items.length} quotation{items.length === 1 ? "" : "s"}
      </p>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No quotations match your search.
          </CardContent>
        </Card>
      ) : (
        filtered.map(({ quotation: q, client }) => {
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
                    · valid till {fmtDate(q.validUntil)}
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
        })
      )}
    </div>
  );
}
