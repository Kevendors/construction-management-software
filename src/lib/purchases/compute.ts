import { amountInWords } from "../quotation/amount-in-words";
import { getLumpsumMode, isLumpsum, type LumpsumMode } from "../quotation/compute";
import type { Project, PurchaseOrder, Supplier } from "@/lib/types";

export type { LumpsumMode };

export interface BillLine {
  id: string;
  description: string;
  unit: string;
  qty: number;
  rate: number;
  materialItemId?: string | null;
  /** Free-text note; shown in the document's "Specific" column. */
  specific?: string;
  lumpsumMode?: LumpsumMode;
}

export type TaxMode = "intra" | "inter";

export interface BillState {
  // Supplier
  supplierName: string;
  company: string;
  address: string;
  supplierGstin: string;
  contact: string;
  email: string;
  // Bill details
  number: string;
  date: string;
  dueDate: string;
  projectName: string;
  sourcePoId: string | null;
  // Tax
  taxMode: TaxMode;
  gstRate: number;
  discount: number;
  // Lines
  lines: BillLine[];
  // Notes
  notes: string;
  terms: string;
}

export interface ComputedBillLine extends BillLine {
  amount: number;
}

export interface ComputedBill {
  lines: ComputedBillLine[];
  subtotal: number;
  discount: number;
  finalAmount: number;
  gstRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  payableGst: number;
  grandTotal: number;
  words: string;
}

/** PB-<year>-<base36 tail of the clock>, parallel to INV-/PI-. */
export function nextBillNumber(): string {
  return `PB-${new Date().getFullYear()}-${Date.now().toString(36).slice(-5).toUpperCase()}`;
}

/** Amount = Quantity × Rate, or just Rate for lump-sum lines. */
export function billLineAmount(l: BillLine): number {
  if (isLumpsum(l)) return l.rate || 0;
  return (l.rate || 0) * (l.qty || 0);
}

export { getLumpsumMode, isLumpsum };

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeBill(s: BillState): ComputedBill {
  const lines: ComputedBillLine[] = s.lines.map((l) => ({ ...l, amount: round2(billLineAmount(l)) }));
  const subtotal = round2(lines.reduce((sum, l) => sum + l.amount, 0));
  const discount = round2(Math.min(s.discount || 0, subtotal));
  const payableGst = round2((subtotal * (s.gstRate || 0)) / 100);
  const isIntra = s.taxMode === "intra";
  const finalAmount = round2(Math.max(0, subtotal - discount));
  const grandTotal = round2(finalAmount + payableGst);
  return {
    lines,
    subtotal,
    discount,
    finalAmount,
    gstRate: s.gstRate || 0,
    cgst: round2(isIntra ? payableGst / 2 : 0),
    sgst: round2(isIntra ? payableGst / 2 : 0),
    igst: round2(isIntra ? 0 : payableGst),
    payableGst,
    grandTotal,
    words: grandTotal > 0 ? amountInWords(grandTotal) : "Zero",
  };
}

/**
 * Carries a Purchase Order's supplier/project/items across into a fresh Bill
 * draft — the "Convert to Bill" handoff, same pattern as
 * quoteStateToInvoiceState. Nothing is written to the database here; the
 * caller hands this to the builder as a prefill, same as every other
 * conversion in this app.
 */
export function poToBillState(po: PurchaseOrder, supplier: Supplier | null, project: Project | null): BillState {
  return {
    supplierName: supplier?.name ?? "",
    company: supplier?.company ?? "",
    address: supplier?.address ?? "",
    supplierGstin: supplier?.gst ?? "",
    contact: supplier?.phone ?? "",
    email: supplier?.email ?? "",
    number: nextBillNumber(),
    date: new Date().toISOString().slice(0, 10),
    dueDate: "",
    projectName: project?.name ?? "",
    sourcePoId: po.id,
    taxMode: "intra",
    gstRate: po.taxRate || 18,
    discount: po.discount || 0,
    lines: po.items.map((it) => ({
      id: `b${it.id}`,
      description: it.description,
      unit: it.unit,
      qty: it.qty,
      rate: it.rate,
      materialItemId: it.materialItemId,
      specific: "",
      lumpsumMode: "none" as const,
    })),
    notes: "",
    terms: po.terms || "",
  };
}
