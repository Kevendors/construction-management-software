import { amountInWords } from "../quotation/amount-in-words";
import { getLumpsumMode, isLumpsum, type LumpsumMode } from "../quotation/compute";

export type { LumpsumMode };

/**
 * Mirrors QuoteLine. Everything past `rate` is optional so invoices saved
 * before these fields existed still parse — treat missing values as the
 * plain "quantity × rate" line the builder used to produce.
 */
export interface InvoiceLine {
  id: string;
  description: string;
  unit: string;
  qty: number;
  rate: number;
  itemId?: string | null;
  usesSqft?: boolean;
  sqft?: number;
  /** Free-text note; shown in the document's "Specific" column. */
  specific?: string;
  lumpsumMode?: LumpsumMode;
}

export type TaxMode = "intra" | "inter";

export interface InvoiceState {
  // Client
  clientName: string;
  company: string;
  address: string;
  siteLocation: string;
  clientGstin: string;
  contact: string;
  email: string;
  // Invoice details
  number: string;
  date: string;
  dueDate: string;
  projectName: string;
  // Tax
  taxMode: TaxMode;
  gstRate: number;
  discount: number;
  /** Optional extra charge line (freight, site prep, …). Absent on old saves. */
  additionalLabel?: string;
  additionalCharges?: number;
  // Lines
  lines: InvoiceLine[];
  // Notes
  notes: string;
  terms: string;
  /** Uploaded business signature (image data URL); empty/absent = none. */
  signatureUrl?: string;
}

export interface ComputedInvoiceLine extends InvoiceLine {
  amount: number;
}

export interface ComputedInvoice {
  lines: ComputedInvoiceLine[];
  subtotal: number;
  additionalCharges: number;
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

/** INV-<year>-<base36 tail of the clock>, shared by the builder and converters. */
export function nextInvoiceNumber(): string {
  return `INV-${new Date().getFullYear()}-${Date.now().toString(36).slice(-5).toUpperCase()}`;
}

/** Amount = Quantity × Rate, or just Rate for lump-sum lines. */
export function invoiceLineAmount(l: InvoiceLine): number {
  if (isLumpsum(l)) return l.rate || 0;
  return (l.rate || 0) * (l.qty || 0);
}

/** Re-exported so the invoice builder/document don't reach into the quote module. */
export { getLumpsumMode, isLumpsum };

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeInvoice(s: InvoiceState): ComputedInvoice {
  const lines: ComputedInvoiceLine[] = s.lines.map((l) => ({
    ...l,
    amount: round2(invoiceLineAmount(l)),
  }));
  const subtotal = round2(lines.reduce((sum, l) => sum + l.amount, 0));
  const additionalCharges = round2(s.additionalCharges || 0);
  const discount = round2(Math.min(s.discount || 0, subtotal + additionalCharges));
  // GST is computed on the full taxable supply value (before discount) per
  // Indian GST law; the discount comes off the payable separately. Same
  // treatment as computeQuote, so a converted quote totals identically.
  const taxableBase = round2(subtotal + additionalCharges);
  const payableGst = round2((taxableBase * (s.gstRate || 0)) / 100);
  const isIntra = s.taxMode === "intra";
  const finalAmount = round2(Math.max(0, subtotal - discount + additionalCharges));
  const grandTotal = round2(finalAmount + payableGst);
  return {
    lines,
    subtotal,
    additionalCharges,
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
