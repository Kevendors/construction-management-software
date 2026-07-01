import type { QuoteUnit } from "./item-master";
import { amountInWords } from "./amount-in-words";

/** Where the "Lumpsum" label is shown; the other field holds the figure. */
export type LumpsumMode = "none" | "rate" | "amount";

export interface QuoteLine {
  id: string;
  itemId: string | null;
  description: string;
  unit: QuoteUnit;
  usesSqft: boolean;
  rate: number; // per-unit rate, or (in either lumpsum mode) the lump-sum figure
  qty: number;
  sqft: number; // area multiplier; 1 when not applicable
  specific: string; // free-text note shown in the "Specific" column
  lumpsumMode: LumpsumMode;
}

type LumpsumLike = { lumpsumMode?: LumpsumMode; lumpsum?: boolean; unit: QuoteUnit };

/** Resolve a line's lumpsum mode, tolerating legacy payloads. */
export function getLumpsumMode(l: LumpsumLike): LumpsumMode {
  if (l.lumpsumMode && l.lumpsumMode !== "none") return l.lumpsumMode;
  if (l.lumpsum || l.unit === "LUMPSUM") return "rate"; // legacy flag / unit
  return "none";
}

/** True when the line is priced as a lump sum (either mode). */
export function isLumpsum(l: LumpsumLike): boolean {
  return getLumpsumMode(l) !== "none";
}

export type TaxMode = "intra" | "inter"; // intra = CGST+SGST, inter = IGST

export interface QuoteState {
  // A. Client details
  clientName: string;
  company: string;
  contact: string;
  email: string;
  address: string;
  siteLocation: string;
  clientGstin: string;
  // B. Quotation details
  quoteName: string;
  number: string;
  date: string;
  validTill: string;
  // C/D. Tax & charges
  taxMode: TaxMode;
  gstRate: number; // total %, e.g. 18
  discount: number;
  additionalLabel: string;
  additionalCharges: number;
  // Lines
  lines: QuoteLine[];
  // Notes / T&C
  notes: string;
  terms: string;
  // Uploaded business signature (image data URL); empty = none
  signatureUrl: string;
}

export interface ComputedLine extends QuoteLine {
  amount: number;
}

export interface ComputedQuote {
  lines: ComputedLine[];
  subtotal: number;
  discount: number;
  additionalCharges: number;
  finalAmount: number; // taxable base = subtotal - discount + additional
  gstRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  payableGst: number;
  grandTotal: number;
  words: string;
}

/** Amount = Quantity × Rate, or just Rate for lump-sum lines. */
export function lineAmount(l: QuoteLine): number {
  if (isLumpsum(l)) return l.rate || 0;
  return (l.rate || 0) * (l.qty || 0);
}

export function computeQuote(s: QuoteState): ComputedQuote {
  const lines: ComputedLine[] = s.lines.map((l) => ({ ...l, amount: lineAmount(l) }));
  const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
  const discount = s.discount || 0;
  const additionalCharges = s.additionalCharges || 0;
  const finalAmount = Math.max(0, subtotal - discount + additionalCharges);
  const payableGst = (finalAmount * (s.gstRate || 0)) / 100;
  const isIntra = s.taxMode === "intra";
  return {
    lines,
    subtotal,
    discount,
    additionalCharges,
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
