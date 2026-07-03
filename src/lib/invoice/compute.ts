import { amountInWords } from "../quotation/amount-in-words";

export interface InvoiceLine {
  id: string;
  description: string;
  unit: string;
  qty: number;
  rate: number;
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
  // Lines
  lines: InvoiceLine[];
  // Notes
  notes: string;
  terms: string;
}

export interface ComputedInvoiceLine extends InvoiceLine {
  amount: number;
}

export interface ComputedInvoice {
  lines: ComputedInvoiceLine[];
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

export function invoiceLineAmount(l: InvoiceLine): number {
  return (l.rate || 0) * (l.qty || 0);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeInvoice(s: InvoiceState): ComputedInvoice {
  const lines: ComputedInvoiceLine[] = s.lines.map((l) => ({
    ...l,
    amount: round2(invoiceLineAmount(l)),
  }));
  const subtotal = round2(lines.reduce((sum, l) => sum + l.amount, 0));
  const discount = round2(Math.min(s.discount || 0, subtotal));
  // GST is computed on the full subtotal per Indian GST law; discount is applied separately
  const payableGst = round2((subtotal * (s.gstRate || 0)) / 100);
  const isIntra = s.taxMode === "intra";
  const finalAmount = round2(subtotal - discount);
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
