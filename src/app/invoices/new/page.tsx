"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Printer, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select, Textarea } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InvoiceDocument } from "@/components/invoice/invoice-document";
import { computeInvoice, getLumpsumMode, invoiceLineAmount, nextInvoiceNumber, type InvoiceLine, type InvoiceState, type LumpsumMode } from "@/lib/invoice/compute";
import { ITEM_CATEGORIES, ITEM_MASTER } from "@/lib/quotation/item-master";
import { DEFAULT_SIGNATURE } from "@/lib/quotation/company";
import { fileToResizedDataUrl } from "@/lib/image";
import { linkQuotationToInvoiceAction } from "@/app/quotations/actions";
import { saveInvoiceAction, getInvoicePayloadAction } from "../actions";
import { formatINR, todayISO } from "@/lib/utils";
import { toggleBoldInTextarea } from "@/lib/quotation/rich-text";

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
  const router = useRouter();
  const [s, setS] = React.useState<InvoiceState>(emptyState);
  const [invoiceId, setInvoiceId] = React.useState<string | null>(null);
  // Quotation this invoice came from, so it can be stamped once saved and stop
  // offering "Convert to Invoice". A ref: nothing renders from it.
  const sourceQuotationId = React.useRef<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [savedMsg, setSavedMsg] = React.useState<string | null>(null);
  const [pick, setPick] = React.useState("");

  // Line ids ticked for a bulk lumpsum change. Held by id, not index, so
  // adding or removing a line can't shift the selection onto the wrong row.
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
  const c = computeInvoice(s);

  React.useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) {
      setInvoiceId(id);
      getInvoicePayloadAction(id).then((payload) => {
        if (payload) setS(payload);
      });
      return;
    }
    // Handed over by "Convert to Invoice" on a quotation. Consumed once, then
    // cleared, exactly like the New Project prefill.
    try {
      const raw = localStorage.getItem("sitehub:newInvoicePrefill");
      if (raw) {
        localStorage.removeItem("sitehub:newInvoicePrefill");
        const pre = JSON.parse(raw) as { state: Partial<InvoiceState>; quotationId?: string };
        sourceQuotationId.current = pre.quotationId ?? null;
        // Merged, not replaced: a quotation hands over a complete state, while
        // "Add Invoice" on a project sends only the client/project fields and
        // relies on these defaults for terms, GST mode and due date.
        setS((prev) => ({ ...prev, ...pre.state }));
        return;
      }
    } catch {
      /* ignore malformed/unavailable storage and fall through to a blank invoice */
    }
    setS((prev) => (prev.number ? prev : { ...prev, number: nextInvoiceNumber() }));
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
      lines: [...prev.lines, { id: uid(), description: "", unit: "LS", qty: 1, rate: 0, lumpsumMode: "none" }],
    }));
  }

  /** Same item master the quotation builder uses — one catalogue for both. */
  function addFromMaster(itemId: string) {
    const m = ITEM_MASTER.find((i) => i.id === itemId);
    if (!m) return;
    setS((prev) => ({
      ...prev,
      lines: [
        ...prev.lines,
        {
          id: uid(),
          itemId: m.id,
          description: m.description,
          unit: m.unit,
          usesSqft: m.usesSqft,
          qty: 1,
          sqft: m.usesSqft ? 100 : 1,
          rate: 0,
          specific: "",
          lumpsumMode: m.unit === "LUMPSUM" ? "rate" : "none",
        },
      ],
    }));
    setPick("");
  }

  const sigRef = React.useRef<HTMLInputElement>(null);
  async function handleSignature(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    try {
      set("signatureUrl", await fileToResizedDataUrl(file, 600, 0.9));
    } catch {
      /* ignore decode errors */
    } finally {
      if (sigRef.current) sigRef.current.value = "";
    }
  }

  async function saveInvoice() {
    setSaving(true);
    setSavedMsg(null);
    try {
      const res = await saveInvoiceAction(s, invoiceId);
      if (res.error) setSavedMsg(`Could not save: ${res.error}`);
      else {
        setSavedMsg("Saved to database ✓");
        if (res.id && res.id !== invoiceId) {
          setInvoiceId(res.id);
          window.history.replaceState(null, "", `/invoices/new?id=${res.id}`);
          // Stamp the source quotation once, on the first save. Best-effort:
          // the invoice exists either way, so a failure here isn't fatal.
          if (sourceQuotationId.current) {
            await linkQuotationToInvoiceAction(sourceQuotationId.current, res.id);
            sourceQuotationId.current = null;
          }
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
        <Link href="/invoices" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Invoices
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {savedMsg && (
            <span className={`text-xs font-medium ${savedMsg.startsWith("Could not") ? "text-destructive" : "text-success"}`}>
              {savedMsg}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={saveInvoice} disabled={saving}>
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
            <CardHeader><CardTitle className="text-base">Client Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Field label="Client Name"><Input value={s.clientName} onChange={(e) => set("clientName", e.target.value)} /></Field>
              <Field label="Company Name"><Input value={s.company} onChange={(e) => set("company", e.target.value)} /></Field>
              <Field label="Contact Number"><Input value={s.contact} onChange={(e) => set("contact", e.target.value)} /></Field>
              <Field label="Email"><Input value={s.email} onChange={(e) => set("email", e.target.value)} /></Field>
              <Field label="Address" full><Input value={s.address} onChange={(e) => set("address", e.target.value)} /></Field>
              <Field label="Site Location"><Input value={s.siteLocation} onChange={(e) => set("siteLocation", e.target.value)} /></Field>
              <Field label="Client GSTIN"><Input value={s.clientGstin} onChange={(e) => set("clientGstin", e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" maxLength={15} /></Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Invoice Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Field label="Project Name" full><Input value={s.projectName} onChange={(e) => set("projectName", e.target.value)} placeholder="e.g. Interior Renovation - Block A" /></Field>
              <Field label="Invoice Number"><Input value={s.number} onChange={(e) => set("number", e.target.value)} /></Field>
              <Field label="Date"><Input type="date" value={s.date} max={todayISO()} onChange={(e) => set("date", e.target.value)} /></Field>
              <Field label="Due Date"><Input type="date" value={s.dueDate} min={s.date} onChange={(e) => set("dueDate", e.target.value)} /></Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Line Items</CardTitle>
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
                <Button size="sm" variant="outline" onClick={addLine}><Plus /> Custom</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {s.lines.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No items yet — add from the master list.</p>}
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
                  <span className="text-muted-foreground">
                    {selected.size} selected
                  </span>
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
                        // Ctrl/Cmd+B wraps the selection in ** **, the same
                        // markup the document renders bold.
                        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
                          const next = toggleBoldInTextarea(e.currentTarget);
                          if (next !== null) {
                            e.preventDefault();
                            updateLine(l.id, { description: next });
                          }
                        }
                      }}
                      placeholder="Item / service description"
                      className="min-h-[48px] flex-1"
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeLine(l.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    <Field label="Unit" small>
                      <Select value={l.unit} onChange={(e) => updateLine(l.id, { unit: e.target.value })} className="h-8 text-xs">
                        {["SQFT", "SQM", "RFT", "RMT", "FEET", "CUM", "KG", "MT", "BAG", "NOS", "POINT", "LS"].map((u) => <option key={u} value={u}>{u}</option>)}
                      </Select>
                    </Field>
                    <Field label="Qty" small>
                      {lm === "qty" ? (
                        <div className="flex h-8 items-center rounded-md border border-input bg-secondary px-2 text-xs font-medium text-muted-foreground">Lumpsum</div>
                      ) : (
                        <Input type="number" value={l.qty} onChange={(e) => updateLine(l.id, { qty: Number(e.target.value) })} className="h-8 text-xs" />
                      )}
                    </Field>
                    <Field label="Rate" small>
                      {lm === "rate" ? (
                        <div className="flex h-8 items-center rounded-md border border-input bg-secondary px-2 text-xs font-medium text-muted-foreground">Lumpsum</div>
                      ) : (
                        <Input type="number" value={l.rate} onChange={(e) => updateLine(l.id, { rate: Number(e.target.value) })} className="h-8 text-xs" />
                      )}
                    </Field>
                    <Field label="Specific" small><Input value={l.specific ?? ""} onChange={(e) => updateLine(l.id, { specific: e.target.value })} className="h-8 text-xs" /></Field>
                    <Field label="Amount" small>
                      {lm === "amount" ? (
                        <div className="flex h-8 items-center rounded-md border border-input bg-secondary px-2 text-xs font-medium text-muted-foreground">Lumpsum</div>
                      ) : lm === "rate" ? (
                        <Input type="number" value={l.rate || ""} placeholder="0" onChange={(e) => updateLine(l.id, { rate: Number(e.target.value) })} className="h-8 text-right text-xs" />
                      ) : (
                        <div className="flex h-8 items-center justify-end rounded-md bg-secondary px-2 text-xs font-medium tabular-nums">{formatINR(invoiceLineAmount(l))}</div>
                      )}
                    </Field>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <label htmlFor={`ilm-${l.id}`}>Lumpsum</label>
                    <Select
                      id={`ilm-${l.id}`}
                      value={lm}
                      onChange={(e) => updateLine(l.id, { lumpsumMode: e.target.value as LumpsumMode })}
                      className="h-7 w-auto py-0 text-xs"
                    >
                      <option value="none">No — Qty × Rate</option>
                      <option value="qty">In Qty — enter Rate</option>
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
            <CardHeader><CardTitle className="text-base">Charges &amp; Tax</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Field label="GST Type">
                <Select value={s.taxMode} onChange={(e) => set("taxMode", e.target.value as InvoiceState["taxMode"])}>
                  <option value="intra">CGST + SGST (within Delhi)</option>
                  <option value="inter">IGST (inter-state)</option>
                </Select>
              </Field>
              <Field label="GST Rate %"><Input type="number" value={s.gstRate} onChange={(e) => set("gstRate", Number(e.target.value))} /></Field>
              <Field label="Discount ₹"><Input type="number" value={s.discount} onChange={(e) => set("discount", Number(e.target.value))} /></Field>
              <Field label="Additional Charge ₹"><Input type="number" value={s.additionalCharges ?? 0} onChange={(e) => set("additionalCharges", Number(e.target.value))} /></Field>
              <Field label="Additional Charge Label" full><Input value={s.additionalLabel ?? ""} onChange={(e) => set("additionalLabel", e.target.value)} /></Field>
              <Field label="Terms & Conditions" full><Textarea value={s.terms} onChange={(e) => set("terms", e.target.value)} className="min-h-[100px]" /></Field>
              <Field label="Notes" full><Textarea value={s.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Business Signature</CardTitle></CardHeader>
            <CardContent>
              <input ref={sigRef} type="file" accept="image/*" className="hidden" onChange={handleSignature} />
              <div className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.signatureUrl || DEFAULT_SIGNATURE} alt="Business signature" className="h-24 w-auto rounded border border-border bg-white object-contain px-2" />
                <div className="flex flex-col gap-2">
                  <span className="text-xs text-muted-foreground">
                    {s.signatureUrl ? "Custom signature" : "Default Keyvendors signature"}
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => sigRef.current?.click()}>Replace</Button>
                    {s.signatureUrl && (
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => set("signatureUrl", "")}>Use default</Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="xl:sticky xl:top-20 xl:h-fit">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Live preview</p>
          <div className="overflow-auto rounded-lg border border-border bg-slate-100 p-3">
            <InvoiceDocument s={s} c={c} />
          </div>
        </div>
      </div>

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
