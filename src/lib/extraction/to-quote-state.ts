import { DEFAULT_TERMS } from "@/lib/quotation/company";
import type { QuoteLine, QuoteState } from "@/lib/quotation/compute";
import type { ExtractedLine, ExtractedQuote } from "./schema";

const isoToday = () => new Date().toISOString().slice(0, 10);

/**
 * One extracted line -> one builder line. Shared by toQuoteState below and
 * the "Paste from Excel" dialog (paste-rows-dialog.tsx), which appends lines
 * to an already-open quotation rather than loading a whole new state.
 */
export function extractedLineToQuoteLine(l: ExtractedLine, index: number): QuoteLine {
  return {
    id: `x${index}${Math.random().toString(36).slice(2, 7)}`,
    itemId: null,
    description: l.description,
    // QuoteUnit is a closed set the builder's <select> renders as options;
    // an extracted unit outside that set (a source document can write
    // anything) still displays correctly since the field is plain text at
    // runtime — only the TS type is nominally narrower.
    unit: l.unit as QuoteLine["unit"],
    usesSqft: false,
    rate: l.rate,
    qty: l.qty,
    sqft: 1,
    specific: l.specific,
    lumpsumMode: l.lumpsumMode,
  };
}

/**
 * Fill in the fields ExtractedQuote deliberately leaves to the caller, to
 * get a state the quotation builder can load as-is. Pure and client-safe —
 * extraction itself now runs in the browser (see pdf.ts/excel.ts), so this
 * has no server-only dependency.
 */
export function toQuoteState(extracted: ExtractedQuote): QuoteState {
  return {
    clientName: extracted.clientName,
    company: extracted.company,
    contact: extracted.contact,
    email: extracted.email,
    address: extracted.address,
    siteLocation: extracted.siteLocation,
    clientGstin: extracted.clientGstin,
    quoteName: extracted.quoteName,
    number: extracted.number || `KV-${Math.floor(Math.random() * 900) + 100}`,
    date: extracted.date || isoToday(),
    validTill: extracted.validTill,
    taxMode: extracted.taxMode,
    gstRate: extracted.gstRate,
    discount: extracted.discount,
    additionalLabel: extracted.additionalLabel || "Additional Charges",
    additionalCharges: extracted.additionalCharges,
    lines: extracted.lines.map(extractedLineToQuoteLine),
    notes: extracted.notes,
    terms: extracted.terms || DEFAULT_TERMS,
    signatureUrl: "",
  };
}
