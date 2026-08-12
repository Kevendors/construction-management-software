"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { Dialog, Select } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { lineSubtotal, lineTotalWithTax } from "@/lib/data/compute";
import { invoiceStatusMeta } from "@/lib/labels";
import { formatINR } from "@/lib/utils";
import type { Client, Project, SalesInvoice } from "@/lib/types";
import {
  deleteInvoiceAction,
  updateInvoiceStatusAction,
  type InvoiceStatus,
} from "@/app/invoices/actions";

const INVOICE_STATUSES: InvoiceStatus[] = ["draft", "sent", "partial", "paid", "overdue"];

/** Money has been received against these, so the row is a financial record. */
const UNDELETABLE: InvoiceStatus[] = ["paid", "partial"];

export interface InvoiceListItem {
  invoice: SalesInvoice;
  client: Client | null;
  project: Project | null;
}

const fmtDate = (d: string) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "";

/** Lower-cased haystack of every field a user might search an invoice by. */
function haystack({ invoice: inv, client, project }: InvoiceListItem): string {
  return [
    inv.number,
    project?.code,
    project?.name,
    client?.company,
    client?.name,
    invoiceStatusMeta[inv.status]?.label,
    inv.status,
    inv.date,
    fmtDate(inv.date),
    inv.dueDate,
    fmtDate(inv.dueDate),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

interface PendingDelete {
  id: string;
  number: string;
  status: InvoiceStatus;
  client: string;
  total: number;
}

/**
 * Drafts delete on a plain confirm; anything already sent or overdue needs the
 * number typed. Paid/partly-paid invoices never reach here — the button is
 * hidden and the server action refuses them regardless.
 */
function DeleteInvoiceDialog({
  target,
  onClose,
  onDeleted,
}: {
  target: PendingDelete | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [typed, setTyped] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const mustType = !!target && target.status !== "draft";
  const confirmed = !!target && (!mustType || typed.trim() === target.number);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target || !confirmed) return;
    setBusy(true);
    setError(null);
    const res = await deleteInvoiceAction(target.id);
    setBusy(false);
    if (res.error) return setError(res.error);
    onDeleted();
  }

  return (
    <Dialog
      open={!!target}
      onClose={onClose}
      title="Delete Invoice"
      description="This permanently removes the invoice and all of its line items. It can't be undone."
    >
      <form onSubmit={submit} className="space-y-4">
        {target && (
          <dl className="space-y-1.5 rounded-md border border-border bg-secondary/40 px-3 py-2.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Number</dt>
              <dd className="font-medium">{target.number}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Client</dt>
              <dd className="truncate font-medium">{target.client || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Total</dt>
              <dd className="font-medium">{formatINR(target.total)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <Badge variant={invoiceStatusMeta[target.status].variant}>
                  {invoiceStatusMeta[target.status].label}
                </Badge>
              </dd>
            </div>
          </dl>
        )}

        {mustType && target && (
          <div className="space-y-1.5">
            <Label htmlFor="inv-del-confirm">
              This invoice was already {invoiceStatusMeta[target.status].label.toLowerCase()}. Type{" "}
              <span className="font-mono font-semibold">{target.number}</span> to confirm.
            </Label>
            <Input
              id="inv-del-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={target.number}
              autoComplete="off"
              autoFocus
            />
          </div>
        )}

        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="destructive" disabled={busy || !confirmed}>
            {busy ? "Deleting…" : "Delete Invoice"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function InvoicesList({
  items,
  canDelete = false,
}: {
  items: InvoiceListItem[];
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<string>("all");
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);
  const [statusError, setStatusError] = React.useState<{ id: string; message: string } | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<PendingDelete | null>(null);

  /**
   * Marking an invoice paid while money is still outstanding is almost always
   * meant as "it's been settled", so offer to record the balance too. Declining
   * still changes the label — that's the deliberate override.
   */
  async function changeStatus(id: string, next: InvoiceStatus, outstanding: number) {
    let settle = false;
    if (next === "paid" && outstanding > 0) {
      settle = window.confirm(
        `Mark this invoice paid and record the outstanding ${formatINR(outstanding)} as received?\n\n` +
          `Cancel to change the label only, leaving the received amount as it is.`
      );
    }
    setUpdatingId(id);
    setStatusError(null);
    const res = await updateInvoiceStatusAction(id, next, settle);
    setUpdatingId(null);
    if (res.error) {
      setStatusError({ id, message: res.error });
      return;
    }
    router.refresh();
  }

  const filtered = React.useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return items.filter((it) => {
      if (status !== "all" && it.invoice.status !== status) return false;
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
            placeholder="Search by invoice no, client, project, or date…"
            className="pl-9 pr-9"
            aria-label="Search invoices"
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
          {INVOICE_STATUSES.map((sv) => (
            <option key={sv} value={sv}>
              {invoiceStatusMeta[sv].label}
            </option>
          ))}
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} of {items.length} invoice{items.length === 1 ? "" : "s"}
      </p>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No invoices match your search.
          </CardContent>
        </Card>
      ) : (
        filtered.map(({ invoice: inv, client, project }) => {
          const meta = invoiceStatusMeta[inv.status];
          const sub = lineSubtotal(inv.items);
          const tax = (sub * inv.taxRate) / 100;
          const total = lineTotalWithTax(inv.items, inv.taxRate);
          const outstanding = total - inv.received;
          return (
            <Card key={inv.id}>
              <CardHeader className="flex-col gap-3 border-b border-border sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{inv.number}</span>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    <Select
                      aria-label={`Change status of ${inv.number}`}
                      value={inv.status}
                      disabled={updatingId === inv.id}
                      onChange={(e) => changeStatus(inv.id, e.target.value as InvoiceStatus, outstanding)}
                      className="h-7 w-auto py-0 text-xs"
                    >
                      {INVOICE_STATUSES.map((sv) => (
                        <option key={sv} value={sv}>
                          Mark {invoiceStatusMeta[sv].label}
                        </option>
                      ))}
                    </Select>
                    {statusError?.id === inv.id && (
                      <span className="text-xs text-destructive">{statusError.message}</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {project && (
                      <>
                        <Link href={`/projects/${project.id}`} className="hover:underline">
                          {project.code}
                        </Link>{" "}
                        ·{" "}
                      </>
                    )}
                    <Link href={`/clients/${inv.clientId}`} className="hover:underline">
                      {client?.company || client?.name || "—"}
                    </Link>{" "}
                    · {fmtDate(inv.date)}
                    {inv.dueDate && <> · due {fmtDate(inv.dueDate)}</>}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/invoices/new?id=${inv.id}`}>
                    <Button size="sm" variant="outline">
                      <FileText /> Open / PDF
                    </Button>
                  </Link>
                  {canDelete && !UNDELETABLE.includes(inv.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Delete invoice ${inv.number}`}
                      title="Delete this invoice"
                      onClick={() =>
                        setPendingDelete({
                          id: inv.id,
                          number: inv.number,
                          status: inv.status,
                          client: client?.company || client?.name || "",
                          total,
                        })
                      }
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 /> Delete
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
                    {inv.items.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell className="whitespace-pre-wrap font-medium">{it.description}</TableCell>
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
                    <span className="text-muted-foreground">GST ({inv.taxRate}%)</span>
                    <span className="tabular-nums">{formatINR(tax)}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-1.5 font-semibold">
                    <span>Total</span>
                    <span className="tabular-nums">{formatINR(total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Received</span>
                    <span className="tabular-nums">{formatINR(inv.received)}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span className={outstanding > 0 ? "text-destructive" : "text-success"}>
                      {outstanding > 0 ? "Outstanding" : "Settled"}
                    </span>
                    <span className="tabular-nums">{formatINR(Math.max(0, outstanding))}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      {/* keyed per invoice so each open starts from a clean confirm field */}
      <DeleteInvoiceDialog
        key={pendingDelete?.id ?? "none"}
        target={pendingDelete}
        onClose={() => setPendingDelete(null)}
        onDeleted={() => {
          setPendingDelete(null);
          router.refresh();
        }}
      />
    </div>
  );
}
