"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, FileText, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { woTotals } from "@/lib/data/compute";
import { createWorkOrder, type WorkOrderItemInput } from "@/app/subcon/actions";
import type { SubconBoard } from "@/lib/data/subcon";
import { tradeLabel, woStatusMeta } from "@/lib/labels";
import { formatINR } from "@/lib/utils";
import type { WOStatus } from "@/lib/types";

const today = () => new Date().toISOString().slice(0, 10);
const WO_STATUSES = Object.keys(woStatusMeta) as WOStatus[];

function nextWoNumber(existing: string[]): string {
  const year = new Date().getFullYear();
  const max = existing.reduce((m, n) => {
    const x = /(\d+)\s*$/.exec(n);
    return x ? Math.max(m, Number(x[1])) : m;
  }, 0);
  return `WO-${year}-${String(max + 1).padStart(3, "0")}`;
}

interface DraftItem extends WorkOrderItemInput {
  key: string;
}
const blankItem = (): DraftItem => ({
  key: Math.random().toString(36).slice(2),
  description: "",
  qty: 1,
  unit: "sqft",
  rate: 0,
});

function NewWorkOrderDialog({
  board,
  open,
  onClose,
}: {
  board: SubconBoard;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { subcontractors, projects, workOrders } = board;

  const [number, setNumber] = React.useState("");
  const [subcontractorId, setSubcontractorId] = React.useState("");
  const [projectId, setProjectId] = React.useState("");
  const [date, setDate] = React.useState(today());
  const [status, setStatus] = React.useState<WOStatus>("issued");
  const [taxRate, setTaxRate] = React.useState("18");
  const [signatory, setSignatory] = React.useState("");
  const [items, setItems] = React.useState<DraftItem[]>([blankItem()]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setNumber(nextWoNumber(workOrders.map((w) => w.number)));
    setSubcontractorId((v) => v || subcontractors[0]?.id || "");
    setProjectId((v) => v || projects[0]?.id || "");
  }, [open, workOrders, subcontractors, projects]);

  function updateItem(key: string, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItems((prev) => [...prev, blankItem()]);
  }
  function removeItem(key: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.key !== key) : prev));
  }

  const subtotal = items.reduce((s, it) => s + (it.qty || 0) * (it.rate || 0), 0);
  const tax = (subtotal * (Number(taxRate) || 0)) / 100;
  const total = subtotal + tax;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const valid = items.filter((it) => it.description.trim());
    if (!subcontractorId || !valid.length) {
      setError("Add a subcontractor and at least one line item.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await createWorkOrder({
      number: number.trim(),
      subcontractorId,
      projectId,
      date,
      status,
      taxRate: Number(taxRate) || 0,
      signatory: signatory.trim(),
      items: valid.map(({ description, qty, unit, rate }) => ({ description, qty, unit, rate })),
    });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onClose();
    setItems([blankItem()]);
    setSignatory("");
    router.refresh();
  }

  return (
    <Dialog open={open} onClose={onClose} title="New Work Order" description="Issue a work order to a subcontractor." className="max-w-2xl">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="wo-number">WO #</Label>
            <Input id="wo-number" value={number} onChange={(e) => setNumber(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wo-date">Date</Label>
            <Input id="wo-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="wo-sub">Subcontractor</Label>
            <Select id="wo-sub" value={subcontractorId} onChange={(e) => setSubcontractorId(e.target.value)}>
              {subcontractors.map((s) => (
                <option key={s.id} value={s.id}>{s.company} · {tradeLabel[s.trade]}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wo-project">Project</Label>
            <Select id="wo-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
              ))}
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="wo-status">Status</Label>
            <Select id="wo-status" value={status} onChange={(e) => setStatus(e.target.value as WOStatus)}>
              {WO_STATUSES.map((s) => (
                <option key={s} value={s}>{woStatusMeta[s].label}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wo-tax">GST %</Label>
            <Input id="wo-tax" type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wo-sign">Signatory</Label>
            <Input id="wo-sign" value={signatory} onChange={(e) => setSignatory(e.target.value)} placeholder="Authorised by" />
          </div>
        </div>

        {/* line items */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Line items</Label>
            <Button type="button" size="sm" variant="outline" onClick={addItem}>
              <Plus /> Add item
            </Button>
          </div>
          <div className="space-y-2">
            {items.map((it) => (
              <div key={it.key} className="grid grid-cols-[1fr_4rem_4rem_5rem_auto] items-center gap-2">
                <Input
                  value={it.description}
                  onChange={(e) => updateItem(it.key, { description: e.target.value })}
                  placeholder="Description of work"
                  className="h-8 text-xs"
                />
                <Input
                  type="number"
                  value={it.qty}
                  onChange={(e) => updateItem(it.key, { qty: Number(e.target.value) })}
                  placeholder="Qty"
                  className="h-8 text-xs"
                />
                <Input
                  value={it.unit}
                  onChange={(e) => updateItem(it.key, { unit: e.target.value })}
                  placeholder="Unit"
                  className="h-8 text-xs"
                />
                <Input
                  type="number"
                  value={it.rate}
                  onChange={(e) => updateItem(it.key, { rate: Number(e.target.value) })}
                  placeholder="Rate"
                  className="h-8 text-xs"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeItem(it.key)}
                  aria-label="Remove item"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* totals */}
        <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{formatINR(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">GST ({Number(taxRate) || 0}%)</span>
            <span className="tabular-nums">{formatINR(tax)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-1 font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatINR(total)}</span>
          </div>
        </div>

        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create Work Order"}</Button>
        </div>
      </form>
    </Dialog>
  );
}

export function WorkOrdersTab({ board }: { board: SubconBoard }) {
  const { workOrders, subcontractors, projects } = board;
  const subById = new Map(subcontractors.map((s) => [s.id, s]));
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const [open, setOpen] = React.useState(false);

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm font-medium">{workOrders.length} work orders</p>
        <Button size="sm" onClick={() => setOpen(true)} disabled={subcontractors.length === 0}>
          <Plus /> New Work Order
        </Button>
      </div>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>WO</TableHead>
              <TableHead>Subcontractor</TableHead>
              <TableHead>Trade</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead className="text-right">Doc</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workOrders.map((wo) => {
              const sc = subById.get(wo.subcontractorId) ?? null;
              const project = projectById.get(wo.projectId) ?? null;
              const meta = woStatusMeta[wo.status];
              const totals = woTotals(wo);
              return (
                <TableRow key={wo.id}>
                  <TableCell className="font-medium">{wo.number}</TableCell>
                  <TableCell className="text-muted-foreground">{sc?.company}</TableCell>
                  <TableCell>{sc && <Badge variant="secondary">{tradeLabel[sc.trade]}</Badge>}</TableCell>
                  <TableCell>{project?.code}</TableCell>
                  <TableCell>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatINR(totals.grandTotal, { compact: true })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/subcon/wo/${wo.id}/print`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      <FileText className="h-4 w-4" /> PDF
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
            {workOrders.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  No work orders yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      <NewWorkOrderDialog board={board} open={open} onClose={() => setOpen(false)} />
    </Card>
  );
}
