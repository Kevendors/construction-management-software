"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Plus, Search, Trash2, X } from "lucide-react";
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
import { purchaseBillStatusMeta } from "@/lib/labels";
import { formatINR } from "@/lib/utils";
import type { Project, PurchaseBill, Supplier } from "@/lib/types";
import {
  deletePurchaseBillAction,
  updatePurchaseBillStatusAction,
  type PurchaseBillStatus,
} from "@/app/purchases/actions";

const BILL_STATUSES: PurchaseBillStatus[] = ["draft", "sent", "partial", "paid"];
const UNDELETABLE: PurchaseBillStatus[] = ["paid", "partial"];

const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";

function haystack(bill: PurchaseBill, supplier: Supplier | null, project: Project | null): string {
  return [bill.number, supplier?.company, supplier?.name, project?.code, project?.name, purchaseBillStatusMeta[bill.status]?.label, bill.status, bill.date, fmtDate(bill.date)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function billTotal(bill: PurchaseBill): number {
  const sub = bill.items.reduce((s, it) => s + it.qty * it.rate, 0);
  return sub + (sub * bill.taxRate) / 100;
}

interface PendingDelete {
  id: string;
  number: string;
  status: PurchaseBillStatus;
  supplier: string;
  total: number;
}

/** Drafts delete on a plain confirm; anything already sent needs the number typed. */
function DeleteBillDialog({
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
    const res = await deletePurchaseBillAction(target.id);
    setBusy(false);
    if (res.error) return setError(res.error);
    onDeleted();
  }

  return (
    <Dialog
      open={!!target}
      onClose={onClose}
      title="Delete Purchase Bill"
      description="This permanently removes the bill and all of its line items. It can't be undone."
    >
      <form onSubmit={submit} className="space-y-4">
        {target && (
          <dl className="space-y-1.5 rounded-md border border-border bg-secondary/40 px-3 py-2.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Number</dt>
              <dd className="font-medium">{target.number}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Supplier</dt>
              <dd className="truncate font-medium">{target.supplier || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Total</dt>
              <dd className="font-medium">{formatINR(target.total)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <Badge variant={purchaseBillStatusMeta[target.status].variant}>
                  {purchaseBillStatusMeta[target.status].label}
                </Badge>
              </dd>
            </div>
          </dl>
        )}

        {mustType && target && (
          <div className="space-y-1.5">
            <Label htmlFor="bill-del-confirm">
              This bill was already {purchaseBillStatusMeta[target.status].label.toLowerCase()}. Type{" "}
              <span className="font-mono font-semibold">{target.number}</span> to confirm.
            </Label>
            <Input
              id="bill-del-confirm"
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
            {busy ? "Deleting…" : "Delete Bill"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function PurchaseBillsList({
  bills,
  suppliers,
  projects,
  canDelete = false,
}: {
  bills: PurchaseBill[];
  suppliers: Supplier[];
  projects: Project[];
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<string>("all");
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);
  const [statusError, setStatusError] = React.useState<{ id: string; message: string } | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<PendingDelete | null>(null);

  const supplierById = React.useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);
  const projectById = React.useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  /**
   * Marking a bill paid while money is still outstanding is almost always
   * meant as "it's been settled", so offer to record the balance too.
   * Declining still changes the label — that's the deliberate override.
   */
  async function changeStatus(id: string, next: PurchaseBillStatus, outstanding: number) {
    let settle = false;
    if (next === "paid" && outstanding > 0) {
      settle = window.confirm(
        `Mark this bill paid and record the outstanding ${formatINR(outstanding)} as paid?\n\n` +
          `Cancel to change the label only, leaving the paid amount as it is.`
      );
    }
    setUpdatingId(id);
    setStatusError(null);
    const res = await updatePurchaseBillStatusAction(id, next, settle);
    setUpdatingId(null);
    if (res.error) {
      setStatusError({ id, message: res.error });
      return;
    }
    router.refresh();
  }

  const filtered = React.useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return bills.filter((bill) => {
      if (status !== "all" && bill.status !== status) return false;
      if (!terms.length) return true;
      const hay = haystack(bill, supplierById.get(bill.supplierId) ?? null, projectById.get(bill.projectId) ?? null);
      return terms.every((t) => hay.includes(t));
    });
  }, [bills, query, status, supplierById, projectById]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by bill no, supplier, project, or date…"
            className="pl-9 pr-9"
            aria-label="Search purchase bills"
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
          {BILL_STATUSES.map((sv) => (
            <option key={sv} value={sv}>
              {purchaseBillStatusMeta[sv].label}
            </option>
          ))}
        </Select>
        <Link href="/purchases/bill/new">
          <Button>
            <Plus /> New Bill
          </Button>
        </Link>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} of {bills.length} purchase bill{bills.length === 1 ? "" : "s"}
      </p>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No purchase bills match your search.
          </CardContent>
        </Card>
      ) : (
        filtered.map((bill) => {
          const supplier = supplierById.get(bill.supplierId) ?? null;
          const project = projectById.get(bill.projectId) ?? null;
          const meta = purchaseBillStatusMeta[bill.status];
          const sub = bill.items.reduce((s, it) => s + it.qty * it.rate, 0);
          const tax = (sub * bill.taxRate) / 100;
          const total = billTotal(bill);
          const outstanding = total - bill.paid;
          return (
            <Card key={bill.id}>
              <CardHeader className="flex-col gap-3 border-b border-border sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{bill.number}</span>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    <Select
                      aria-label={`Change status of ${bill.number}`}
                      value={bill.status}
                      disabled={updatingId === bill.id}
                      onChange={(e) => changeStatus(bill.id, e.target.value as PurchaseBillStatus, outstanding)}
                      className="h-7 w-auto py-0 text-xs"
                    >
                      {BILL_STATUSES.map((sv) => (
                        <option key={sv} value={sv}>
                          Mark {purchaseBillStatusMeta[sv].label}
                        </option>
                      ))}
                    </Select>
                    {statusError?.id === bill.id && (
                      <span className="text-xs text-destructive">{statusError.message}</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {project && <>{project.code} · </>}
                    {supplier?.company || supplier?.name || "—"} · {fmtDate(bill.date)}
                    {bill.dueDate && <> · due {fmtDate(bill.dueDate)}</>}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/purchases/bill/new?id=${bill.id}`}>
                    <Button size="sm" variant="outline">
                      <FileText /> Open / PDF
                    </Button>
                  </Link>
                  {canDelete && !UNDELETABLE.includes(bill.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Delete purchase bill ${bill.number}`}
                      title="Delete this bill"
                      onClick={() =>
                        setPendingDelete({
                          id: bill.id,
                          number: bill.number,
                          status: bill.status,
                          supplier: supplier?.company || supplier?.name || "",
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
                    {bill.items.map((it) => (
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
                    <span className="tabular-nums">{formatINR(sub)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">GST ({bill.taxRate}%)</span>
                    <span className="tabular-nums">{formatINR(tax)}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-1.5 font-semibold">
                    <span>Total</span>
                    <span className="tabular-nums">{formatINR(total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Paid</span>
                    <span className="tabular-nums">{formatINR(bill.paid)}</span>
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

      <DeleteBillDialog
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
