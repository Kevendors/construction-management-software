"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import type { PayrollBoard } from "@/lib/payroll/compute";
import { advanceOutstanding } from "@/lib/payroll/compute";
import { recordAdvanceAction } from "@/app/payroll/actions";
import { advanceStatusMeta } from "@/lib/labels";
import { formatINR, todayISO } from "@/lib/utils";
import type { Advance, AdvanceParty } from "@/lib/types";

const today = () => new Date().toISOString().slice(0, 10);

export function AdvancesTab({ board }: { board: PayrollBoard }) {
  const { advances, employees, contractors } = board;
  const [open, setOpen] = React.useState(false);
  const empById = new Map(employees.map((e) => [e.id, e]));
  const conById = new Map(contractors.map((c) => [c.id, c]));
  const partyName = (a: Advance) =>
    a.partyType === "employee" ? empById.get(a.partyId)?.name : conById.get(a.partyId)?.company || conById.get(a.partyId)?.name;

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm font-medium">{advances.length} advances</p>
        <Button size="sm" onClick={() => setOpen(true)} disabled={employees.length === 0 && contractors.length === 0}>
          <Plus /> New Advance
        </Button>
      </div>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Party</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Advance</TableHead>
              <TableHead className="w-40">Recovered</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {advances.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  No advances recorded yet.
                </TableCell>
              </TableRow>
            )}
            {advances.map((a) => {
              const meta = advanceStatusMeta[a.status];
              const pct = a.amount > 0 ? (a.recovered / a.amount) * 100 : 0;
              return (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="font-medium">{partyName(a)}</div>
                    <div className="text-xs text-muted-foreground">{a.note}</div>
                  </TableCell>
                  <TableCell className="capitalize text-muted-foreground">{a.partyType}</TableCell>
                  <TableCell className="tabular-nums">
                    {new Date(a.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(a.amount)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={pct} className="flex-1" />
                      <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{pct.toFixed(0)}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatINR(advanceOutstanding(a))}</TableCell>
                  <TableCell>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>

      <RecordAdvanceDialog board={board} open={open} onClose={() => setOpen(false)} />
    </Card>
  );
}

function RecordAdvanceDialog({ board, open, onClose }: { board: PayrollBoard; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { employees, contractors } = board;
  const [partyType, setPartyType] = React.useState<AdvanceParty>(employees.length ? "employee" : "contractor");
  const [partyId, setPartyId] = React.useState("");
  const [date, setDate] = React.useState(today());
  const [amount, setAmount] = React.useState("");
  const [recovered, setRecovered] = React.useState("");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const parties = partyType === "employee"
    ? employees.map((e) => ({ id: e.id, label: e.name }))
    : contractors.map((c) => ({ id: c.id, label: c.company || c.name }));

  React.useEffect(() => {
    setPartyId(parties[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyType, open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!partyId) return setError("Select a party.");
    if (!Number(amount)) return setError("Amount is required.");
    setSaving(true);
    setError(null);
    const res = await recordAdvanceAction({
      partyType,
      partyId,
      date,
      amount: Number(amount),
      recovered: Number(recovered) || 0,
      note: note.trim(),
    });
    setSaving(false);
    if (res.error) return setError(res.error);
    onClose();
    setAmount(""); setRecovered(""); setNote("");
    router.refresh();
  }

  return (
    <Dialog open={open} onClose={onClose} title="New Advance" description="Record a salary or contractor advance." className="max-w-lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ad-type">Party Type</Label>
            <Select id="ad-type" value={partyType} onChange={(e) => setPartyType(e.target.value as AdvanceParty)}>
              <option value="employee">Employee</option>
              <option value="contractor">Contractor</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ad-party">Party</Label>
            <Select id="ad-party" value={partyId} onChange={(e) => setPartyId(e.target.value)}>
              {parties.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ad-date">Date</Label>
            <Input id="ad-date" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ad-amount">Amount (₹) *</Label>
            <Input id="ad-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ad-rec">Recovered so far (₹)</Label>
            <Input id="ad-rec" type="number" value={recovered} onChange={(e) => setRecovered(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="ad-note">Note</Label>
            <Input id="ad-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
