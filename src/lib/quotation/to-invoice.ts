import { getLumpsumMode, lineAmount, type QuoteState } from "./compute";
import { nextInvoiceNumber, type InvoiceLine, type InvoiceState } from "../invoice/compute";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Turn a saved quotation into the starting state for an invoice.
 *
 * The grand totals are designed to match. Two things make that non-obvious:
 *
 *  - A quote taxes `subtotal + additionalCharges` while an invoice taxes its
 *    subtotal alone, so additional charges become an ordinary line. That folds
 *    them into the subtotal and both the GST and the payable come out equal.
 *  - Lumpsum lines carry their figure in `rate` with no meaningful quantity, so
 *    they collapse to qty 1 × the computed amount. `lineAmount` already returns
 *    that single figure whichever column the "Lumpsum" label sits in.
 *
 * Discount, GST rate and intra/inter mode carry across unchanged, and both
 * modules apply the discount after tax the same way.
 */
export function quoteStateToInvoiceState(q: QuoteState): InvoiceState {
  const lines: InvoiceLine[] = q.lines.map((l) => {
    const lumpsum = getLumpsumMode(l) !== "none";
    return {
      id: l.id,
      // Invoices have no "Specific" column — fold that note into the text so
      // it isn't silently dropped.
      description: [l.description, l.specific?.trim()].filter(Boolean).join(" — "),
      unit: lumpsum ? "LS" : l.unit,
      qty: lumpsum ? 1 : l.qty || 0,
      rate: lumpsum ? lineAmount(l) : l.rate || 0,
    };
  });

  if (q.additionalCharges) {
    lines.push({
      id: `additional-${Date.now().toString(36)}`,
      description: q.additionalLabel?.trim() || "Additional charges",
      unit: "LS",
      qty: 1,
      rate: q.additionalCharges,
    });
  }

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
    lines,
    notes: q.notes,
    terms: q.terms,
  };
}
