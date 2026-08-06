"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Download, ExternalLink, ReceiptText, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, Select } from "@/components/ui/dialog";
import { Label } from "@/components/ui/input";
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
import {
  deleteQuotationAction,
  getQuotationPayloadAction,
  updateQuotationStatusAction,
  type QuotationStatus,
} from "@/app/quotations/actions";
import { quoteStateToInvoiceState } from "@/lib/quotation/to-invoice";

const QUOTATION_STATUSES: QuotationStatus[] = ["draft", "sent", "accepted", "rejected"];

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

/**
 * Same handoff the quotation editor's "Convert to Project" button uses
 * (src/app/quotations/new/page.tsx): drop a prefill payload in localStorage
 * and land on /projects, where ProjectsBoard picks it up and opens the New
 * Project dialog pre-filled. The user still confirms via "Create Project".
 */
function convertToProject(
  router: ReturnType<typeof useRouter>,
  q: Quotation,
  client: Client | null,
  total: number
) {
  const payload = {
    name: q.projectName || client?.company || client?.name || "New Project",
    value: Math.round(total),
    location: "",
    // Lets ProjectsBoard stamp the quotation once the project is created.
    quotationId: q.id,
  };
  try {
    localStorage.setItem("sitehub:newProjectPrefill", JSON.stringify(payload));
  } catch {
    /* ignore (quota/private-browsing) */
  }
  router.push("/projects?new=1");
}

/** The quotation a delete has been requested for, plus what the dialog shows. */
interface PendingDelete {
  id: string;
  number: string;
  status: QuotationStatus;
  client: string;
  total: number;
}

/**
 * Deleting is permanent (line items cascade away), so drafts get a plain
 * confirm while anything that has left the building — sent or rejected —
 * requires typing the quotation number. Accepted quotes never reach here: the
 * button is hidden, and the server action refuses them regardless.
 */
function DeleteQuotationDialog({
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
    const res = await deleteQuotationAction(target.id);
    setBusy(false);
    if (res.error) return setError(res.error);
    onDeleted();
  }

  return (
    <Dialog
      open={!!target}
      onClose={onClose}
      title="Delete Quotation"
      description="This permanently removes the quotation and all of its line items. It can't be undone."
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
                <Badge variant={quotationStatusMeta[target.status].variant}>
                  {quotationStatusMeta[target.status].label}
                </Badge>
              </dd>
            </div>
          </dl>
        )}

        {mustType && target && (
          <div className="space-y-1.5">
            <Label htmlFor="del-confirm">
              This quotation was already {quotationStatusMeta[target.status].label.toLowerCase()}. Type{" "}
              <span className="font-mono font-semibold">{target.number}</span> to confirm.
            </Label>
            <Input
              id="del-confirm"
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
            {busy ? "Deleting…" : "Delete Quotation"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function QuotationsList({
  items,
  canDelete = false,
}: {
  items: QuotationListItem[];
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<string>("all");
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);
  const [statusError, setStatusError] = React.useState<{ id: string; message: string } | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<PendingDelete | null>(null);
  const [converting, setConverting] = React.useState<string | null>(null);

  /**
   * The list only holds saved line items, not the builder state, so fetch the
   * quote's payload and map it before handing off to the invoice builder. The
   * invoice is only written once the user reviews and saves it.
   */
  async function convertToInvoice(quotationId: string) {
    setConverting(quotationId);
    const payload = await getQuotationPayloadAction(quotationId);
    setConverting(null);
    if (!payload) {
      window.alert("This quotation has no saved details to convert. Open it, save it, then try again.");
      return;
    }
    try {
      localStorage.setItem(
        "sitehub:newInvoicePrefill",
        JSON.stringify({ state: quoteStateToInvoiceState(payload), quotationId })
      );
    } catch {
      /* ignore (quota/private-browsing) */
    }
    router.push("/invoices/new");
  }

  async function changeStatus(id: string, next: QuotationStatus) {
    setUpdatingId(id);
    setStatusError(null);
    const res = await updateQuotationStatusAction(id, next);
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
                    <Select
                      aria-label={`Change status of ${q.number}`}
                      value={q.status}
                      disabled={updatingId === q.id}
                      onChange={(e) => changeStatus(q.id, e.target.value as QuotationStatus)}
                      className="h-7 w-auto py-0 text-xs"
                    >
                      {QUOTATION_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          Mark {quotationStatusMeta[s].label}
                        </option>
                      ))}
                    </Select>
                    {statusError?.id === q.id && (
                      <span className="text-xs text-destructive">{statusError.message}</span>
                    )}
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
                  {q.status === "accepted" &&
                    (q.convertedProjectId ? (
                      // Already converted — link to it instead of offering to
                      // convert again, which would create a duplicate project.
                      <Link href={`/projects/${q.convertedProjectId}`}>
                        <Button size="sm" variant="secondary">
                          <ExternalLink /> View Project
                        </Button>
                      </Link>
                    ) : (
                      <Button size="sm" onClick={() => convertToProject(router, q, client, total)}>
                        <ArrowRightLeft /> Convert to Project
                      </Button>
                    ))}
                  {q.status === "accepted" &&
                    (q.convertedInvoiceId ? (
                      <Link href={`/invoices/new?id=${q.convertedInvoiceId}`}>
                        <Button size="sm" variant="secondary">
                          <ExternalLink /> View Invoice
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={converting === q.id}
                        onClick={() => convertToInvoice(q.id)}
                      >
                        <ReceiptText /> {converting === q.id ? "Preparing…" : "Convert to Invoice"}
                      </Button>
                    ))}
                  {canDelete && q.status !== "accepted" && (
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Delete quotation ${q.number}`}
                      title="Delete this quotation"
                      onClick={() =>
                        setPendingDelete({
                          id: q.id,
                          number: q.number,
                          status: q.status as QuotationStatus,
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

      {/* keyed per quotation so each open starts from a clean confirm field */}
      <DeleteQuotationDialog
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
