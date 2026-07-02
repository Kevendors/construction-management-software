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

export function computeInvoice(s: InvoiceState): ComputedInvoice {
  const lines: ComputedInvoiceLine[] = s.lines.map((l) => ({
    ...l,
    amount: invoiceLineAmount(l),
  }));
  const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
  const discount = s.discount || 0;
  const finalAmount = Math.max(0, subtotal - discount);
  const payableGst = (finalAmount * (s.gstRate || 0)) / 100;
  const isIntra = s.taxMode === "intra";
  return {
    lines,
    subtotal,
    discount,
    finalAmount,
    gstRate: s.gstRate || 0,
    cgst: isIntra ? payableGst / 2 : 0,
    sgst: isIntra ? payableGst / 2 : 0,
    igst: isIntra ? 0 : payableGst,
    payableGst,
    grandTotal: finalAmount + payableGst,
    words: amountInWords(finalAmount + payableGst),
  };
}
