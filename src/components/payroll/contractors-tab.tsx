"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { Dialog, Select } from "@/components/ui/dialog";
import type { PayrollBoard } from "@/lib/payroll/compute";
import { addContractorAction } from "@/app/payroll/actions";
import { tradeLabel } from "@/lib/labels";
import { formatINR } from "@/lib/utils";
import type { Trade } from "@/lib/types";

const TRADES: Trade[] = ["rcc", "mep", "plumbing", "electrical", "facade", "finishes", "waterproofing"];

export function ContractorsTab({ board }: { board: PayrollBoard }) {
  const { contractors, attendance } = board;
  const [open, setOpen] = React.useState(false);
  const lastPresentOf = (contractorId: string) => {
    const rows = attendance
      .filter((a) => a.contractorId === contractorId)
      .sort((a, b) => +new Date(b.date) - +new Date(a.date));
    return rows[0]?.present ?? 0;
  };

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm font-medium">{contractors.length} labour contractors</p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus /> Add Contractor
        </Button>
      </div>
      <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {contractors.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
            No contractors yet — click &quot;Add Contractor&quot;.
          </p>
        )}
        {contractors.map((c) => {
          const lastPresent = lastPresentOf(c.id);
          return (
            <div key={c.id} className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{c.company || c.name}</p>
                  <p className="text-sm text-muted-foreground">{c.name}</p>
                </div>
                <Badge variant="outline">{tradeLabel[c.trade]}</Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Headcount</p>
                  <p className="font-medium tabular-nums">{c.headcount}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Avg day rate</p>
                  <p className="font-medium tabular-nums">{formatINR(c.dayRate)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Last present</p>
                  <p className="font-medium tabular-nums text-success">{lastPresent}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Est. daily cost</p>
                  <p className="font-medium tabular-nums">{formatINR(c.headcount * c.dayRate, { compact: true })}</p>
                </div>
              </div>
              {c.phone && (
                <div className="mt-3 flex items-center gap-1 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3" /> {c.phone}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>

      <AddContractorDialog open={open} onClose={() => setOpen(false)} />
    </Card>
  );
}

function AddContractorDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [company, setCompany] = React.useState("");
  const [name, setName] = React.useState("");
  const [trade, setTrade] = React.useState<Trade>("rcc");
  const [phone, setPhone] = React.useState("");
  const [headcount, setHeadcount] = React.useState("");
  const [dayRate, setDayRate] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!company.trim() && !name.trim()) return setError("Company or contact name is required.");
    setSaving(true);
    setError(null);
    const res = await addContractorAction({
      company: company.trim(),
      name: name.trim(),
      trade,
      phone: phone.trim(),
      headcount: Number(headcount) || 0,
      dayRate: Number(dayRate) || 0,
    });
    setSaving(false);
    if (res.error) return setError(res.error);
    onClose();
    setCompany(""); setName(""); setPhone(""); setHeadcount(""); setDayRate("");
    router.refresh();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Add Contractor" description="Add a labour contractor." className="max-w-lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="c-company">Company</Label>
            <Input id="c-company" value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-name">Contact Name</Label>
            <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-trade">Trade</Label>
            <Select id="c-trade" value={trade} onChange={(e) => setTrade(e.target.value as Trade)}>
              {TRADES.map((t) => <option key={t} value={t}>{tradeLabel[t]}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-phone">Phone</Label>
            <Input id="c-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-head">Headcount</Label>
            <Input id="c-head" type="number" value={headcount} onChange={(e) => setHeadcount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-rate">Avg Day Rate (₹)</Label>
            <Input id="c-rate" type="number" value={dayRate} onChange={(e) => setDayRate(e.target.value)} />
          </div>
        </div>
        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Add Contractor"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
