"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Printer, Save, Trash2, ArrowRightLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select, Textarea } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuotationDocument } from "@/components/quotation/quotation-document";
import { ITEM_CATEGORIES, ITEM_MASTER } from "@/lib/quotation/item-master";
import { computeQuote, lineAmount, type QuoteLine, type QuoteState } from "@/lib/quotation/compute";
import { DEFAULT_TERMS } from "@/lib/quotation/company";
import { saveQuotationAction, getQuotationPayloadAction } from "../actions";
import { formatINR } from "@/lib/utils";

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 9);

const emptyState = (): QuoteState => ({
  clientName: "",
  company: "",
  contact: "",
  email: "",
  address: "",
  siteLocation: "",
  clientGstin: "",
  quoteName: "",
  number: "",
  date: today(),
  validTill: plusDays(15),
  taxMode: "intra",
  gstRate: 18,
  discount: 0,
  additionalLabel: "Additional Charges",
  additionalCharges: 0,
  lines: [],
  notes: "",
  terms: DEFAULT_TERMS,
});

export default function NewQuotationPage() {
  const router = useRouter();
  const [s, setS] = React.useState<QuoteState>(emptyState);
  const [pick, setPick] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [savedMsg, setSavedMsg] = React.useState<string | null>(null);
  const c = computeQuote(s);

  // Load an existing quote when opened with ?id=, else generate a number.
  React.useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) {
      getQuotationPayloadAction(id).then((payload) => {
        if (payload) setS(payload);
      });
      return;
    }
    setS((prev) => (prev.number ? prev : { ...prev, number: `KV-${Math.floor(Math.random() * 900) + 100}` }));
  }, []);

  function set<K extends keyof QuoteState>(k: K, v: QuoteState[K]) {
    setS((prev) => ({ ...prev, [k]: v }));
  }
  function updateLine(id: string, patch: Partial<QuoteLine>) {
    setS((prev) => ({ ...prev, lines: prev.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  }
  function removeLine(id: string) {
    setS((prev) => ({ ...prev, lines: prev.lines.filter((l) => l.id !== id) }));
  }
  function addFromMaster(itemId: string) {
    const m = ITEM_MASTER.find((i) => i.id === itemId);
    if (!m) return;
    setS((prev) => ({
      ...prev,
      lines: [
        ...prev.lines,
        { id: uid(), itemId: m.id, description: m.description, unit: m.unit, usesSqft: m.usesSqft, rate: 0, qty: 1, sqft: m.usesSqft ? 100 : 1 },
      ],
    }));
    setPick("");
  }
  function addCustom() {
    setS((prev) => ({
      ...prev,
      lines: [...prev.lines, { id: uid(), itemId: null, description: "", unit: "LUMPSUM", usesSqft: false, rate: 0, qty: 1, sqft: 1 }],
    }));
  }

  async function saveDraft() {
    setSaving(true);
    setSavedMsg(null);
    try {
      const res = await saveQuotationAction(s, c.grandTotal);
      if (res.error) setSavedMsg(`Could not save: ${res.error}`);
      else setSavedMsg("Saved to database ✓");
    } catch (e) {
      setSavedMsg(`Could not save: ${e instanceof Error ? e.message : "error"}`);
    } finally {
      setSaving(false);
    }
  }

  function convertToProject() {
    const payload = {
      name: s.quoteName || s.company || s.clientName || "New Project",
      value: Math.round(c.grandTotal),
      location: s.siteLocation || s.address || "",
      clientName: s.company || s.clientName,
    };
    try {
      localStorage.setItem("sitehub:newProjectPrefill", JSON.stringify(payload));
    } catch {}
    router.push("/projects?new=1");
  }

  return (
    <div className="space-y-4">
      {/* action bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/quotations" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Quotations
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {savedMsg && (
            <span className={`text-xs font-medium ${savedMsg.startsWith("Could not") ? "text-destructive" : "text-success"}`}>
              {savedMsg}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={saveDraft} disabled={saving}>
            <Save /> {saving ? "Saving…" : "Save"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer /> Print / PDF
          </Button>
          <Button size="sm" onClick={convertToProject}>
            <ArrowRightLeft /> Convert to Project
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 print:hidden xl:grid-cols-2">
        {/* ---------------- editor ---------------- */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Client Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Field label="Client Name"><Input value={s.clientName} onChange={(e) => set("clientName", e.target.value)} /></Field>
              <Field label="Company Name"><Input value={s.company} onChange={(e) => set("company", e.target.value)} /></Field>
              <Field label="Contact Number"><Input value={s.contact} onChange={(e) => set("contact", e.target.value)} /></Field>
              <Field label="Email"><Input value={s.email} onChange={(e) => set("email", e.target.value)} /></Field>
              <Field label="Address" full><Input value={s.address} onChange={(e) => set("address", e.target.value)} /></Field>
              <Field label="Site Location"><Input value={s.siteLocation} onChange={(e) => set("siteLocation", e.target.value)} /></Field>
              <Field label="Client GSTIN"><Input value={s.clientGstin} onChange={(e) => set("clientGstin", e.target.value)} /></Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Quotation Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Field label="Quotation Name" full><Input value={s.quoteName} onChange={(e) => set("quoteName", e.target.value)} placeholder="e.g. Painting & Civil Work" /></Field>
              <Field label="Quotation Number"><Input value={s.number} onChange={(e) => set("number", e.target.value)} /></Field>
              <Field label="Date"><Input type="date" value={s.date} onChange={(e) => set("date", e.target.value)} /></Field>
              <Field label="Valid Till"><Input type="date" value={s.validTill} onChange={(e) => set("validTill", e.target.value)} /></Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Items</CardTitle>
              <div className="flex gap-2">
                <Select value={pick} onChange={(e) => addFromMaster(e.target.value)} className="h-8 w-48 text-xs">
                  <option value="">+ Add from item master…</option>
                  {ITEM_CATEGORIES.map((cat) => (
                    <optgroup key={cat} label={cat}>
                      {ITEM_MASTER.filter((i) => i.category === cat).map((i) => (
                        <option key={i.id} value={i.id}>{i.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
                <Button size="sm" variant="outline" onClick={addCustom}><Plus /> Custom</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {s.lines.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No items yet — add from the master list.</p>}
              {s.lines.map((l, i) => (
                <div key={l.id} className="rounded-lg border border-border p-3">
                  <div className="mb-2 flex items-start gap-2">
                    <span className="mt-2 text-xs font-medium text-muted-foreground">{i + 1}.</span>
                    <Textarea value={l.description} onChange={(e) => updateLine(l.id, { description: e.target.value })} placeholder="Item / service description" className="min-h-[48px] flex-1" />
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeLine(l.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    <Field label="Unit" small>
                      <Select value={l.unit} onChange={(e) => updateLine(l.id, { unit: e.target.value as QuoteLine["unit"] })} className="h-8 text-xs">
                        {["SQFT", "SQM", "RFT", "RMT", "CUM", "KG", "MT", "NOS", "POINT", "LUMPSUM"].map((u) => <option key={u} value={u}>{u}</option>)}
                      </Select>
                    </Field>
                    <Field label="Qty" small><Input type="number" value={l.qty} onChange={(e) => updateLine(l.id, { qty: Number(e.target.value) })} className="h-8 text-xs" /></Field>
                    <Field label="Sq.ft" small>
                      <Input type="number" value={l.sqft} disabled={!l.usesSqft} onChange={(e) => updateLine(l.id, { sqft: Number(e.target.value) })} className="h-8 text-xs" />
                    </Field>
                    <Field label="Rate ₹" small><Input type="number" value={l.rate} onChange={(e) => updateLine(l.id, { rate: Number(e.target.value) })} className="h-8 text-xs" /></Field>
                    <Field label="Amount" small>
                      <div className="flex h-8 items-center justify-end rounded-md bg-secondary px-2 text-xs font-medium tabular-nums">{formatINR(lineAmount(l))}</div>
                    </Field>
                  </div>
                  <label className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input type="checkbox" checked={l.usesSqft} onChange={(e) => updateLine(l.id, { usesSqft: e.target.checked, sqft: e.target.checked ? l.sqft || 100 : 1 })} />
                    Multiply by Sq.ft area
                  </label>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Charges &amp; Tax</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Field label="GST Type">
                <Select value={s.taxMode} onChange={(e) => set("taxMode", e.target.value as QuoteState["taxMode"])}>
                  <option value="intra">CGST + SGST (within Delhi)</option>
                  <option value="inter">IGST (inter-state)</option>
                </Select>
              </Field>
              <Field label="GST Rate %"><Input type="number" value={s.gstRate} onChange={(e) => set("gstRate", Number(e.target.value))} /></Field>
              <Field label="Discount ₹"><Input type="number" value={s.discount} onChange={(e) => set("discount", Number(e.target.value))} /></Field>
              <Field label="Additional Charge ₹"><Input type="number" value={s.additionalCharges} onChange={(e) => set("additionalCharges", Number(e.target.value))} /></Field>
              <Field label="Additional Charge Label" full><Input value={s.additionalLabel} onChange={(e) => set("additionalLabel", e.target.value)} /></Field>
              <Field label="Terms & Conditions" full><Textarea value={s.terms} onChange={(e) => set("terms", e.target.value)} className="min-h-[120px]" /></Field>
              <Field label="Notes" full><Textarea value={s.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
            </CardContent>
          </Card>
        </div>

        {/* ---------------- live preview ---------------- */}
        <div className="xl:sticky xl:top-20 xl:h-fit">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Live preview</p>
          <div className="overflow-auto rounded-lg border border-border bg-slate-100 p-3">
            <QuotationDocument s={s} c={c} />
          </div>
        </div>
      </div>

      {/* print target — only this prints */}
      <div className="hidden print:block">
        <QuotationDocument s={s} c={c} />
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
