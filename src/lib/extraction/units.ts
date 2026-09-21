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

// \\b and \\. (not \b / \.) — inside a template literal, an unescaped
// backslash-letter sequence is a JS string escape (\b is a real backspace
// character, \. is just "."), not a regex metacharacter; it has to survive
// as the literal two-character sequence for RegExp to see a word boundary /
// escaped dot. Getting this wrong doesn't throw — it silently builds a
// pattern that matches nothing, which is exactly what happened here.
const UNIT_PATTERN = new RegExp(
  `\\b(${KNOWN_UNITS.map((u) => u.replace(/\./g, "\\.")).join("|")})\\b`,
  "i"
);

/** True when `text` contains a recognisable unit token as a whole word. */
export function containsUnit(text: string): boolean {
  return UNIT_PATTERN.test(text);
}

/**
 * The first recognised unit token in `text`, exactly as matched (only
 * case-normalised to uppercase) — e.g. "Sq.ft" comes back as "SQ.FT", not
 * the builder's canonical "SQFT". Kept literal (not canonicalised) because
 * callers that strip the unit out of a description need to match the exact
 * source text; see normalizeUnit for the builder-facing form.
 */
export function findUnit(text: string): string | null {
  const m = UNIT_PATTERN.exec(text);
  return m ? m[1].toUpperCase() : null;
}

/**
 * Maps every recognised synonym to the single spelling the builder's Unit
 * dropdown (QuoteUnit in item-master.ts) actually offers as an <option> —
 * without this, a matched-but-unmapped synonym like "SQ.FT" is real,
 * correct data that the dropdown still can't display as selected, which
 * looks identical to extraction having failed.
 */
const CANONICAL_UNIT: Record<string, string> = {
  "SQ.FT": "SQFT", "SQ FT": "SQFT",
  "SQ.M": "SQM", "SQ M": "SQM",
  "R.FT": "RFT",
  "R.MT": "RMT",
  FT: "FEET",
  "CU.M": "CUM",
  KGS: "KG",
  TON: "MT", TONNE: "MT",
  BAGS: "BAG",
  NO: "NOS", "NO.": "NOS", PCS: "NOS", PC: "NOS", EACH: "NOS", EA: "NOS",
  POINTS: "POINT",
  "L.S": "LUMPSUM", LS: "LUMPSUM", "LUMP SUM": "LUMPSUM",
  MTR: "RMT", METER: "RMT", METRE: "RMT",
  // SET/SETS, JOB, LOT, HR/HRS/HOUR/HOURS, DAY/DAYS have no dropdown
  // equivalent — left as their own matched text, same as any unrecognised
  // unit (QuoteLine.unit is a plain string at runtime).
};

/** `findUnit`'s match, mapped to the builder dropdown's canonical spelling when one exists. */
export function normalizeUnit(matched: string): string {
  return CANONICAL_UNIT[matched] ?? matched;
}
