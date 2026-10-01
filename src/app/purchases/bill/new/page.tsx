"use client";

import * as React from "react";
import { ArrowLeft, Plus, Printer, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select, Textarea } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PurchaseBillDocument } from "@/components/purchases/purchase-bill-document";
import {
  billLineAmount,
  computeBill,
  getLumpsumMode,
  nextBillNumber,
  type BillLine,
  type BillState,
  type LumpsumMode,
} from "@/lib/purchases/compute";
import { savePurchaseBillAction, getPurchaseBillPayloadAction } from "@/app/purchases/actions";
import { todayISO } from "@/lib/utils";
import { toggleBoldInTextarea } from "@/lib/quotation/rich-text";

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 9);

const DEFAULT_BILL_TERMS = `1. Payment is due within 30 days of bill date.
2. Please share proof of delivery/completion before payment is released.
3. Bill amount verified against the Purchase Order where applicable.`;

const emptyState = (): BillState => ({
  supplierName: "",
  company: "",
  address: "",
  supplierGstin: "",
  contact: "",
  email: "",
  number: "",
  date: today(),
  dueDate: plusDays(30),
  projectName: "",
  sourcePoId: null,
  taxMode: "intra",
  gstRate: 18,
  discount: 0,
  lines: [],
  notes: "",
  terms: DEFAULT_BILL_TERMS,
});

export default function NewPurchaseBillPage() {
  const [s, setS] = React.useState<BillState>(emptyState);
  const [billId, setBillId] = React.useState<string | null>(null);
  // Purchase Order this bill was converted from, saved only on first insert
  // (savePurchaseBillAction's sourcePoId param) — a ref since nothing renders from it.
  const sourcePoId = React.useRef<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [savedMsg, setSavedMsg] = React.useState<string | null>(null);

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const allSelected = s.lines.length > 0 && s.lines.every((l) => selected.has(l.id));

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(s.lines.map((l) => l.id)));
  }
  function applyLumpsumToSelected(mode: LumpsumMode) {
    setS((prev) => ({
      ...prev,
      lines: prev.lines.map((l) => (selected.has(l.id) ? { ...l, lumpsumMode: mode } : l)),
    }));
  }
  const c = computeBill(s);

  React.useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) {
      setBillId(id);
      getPurchaseBillPayloadAction(id).then((payload) => {
        if (payload) setS(payload);
      });
      return;
    }
    // Handed over by "Convert to Bill" on a purchase order. Consumed once,
    // then cleared, same as the invoice builder's own prefill.
    try {
      const raw = localStorage.getItem("sitehub:newBillPrefill");
      if (raw) {
        localStorage.removeItem("sitehub:newBillPrefill");
        const pre = JSON.parse(raw) as { state: BillState; sourcePoId?: string };
        sourcePoId.current = pre.sourcePoId ?? null;
        setS(pre.state);
        return;
      }
    } catch {
      /* ignore malformed/unavailable storage and fall through to a blank bill */
    }
    setS((prev) => (prev.number ? prev : { ...prev, number: nextBillNumber() }));
  }, []);

  function set<K extends keyof BillState>(k: K, v: BillState[K]) {
    setS((prev) => ({ ...prev, [k]: v }));
  }
  function updateLine(id: string, patch: Partial<BillLine>) {
    setS((prev) => ({ ...prev, lines: prev.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  }
  function removeLine(id: string) {
    setS((prev) => ({ ...prev, lines: prev.lines.filter((l) => l.id !== id) }));
  }
  function addLine() {
    setS((prev) => ({
      ...prev,
      lines: [...prev.lines, { id: uid(), description: "", unit: "NOS", qty: 1, rate: 0, lumpsumMode: "none" }],
    }));
  }

  async function saveBill() {
    setSaving(true);
    setSavedMsg(null);
    try {
      const res = await savePurchaseBillAction(s, c.grandTotal, billId, sourcePoId.current);
      if (res.error) setSavedMsg(`Could not save: ${res.error}`);
      else {
        setSavedMsg("Saved to database ✓");
        if (res.id && res.id !== billId) {
          setBillId(res.id);
          window.history.replaceState(null, "", `/purchases/bill/new?id=${res.id}`);
          sourcePoId.current = null; // recorded on the row now
        }
      }
    } catch (e) {
      setSavedMsg(`Could not save: ${e instanceof Error ? e.message : "error"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/purchases" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Purchases
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {savedMsg && (
            <span className={`text-xs font-medium ${savedMsg.startsWith("Could not") ? "text-destructive" : "text-success"}`}>
              {savedMsg}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={saveBill} disabled={saving}>
            <Save /> {saving ? "Saving…" : "Save"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer /> Print / PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 print:hidden xl:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Supplier Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Field label="Supplier Name"><Input value={s.supplierName} onChange={(e) => set("supplierName", e.target.value)} /></Field>
              <Field label="Company Name"><Input value={s.company} onChange={(e) => set("company", e.target.value)} /></Field>
              <Field label="Contact Number"><Input value={s.contact} onChange={(e) => set("contact", e.target.value)} /></Field>
              <Field label="Email"><Input value={s.email} onChange={(e) => set("email", e.target.value)} /></Field>
              <Field label="Address" full><Input value={s.address} onChange={(e) => set("address", e.target.value)} /></Field>
              <Field label="Supplier GSTIN"><Input value={s.supplierGstin} onChange={(e) => set("supplierGstin", e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" maxLength={15} /></Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Bill Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Field label="Project Name" full><Input value={s.projectName} onChange={(e) => set("projectName", e.target.value)} placeholder="e.g. Interior Renovation - Block A" /></Field>
              <Field label="Bill Number"><Input value={s.number} onChange={(e) => set("number", e.target.value)} /></Field>
              <Field label="Date"><Input type="date" value={s.date} max={todayISO()} onChange={(e) => set("date", e.target.value)} /></Field>
              <Field label="Due Date"><Input type="date" value={s.dueDate} min={s.date} onChange={(e) => set("dueDate", e.target.value)} /></Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Line Items</CardTitle>
              <Button size="sm" variant="outline" onClick={addLine}><Plus /> Custom</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {s.lines.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No items yet — click Custom to add one.</p>}
              {s.lines.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Tip: select text in a description and press <kbd className="rounded border border-border px-1">Ctrl</kbd>+<kbd className="rounded border border-border px-1">B</kbd> to bold it, or wrap it in **asterisks**. Line breaks are kept as typed.
                </p>
              )}
              {s.lines.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs">
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                    Select all
                  </label>
                  <span className="text-muted-foreground">{selected.size} selected</span>
                  <Select
                    aria-label="Set lumpsum mode for the selected lines"
                    value=""
                    disabled={selected.size === 0}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v) applyLumpsumToSelected(v as LumpsumMode);
                    }}
                    className="h-7 w-auto py-0 text-xs"
                  >
                    <option value="">Set Lumpsum to…</option>
                    <option value="none">No — Qty × Rate</option>
                    <option value="qty">In Qty — enter Rate</option>
                    <option value="qty_rate">In Qty + Rate — enter Amount</option>
                    <option value="amount_only">Amount only — Qty &amp; Rate blank</option>
                    <option value="rate">In Rate — enter Amount</option>
                    <option value="amount">In Amount — enter Rate</option>
                  </Select>
                </div>
              )}
              {s.lines.map((l, i) => {
                const lm = getLumpsumMode(l);
                return (
                <div key={l.id} className="rounded-lg border border-border p-3">
                  <div className="mb-2 flex items-start gap-2">
                    <input
                      type="checkbox"
                      aria-label={`Select item ${i + 1}`}
                      checked={selected.has(l.id)}
                      onChange={() => toggleSelected(l.id)}
                      className="mt-2.5"
                    />
                    <span className="mt-2 text-xs font-medium text-muted-foreground">{i + 1}.</span>
                    <Textarea
                      value={l.description}
                      onChange={(e) => updateLine(l.id, { description: e.target.value })}
                      onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
                          const next = toggleBoldInTextarea(e.currentTarget);
                          if (next !== null) {
                            e.preventDefault();
                            updateLine(l.id, { description: next });
                          }
                        }
                      }}
                      placeholder="Item / material description"
                      className="min-h-[48px] flex-1"
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeLine(l.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    <Field label="Unit" small>
                      <Select value={l.unit} onChange={(e) => updateLine(l.id, { unit: e.target.value })} className="h-8 text-xs">
                        {["SQFT", "SQM", "RFT", "RMT", "FEET", "CUM", "KG", "MT", "BAG", "NOS", "POINT", "LUMPSUM"].map((u) => <option key={u} value={u}>{u}</option>)}
                      </Select>
                    </Field>
                    <Field label="Qty" small>
                      {lm === "qty" || lm === "qty_rate" ? (
                        <div className="flex h-8 items-center rounded-md border border-input bg-secondary px-2 text-xs font-medium text-muted-foreground">Lumpsum</div>
                      ) : lm === "amount_only" ? (
                        <div className="h-8 rounded-md border border-input bg-secondary" aria-hidden />
                      ) : (
                        <Input type="number" value={l.qty} onChange={(e) => updateLine(l.id, { qty: Number(e.target.value) })} className="h-8 text-xs" />
                      )}
                    </Field>
                    <Field label="Rate" small>
                      {lm === "rate" || lm === "qty_rate" ? (
                        <div className="flex h-8 items-center rounded-md border border-input bg-secondary px-2 text-xs font-medium text-muted-foreground">Lumpsum</div>
                      ) : lm === "amount_only" ? (
                        <div className="h-8 rounded-md border border-input bg-secondary" aria-hidden />
                      ) : (
                        <Input type="number" value={l.rate || ""} placeholder="0" onChange={(e) => updateLine(l.id, { rate: Number(e.target.value) })} className="h-8 text-xs" />
                      )}
                    </Field>
                    <Field label="Specific" small><Input value={l.specific ?? ""} onChange={(e) => updateLine(l.id, { specific: e.target.value })} className="h-8 text-xs" /></Field>
                    <Field label="Amount" small>
                      {lm === "amount" ? (
                        <div className="flex h-8 items-center rounded-md border border-input bg-secondary px-2 text-xs font-medium text-muted-foreground">Lumpsum</div>
                      ) : lm === "rate" || lm === "qty_rate" ? (
                        <Input type="number" value={l.rate || ""} placeholder="0" onChange={(e) => updateLine(l.id, { rate: Number(e.target.value) })} className="h-8 text-right text-xs" />
                      ) : (
                        <Input
                          type="number"
                          value={billLineAmount(l) || ""}
                          placeholder="0"
                          title="Type an amount to bill this line as a lump sum"
                          onChange={(e) =>
                            updateLine(l.id, { rate: Number(e.target.value), lumpsumMode: "amount_only" })
                          }
                          className="h-8 text-right text-xs"
                        />
                      )}
                    </Field>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <label htmlFor={`blm-${l.id}`}>Lumpsum</label>
                    <Select
                      id={`blm-${l.id}`}
                      value={lm}
                      onChange={(e) => updateLine(l.id, { lumpsumMode: e.target.value as LumpsumMode })}
                      className="h-7 w-auto py-0 text-xs"
                    >
                      <option value="none">No — Qty × Rate</option>
                      <option value="qty">In Qty — enter Rate</option>
                      <option value="qty_rate">In Qty + Rate — enter Amount</option>
                      <option value="amount_only">Amount only — Qty &amp; Rate blank</option>
                      <option value="rate">In Rate — enter Amount</option>
                      <option value="amount">In Amount — enter Rate</option>
                    </Select>
                  </div>
                </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Tax</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Field label="GST Type">
                <Select value={s.taxMode} onChange={(e) => set("taxMode", e.target.value as BillState["taxMode"])}>
                  <option value="intra">CGST + SGST (within Delhi)</option>
                  <option value="inter">IGST (inter-state)</option>
                </Select>
              </Field>
              <Field label="GST Rate %"><Input type="number" value={s.gstRate} onChange={(e) => set("gstRate", Number(e.target.value))} /></Field>
              <Field label="Discount ₹"><Input type="number" value={s.discount} onChange={(e) => set("discount", Number(e.target.value))} /></Field>
              <Field label="Terms & Conditions" full><Textarea value={s.terms} onChange={(e) => set("terms", e.target.value)} className="min-h-[100px]" /></Field>
              <Field label="Notes" full><Textarea value={s.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
            </CardContent>
          </Card>
        </div>

        <div className="xl:sticky xl:top-20 xl:h-fit">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Live preview</p>
          <div className="overflow-auto rounded-lg border border-border bg-slate-100 p-3">
            <PurchaseBillDocument s={s} c={c} />
          </div>
        </div>
      </div>

      <div className="hidden print:block">
        <PurchaseBillDocument s={s} c={c} />
      </div>
    </div>
  );
}

function Field({ label, children, full, small }: { label: string; children: React.ReactNode; full?: boolean; small?: boolean }) {
  return (
    <div className={`space-y-1 ${full ? "col-span-2" : ""}`}>
      <Label className={small ? "text-[11px]" : ""}>{label}</Label>
      {children}
    </div>
  );
}
