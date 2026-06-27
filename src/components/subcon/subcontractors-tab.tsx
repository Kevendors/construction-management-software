"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Phone, Building2, Hammer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input, Label } from "@/components/ui/input";
import { Dialog, Select } from "@/components/ui/dialog";
import { createSubcontractor } from "@/app/subcon/actions";
import type { SubconBoard } from "@/lib/data/subcon";
import { tradeLabel } from "@/lib/labels";
import type { Trade } from "@/lib/types";

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

const TRADES = Object.keys(tradeLabel) as Trade[];

function NewSubcontractorDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [company, setCompany] = React.useState("");
  const [contact, setContact] = React.useState("");
  const [trade, setTrade] = React.useState<Trade>("rcc");
  const [phone, setPhone] = React.useState("");
  const [gst, setGst] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!company.trim()) return;
    setSaving(true);
    setError(null);
    const res = await createSubcontractor({
      name: contact.trim() || company.trim(),
      company: company.trim(),
      trade,
      contact: contact.trim(),
      phone: phone.trim(),
      gst: gst.trim(),
    });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onClose();
    setCompany("");
    setContact("");
    setPhone("");
    setGst("");
    setTrade("rcc");
    router.refresh();
  }

  return (
    <Dialog open={open} onClose={onClose} title="New Subcontractor" description="Saved to your workspace.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="sc-company">Company</Label>
          <Input id="sc-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. PowerFlow MEP Services" autoFocus required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="sc-contact">Contact person</Label>
            <Input id="sc-contact" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sc-trade">Trade</Label>
            <Select id="sc-trade" value={trade} onChange={(e) => setTrade(e.target.value as Trade)}>
              {TRADES.map((t) => (
                <option key={t} value={t}>{tradeLabel[t]}</option>
              ))}
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="sc-phone">Phone</Label>
            <Input id="sc-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9XXXXXXXXX" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sc-gst">GSTIN</Label>
            <Input id="sc-gst" value={gst} onChange={(e) => setGst(e.target.value)} placeholder="GST number" />
          </div>
        </div>
        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Add Subcontractor"}</Button>
        </div>
      </form>
    </Dialog>
  );
}

export function SubcontractorsTab({ board }: { board: SubconBoard }) {
  const { subcontractors, workOrders: subconWorkOrders } = board;
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus /> New Subcontractor
        </Button>
      </div>
      {subcontractors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No subcontractors yet — add your first one.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {subcontractors.map((s) => {
            const woCount = subconWorkOrders.filter((w) => w.subcontractorId === s.id).length;
            return (
              <Card key={s.id}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <Avatar initials={initials(s.company)} className="h-11 w-11 text-sm" />
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{s.company}</h3>
                      <p className="truncate text-sm text-muted-foreground">{s.contact}</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                    <p className="flex items-center gap-2">
                      <Hammer className="h-3.5 w-3.5 shrink-0" />
                      <Badge variant="secondary">{tradeLabel[s.trade]}</Badge>
                    </p>
                    <p className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 shrink-0" /> {s.phone}
                    </p>
                    <p className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 shrink-0" /> {s.gst}
                    </p>
                  </div>
                  <div className="mt-4 border-t border-border pt-3">
                    <Badge variant="outline">
                      {woCount} work order{woCount === 1 ? "" : "s"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <NewSubcontractorDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
