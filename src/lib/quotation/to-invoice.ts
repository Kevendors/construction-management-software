import { type QuoteState } from "./compute";
import { nextInvoiceNumber, type InvoiceLine, type InvoiceState } from "../invoice/compute";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Turn a saved quotation into the starting state for an invoice.
 *
 * Now that InvoiceLine/InvoiceState mirror their quotation counterparts —
 * lumpsum modes, the "Specific" note, additional charges — this is a
 * near-straight copy, and computeInvoice applies tax exactly as computeQuote
 * does, so the grand totals match without any reshaping.
 */
export function quoteStateToInvoiceState(q: QuoteState): InvoiceState {
  const lines: InvoiceLine[] = q.lines.map((l) => ({
    id: l.id,
    itemId: l.itemId,
    description: l.description,
    unit: l.unit,
    usesSqft: l.usesSqft,
    sqft: l.sqft,
    qty: l.qty || 0,
    rate: l.rate || 0,
    specific: l.specific,
    lumpsumMode: l.lumpsumMode,
  }));

  return {
    clientName: q.clientName,
    company: q.company,
    address: q.address,
    siteLocation: q.siteLocation,
    clientGstin: q.clientGstin,
    contact: q.contact,
    email: q.email,
    // A fresh invoice number — reusing the quotation's would collide with it.
    number: nextInvoiceNumber(),
    date: iso(new Date()),
    dueDate: iso(new Date(Date.now() + 30 * 86400000)),
    projectName: q.quoteName,
    taxMode: q.taxMode,
    gstRate: q.gstRate,
    discount: q.discount,
    additionalLabel: q.additionalLabel,
    additionalCharges: q.additionalCharges,
    lines,
    notes: q.notes,
    terms: q.terms,
    signatureUrl: q.signatureUrl,
  };
}
