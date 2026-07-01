"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { createClientAction, updateClientAction, type ClientInput } from "@/app/clients/actions";
import type { Client } from "@/lib/types";

export function ClientDialog({
  open,
  onClose,
  client,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  client?: Client | null;
  /** Called with the new id after a create (e.g. to navigate). */
  onCreated?: (id: string) => void;
}) {
  const router = useRouter();
  const editing = Boolean(client);
  const [form, setForm] = React.useState<ClientInput>({
    name: "",
    company: "",
    email: "",
    phone: "",
    address: "",
    gst: "",
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setForm({
      name: client?.name ?? "",
      company: client?.company ?? "",
      email: client?.email ?? "",
      phone: client?.phone ?? "",
      address: client?.address ?? "",
      gst: client?.gst ?? "",
    });
  }, [open, client]);

  function set<K extends keyof ClientInput>(k: K, v: ClientInput[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company.trim() && !form.name.trim()) {
      setError("Company or contact name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = editing
      ? await updateClientAction(client!.id, form)
      : await createClientAction(form);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onClose();
    router.refresh();
    if (!editing && res.id) onCreated?.(res.id);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? "Edit Client" : "New Client"}
      description="Client / party details for your CRM."
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="c-company">Company</Label>
          <Input id="c-company" value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="e.g. Agarwal Estates Pvt Ltd" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="c-name">Contact person</Label>
            <Input id="c-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Full name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-phone">Phone</Label>
            <Input id="c-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="9XXXXXXXXX" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="c-email">Email</Label>
            <Input id="c-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="you@company.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-gst">GSTIN</Label>
            <Input id="c-gst" value={form.gst} onChange={(e) => set("gst", e.target.value)} placeholder="GST number" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-address">Address</Label>
          <Input id="c-address" value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Full address" />
        </div>
        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Add Client"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
