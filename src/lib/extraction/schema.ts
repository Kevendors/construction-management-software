import { z } from "zod";

/**
 * Extraction target: shaped like QuoteState (src/lib/quotation/compute.ts) so
 * a successful extraction drops straight into the quotation builder as its
 * review state — no separate "extracted quote" concept to keep in sync.
 *
 * Populated entirely by local, heuristic parsing (Excel/CSV column matching,
 * PDF text-layout grouping, or OCR on scanned pages) — no external AI
 * service. Every field has a safe default so a partial/uncertain result
 * still produces a loadable quote; `lowConfidence` is how the parser tells
 * the reviewer what it wasn't sure about, by dotted path (e.g. "gstRate",
 * "lines[2].rate"). This is advisory only — the caller decides what to do
 * with it (the review banner lists it), and nothing here is ever written to
 * the database without the user reviewing and saving it first.
 */

export const ExtractedLineSchema = z.object({
  description: z.string().default(""),
  unit: z.string().default("NOS"),
  qty: z.number().default(0),
  rate: z.number().default(0),
  specific: z.string().default(""),
  // Left as "none" by the extractor — lumpsum framing is a builder concept,
  // not something a source document expresses; the reviewer applies it by
  // hand if a line turns out to need it.
  lumpsumMode: z.literal("none").default("none"),
});

export const ExtractedQuoteSchema = z.object({
  clientName: z.string().default(""),
  company: z.string().default(""),
  contact: z.string().default(""),
  email: z.string().default(""),
  address: z.string().default(""),
  siteLocation: z.string().default(""),
  clientGstin: z.string().default(""),
  quoteName: z.string().default(""),
  number: z.string().default(""),
  // ISO date (YYYY-MM-DD); empty string when the source doesn't state one —
  // the caller fills in "today" rather than guessing.
  date: z.string().default(""),
  validTill: z.string().default(""),
  taxMode: z.enum(["intra", "inter"]).default("intra"),
  gstRate: z.number().default(18),
  discount: z.number().default(0),
  additionalLabel: z.string().default(""),
  additionalCharges: z.number().default(0),
  lines: z.array(ExtractedLineSchema).default([]),
  notes: z.string().default(""),
  terms: z.string().default(""),
  /** Dotted paths the parser flagged as uncertain; empty = nothing flagged. */
  lowConfidence: z.array(z.string()).default([]),
});

export type ExtractedQuote = z.infer<typeof ExtractedQuoteSchema>;
export type ExtractedLine = z.infer<typeof ExtractedLineSchema>;

/** A quote with nothing extracted — the starting point every extractor builds on. */
export function emptyExtractedQuote(): ExtractedQuote {
  return ExtractedQuoteSchema.parse({});
}
