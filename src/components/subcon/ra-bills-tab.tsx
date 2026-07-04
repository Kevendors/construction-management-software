"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
import { createRaBill } from "@/app/subcon/actions";
import type { SubconBoard } from "@/lib/data/subcon";
import { raStatusMeta } from "@/lib/labels";
import { formatINR, todayISO } from "@/lib/utils";
import type { RAStatus } from "@/lib/types";

const today = () => new Date().toISOString().slice(0, 10);
const RA_STATUSES = Object.keys(raStatusMeta) as RAStatus[];

function nextRaNumber(existing: string[]): string {
  const year = new Date().getFullYear();
  const max = existing.reduce((m, n) => {
    const x = /(\d+)\s*$/.exec(n);
    return x ? Math.max(m, Number(x[1])) : m;
  }, 0);
  return `RA-${year}-${String(max + 1).padStart(3, "0")}`;
}

function NewRaBillDialog({
  board,
  open,
  onClose,
}: {
  board: SubconBoard;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { workOrders, subcontractors, raBills, progress } = board;
  const subById = new Map(subcontractors.map((s) => [s.id, s]));

  const [workOrderId, setWorkOrderId] = React.useState("");
  const [number, setNumber] = React.useState("");
  const [date, setDate] = React.useState(today());
  const [percent, setPercent] = React.useState("");
  const [gross, setGross] = React.useState("");
  const [deductions, setDeductions] = React.useState("0");
  const [status, setStatus] = React.useState<RAStatus>("submitted");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setNumber(nextRaNumber(raBills.map((r) => r.number)));
    setWorkOrderId((v) => v || workOrders[0]?.id || "");
  }, [open, raBills, workOrders]);

  const wo = workOrders.find((w) => w.id === workOrderId) ?? null;
  const woValue = wo ? woTotals(wo).grandTotal : 0;
  const latestPct = wo
    ? progress.filter((p) => p.workOrderId === wo.id).sort((a, b) => +new Date(b.date) - +new Date(a.date))[0]?.percent ?? 0
    : 0;

  // Suggest gross = WO value × % complete when the user hasn't typed one.
  function onPercentChange(v: string) {
    setPercent(v);
    if (wo && (!gross || gross === "0")) {
      setGross(String(Math.round((woValue * (Number(v) || 0)) / 100)));
    }
  }

  const net = Math.max(0, (Number(gross) || 0) - (Number(deductions) || 0));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!workOrderId || !Number(gross)) return;
    setSaving(true);
    setError(null);
    const res = await createRaBill({
      number: number.trim(),
      workOrderId,
      date,
      percentComplete: Number(percent) || 0,
      grossAmount: Number(gross) || 0,
      deductions: Number(deductions) || 0,
      status,
    });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onClose();
    setGross("");
    setDeductions("0");
    setPercent("");
    router.refresh();
  }

  return (
    <Dialog open={open} onClose={onClose} title="New RA Bill" description="Running-account bill against a work order.">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ra-number">RA Bill #</Label>
            <Input id="ra-number" value={number} onChange={(e) => setNumber(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ra-date">Date</Label>
            <Input id="ra-date" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ra-wo">Work Order</Label>
          <Select id="ra-wo" value={workOrderId} onChange={(e) => setWorkOrderId(e.target.value)}>
            {workOrders.map((w) => (
              <option key={w.id} value={w.id}>
                {w.number} · {subById.get(w.subcontractorId)?.company ?? ""}
              </option>
            ))}
          </Select>
          {wo && (
            <p className="text-xs text-muted-foreground">
              WO value {formatINR(woValue, { compact: true })} · latest progress {latestPct}%
            </p>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ra-pct">% Complete</Label>
            <Input id="ra-pct" type="number" value={percent} onChange={(e) => onPercentChange(e.target.value)} placeholder={String(latestPct)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ra-gross">Gross (₹)</Label>
            <Input id="ra-gross" type="number" value={gross} onChange={(e) => setGross(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ra-ded">Deductions (₹)</Label>
            <Input id="ra-ded" type="number" value={deductions} onChange={(e) => setDeductions(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-md bg-secondary px-3 py-2 text-sm">
          <span className="text-muted-foreground">Net payable</span>
          <span className="font-semibold tabular-nums">{formatINR(net)}</span>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ra-status">Status</Label>
          <Select id="ra-status" value={status} onChange={(e) => setStatus(e.target.value as RAStatus)}>
            {RA_STATUSES.map((s) => (
              <option key={s} value={s}>{raStatusMeta[s].label}</option>
            ))}
          </Select>
        </div>
        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create RA Bill"}</Button>
        </div>
      </form>
    </Dialog>
  );
}

export function RaBillsTab({ board }: { board: SubconBoard }) {
  const { raBills, workOrders, subcontractors } = board;
  const woById = new Map(workOrders.map((w) => [w.id, w]));
  const subById = new Map(subcontractors.map((s) => [s.id, s]));
  const [open, setOpen] = React.useState(false);

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm font-medium">{raBills.length} running-account bills</p>
        <Button size="sm" onClick={() => setOpen(true)} disabled={workOrders.length === 0}>
          <Plus /> New RA Bill
        </Button>
      </div>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>RA Bill</TableHead>
              <TableHead>Work Order</TableHead>
              <TableHead>Subcontractor</TableHead>
              <TableHead className="text-right">% Complete</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead className="text-right">Deductions</TableHead>
              <TableHead className="text-right">Net Payable</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {raBills.map((ra) => {
              const wo = woById.get(ra.workOrderId) ?? null;
              const sc = wo ? subById.get(wo.subcontractorId) ?? null : null;
              const meta = raStatusMeta[ra.status];
              return (
                <TableRow key={ra.id}>
                  <TableCell className="font-medium">{ra.number}</TableCell>
                  <TableCell className="text-muted-foreground">{wo?.number}</TableCell>
                  <TableCell className="text-muted-foreground">{sc?.company}</TableCell>
                  <TableCell className="text-right tabular-nums">{ra.percentComplete}%</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(ra.grossAmount)}</TableCell>
                  <TableCell className="text-right tabular-nums text-destructive">
                    − {formatINR(ra.deductions)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatINR(ra.netAmount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
            {raBills.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  No RA bills yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      <NewRaBillDialog board={board} open={open} onClose={() => setOpen(false)} />
    </Card>
  );
}
