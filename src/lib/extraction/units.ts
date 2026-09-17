/**
 * Unit tokens recognised while scanning free-form text (PDF/OCR lines) for a
 * line item's unit column. Mirrors the quote builder's own unit list
 * (src/lib/quotation/item-master.ts QuoteUnit) plus a few extra synonyms
 * that show up in externally-prepared quotations but aren't offered in the
 * builder's own dropdown — those still get carried through as free text
 * (QuoteLine.unit is a plain string at runtime), just not recognised as a
 * unit boundary by the line-splitting heuristic below.
 */
export const KNOWN_UNITS = [
  "SQFT", "SQ.FT", "SQ FT",
  "SQM", "SQ.M", "SQ M",
  "RFT", "R.FT",
  "RMT", "R.MT",
  "FEET", "FT",
  "CUM", "CU.M",
  "KG", "KGS",
  "MT", "TON", "TONNE",
  "BAG", "BAGS",
  "NOS", "NO", "NO.", "PCS", "PC", "EACH", "EA",
  "POINT", "POINTS",
  "SET", "SETS",
  "JOB", "LOT",
  "LS", "L.S", "LUMPSUM", "LUMP SUM",
  "MTR", "METER", "METRE",
  "HR", "HRS", "HOUR", "HOURS",
  "DAY", "DAYS",
];

const UNIT_PATTERN = new RegExp(
  `\b(${KNOWN_UNITS.map((u) => u.replace(/\./g, "\.")).join("|")})\b`,
  "i"
);

/** True when `text` contains a recognisable unit token as a whole word. */
export function containsUnit(text: string): boolean {
  return UNIT_PATTERN.test(text);
}

/** The first recognised unit token in `text`, normalised to uppercase, or null. */
export function findUnit(text: string): string | null {
  const m = UNIT_PATTERN.exec(text);
  return m ? m[1].toUpperCase() : null;
}
