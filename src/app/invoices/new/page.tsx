"use client";

import * as React from "react";
import { ArrowLeft, Plus, Printer, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select, Textarea } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InvoiceDocument } from "@/components/invoice/invoice-document";
import { computeInvoice, invoiceLineAmount, type InvoiceLine, type InvoiceState } from "@/lib/invoice/compute";
import { formatINR } from "@/lib/utils";

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 9);

const DEFAULT_INVOICE_TERMS = `1. Payment is due within 30 days of invoice date.
2. Please make all cheques/payments inclusive of applicable tax.
3. Late payments may attract interest at 1.5% per month.
4. Bill generated as per actual measurement at site.`;

const emptyState = (): InvoiceState => ({
  clientName: "",
  company: "",
  address: "",
  siteLocation: "",
  clientGstin: "",
  contact: "",
  email: "",
  number: "",
  date: today(),
  dueDate: plusDays(30),
  projectName: "",
  taxMode: "intra",
  gstRate: 18,
  discount: 0,
  lines: [],
  notes: "",
  terms: DEFAULT_INVOICE_TERMS,
});

export default function NewInvoicePage() {
  const [s, setS] = React.useState<InvoiceState>(emptyState);
  const [savedMsg, setSavedMsg] = React.useState<string | null>(null);
  const c = computeInvoice(s);

  // Load existing invoice or generate number
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stored = params.get("id");
    if (stored) {
      try {
        const raw = localStorage.getItem(`sitehub:invoice:${stored}`);
        if (raw) setS(JSON.parse(raw));
      } catch { /* ignore */ }
      return;
    }
    // Pre-fill from project if linked
    const project = params.get("project");
    if (project) {
      try {
        const raw = localStorage.getItem("sitehub:store:v1");
        if (raw) {
          const store = JSON.parse(raw);
          const proj = store.projects?.find((p: { id: string }) => p.id === project);
          if (proj) {
            setS((prev) => ({ ...prev, projectName: proj.name, siteLocation: proj.location || "" }));
          }
        }
      } catch { /* ignore */ }
    }
    setS((prev) => (prev.number ? prev : { ...prev, number: `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 900) + 100}` }));
  }, []);

  function set<K extends keyof InvoiceState>(k: K, v: InvoiceState[K]) {
    setS((prev) => ({ ...prev, [k]: v }));
  }
  function updateLine(id: string, patch: Partial<InvoiceLine>) {
    setS((prev) => ({ ...prev, lines: prev.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  }
  function removeLine(id: string) {
    setS((prev) => ({ ...prev, lines: prev.lines.filter((l) => l.id !== id) }));
  }
  function addLine() {
    setS((prev) => ({
      ...prev,
      lines: [...prev.lines, { id: uid(), description: "", unit: "LS", qty: 1, rate: 0 }],
    }));
  }

  function saveInvoice() {
    const key = `sitehub:invoice:${s.number || uid()}`;
    try {
      localStorage.setItem(key, JSON.stringify(s));
      // Also save to the invoice index for listing
      const indexRaw = localStorage.getItem("sitehub:invoices:index") || "[]";
      const index: string[] = JSON.parse(indexRaw);
      if (!index.includes(key)) {
        index.push(key);
        localStorage.setItem("sitehub:invoices:index", JSON.stringify(index));
      }
      setSavedMsg("Invoice saved");
      setTimeout(() => setSavedMsg(null), 3000);
    } catch {
      setSavedMsg("Could not save");
    }
  }

  return (
    <div className="space-y-4">
      {/* action bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/invoices" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Invoices
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {savedMsg && (
            <span className={`text-xs font-medium ${savedMsg.startsWith("Could not") ? "text-destructive" : "text-success"}`}>
              {savedMsg}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={saveInvoice}>
            <Save /> Save
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer /> Print / PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 print:hidden xl:grid-cols-2">
        {/* editor */}
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
            <CardHeader><CardTitle className="text-base">Invoice Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Field label="Project Name" full><Input value={s.projectName} onChange={(e) => set("projectName", e.target.value)} placeholder="e.g. Interior Renovation - Block A" /></Field>
              <Field label="Invoice Number"><Input value={s.number} onChange={(e) => set("number", e.target.value)} /></Field>
              <Field label="Date"><Input type="date" value={s.date} onChange={(e) => set("date", e.target.value)} /></Field>
              <Field label="Due Date"><Input type="date" value={s.dueDate} onChange={(e) => set("dueDate", e.target.value)} /></Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Line Items</CardTitle>
              <Button size="sm" variant="outline" onClick={addLine}><Plus /> Add Item</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {s.lines.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No items yet — click &quot;Add Item&quot;.</p>}
              {s.lines.map((l, i) => (
                <div key={l.id} className="rounded-lg border border-border p-3">
                  <div className="mb-2 flex items-start gap-2">
                    <span className="mt-2 text-xs font-medium text-muted-foreground">{i + 1}.</span>
                    <Input value={l.description} onChange={(e) => updateLine(l.id, { description: e.target.value })} placeholder="Item / service description" className="flex-1" />
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeLine(l.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <Field label="Unit" small>
                      <Select value={l.unit} onChange={(e) => updateLine(l.id, { unit: e.target.value })} className="h-8 text-xs">
                        {["SQFT", "SQM", "RFT", "RMT", "CUM", "KG", "MT", "NOS", "LS"].map((u) => <option key={u} value={u}>{u}</option>)}
                      </Select>
                    </Field>
                    <Field label="Qty" small><Input type="number" value={l.qty} onChange={(e) => updateLine(l.id, { qty: Number(e.target.value) })} className="h-8 text-xs" /></Field>
                    <Field label="Rate" small><Input type="number" value={l.rate} onChange={(e) => updateLine(l.id, { rate: Number(e.target.value) })} className="h-8 text-xs" /></Field>
                    <Field label="Amount" small>
                      <div className="flex h-8 items-center justify-end rounded-md bg-secondary px-2 text-xs font-medium tabular-nums">{formatINR(invoiceLineAmount(l))}</div>
                    </Field>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Charges &amp; Tax</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Field label="GST Type">
                <Select value={s.taxMode} onChange={(e) => set("taxMode", e.target.value as InvoiceState["taxMode"])}>
                  <option value="intra">CGST + SGST (within Delhi)</option>
                  <option value="inter">IGST (inter-state)</option>
                </Select>
              </Field>
              <Field label="GST Rate %"><Input type="number" value={s.gstRate} onChange={(e) => set("gstRate", Number(e.target.value))} /></Field>
              <Field label="Discount"><Input type="number" value={s.discount} onChange={(e) => set("discount", Number(e.target.value))} /></Field>
              <div />
              <Field label="Terms & Conditions" full><Textarea value={s.terms} onChange={(e) => set("terms", e.target.value)} className="min-h-[100px]" /></Field>
              <Field label="Notes" full><Textarea value={s.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
            </CardContent>
          </Card>
        </div>

        {/* live preview */}
        <div className="xl:sticky xl:top-20 xl:h-fit">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Live preview</p>
          <div className="overflow-auto rounded-lg border border-border bg-slate-100 p-3">
            <InvoiceDocument s={s} c={c} />
          </div>
        </div>
      </div>

      {/* print target */}
      <div className="hidden print:block">
        <InvoiceDocument s={s} c={c} />
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
