import { findUnit } from "./units";
import type { ExtractedLine, ExtractedQuote } from "./schema";

/**
 * Turns unstructured text (grouped PDF text lines, or raw OCR output split on
 * newlines) into quotation line items and a handful of header fields, using
 * pattern matching rather than any language understanding.
 *
 * This is a heuristic, not a parser for a known format — it reads left to
 * right the way an Indian quotation table conventionally lays out
 * "description … unit qty rate amount", and it is wrong wherever a document
 * departs from that. Every line that couldn't be split unambiguously gets
 * flagged in lowConfidence with a best guess still filled in, so a bad split
 * costs a correction in the review step rather than a silently wrong figure.
 *
 * A common layout this specifically handles: a heading plus lettered
 * sub-points spanning several lines, with the actual qty/rate only appearing
 * on the final line of the block —
 *   "PCC:
 *    a) include with waterproofing compound
 *    b) with cement neat paning
 *    Providing and laying Plain Cement Concrete… SQFT 5,500 130 7,15,000"
 * — all four lines become one item, because the description-only lines are
 * buffered forward and attached to the line that finally carries numbers
 * (see extractLinesFromText), not folded backward onto whatever came before.
 */

const STOP_MARKERS = /\b(sub\s*-?total|grand\s*total|total\s*amount|amount\s*in\s*words|terms\s*(&|and)\s*conditions|signature|bank\s*details)\b/i;
const TABLE_HEADER_MARKERS = /\b(description|particulars|s\.?\s*no\.?|qty|quantity|rate|amount)\b/i;
const GST_LINE = /\bg\.?s\.?t\.?\b.{0,15}?(\d{1,2}(?:\.\d+)?)\s*%/i;
const DISCOUNT_LINE = /\bdiscount\b.{0,15}?(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?)/i;
// A "GST 18%" / "Discount ₹5,000" line, or one already handled by
// scanGstAndDiscount above — must not also fall through to parseItemLine and
// become a fake line item (this app has no per-line GST field; see rows.ts's
// identically-motivated SUMMARY_ROW for the Excel/paste path).
const SUMMARY_LINE = /^\s*(gst|igst|cgst|sgst|tax|discount)\b/i;
// Document metadata (title, "Client: X  GSTIN: Y", "Quotation No: X  Date: Y")
// carries digit-like substrings (a GSTIN, a quote number, a date) that would
// otherwise satisfy parseItemLine's "trailing numbers" check and become a
// bogus priced item — extractHeaderFields reads these fields from the full
// text separately, so a line clearly shaped like one is dropped here instead.
const GSTIN_INLINE = /\b\d{2}[A-Z]{5}\d{4}[A-Z]\dZ[A-Z\d]\b/;
const HEADER_LABEL_LINE = /^\s*(client(\s*name)?|company|quotation\s*(no\.?|number)?|quote\s*(no\.?|number)?|ref(?:erence)?\s*(no\.?|number)?|date|valid\s*till|site\s*location)\s*[:\-]/i;

const NUMBER_TOKEN = /\d[\d,]*\.?\d*/g;
const LEADING_SERIAL = /^\s*(\d{1,3})[.)]\s+/;

function parseNumber(tok: string): number {
  return Number(tok.replace(/,/g, "")) || 0;
}

/**
 * Look for a plain "GST 18%" / "Discount 5,000" style line anywhere in a
 * block of text — shared by the PDF/OCR line walker below and the Excel
 * footer scan (excel.ts), so both read the same two patterns.
 */
export function scanGstAndDiscount(text: string): { gstRate?: number; discount?: number } {
  const gst = GST_LINE.exec(text);
  const discount = DISCOUNT_LINE.exec(text);
  return {
    gstRate: gst ? Number(gst[1]) : undefined,
    discount: discount ? parseNumber(discount[1]) : undefined,
  };
}

/** All numeric tokens in a string, in order, with their character positions. */
function numberTokens(text: string): { value: number; start: number; end: number }[] {
  const out: { value: number; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  NUMBER_TOKEN.lastIndex = 0;
  while ((m = NUMBER_TOKEN.exec(text))) {
    out.push({ value: parseNumber(m[0]), start: m.index, end: m.index + m[0].length });
  }
  return out;
}

interface LineParseResult {
  line: ExtractedLine | null;
  lowConfidencePaths: string[];
}

/** Parse one candidate item row. `lineIndex` is only used to build lowConfidence paths. */
function parseItemLine(raw: string, lineIndex: number): LineParseResult {
  const noSerial = raw.replace(LEADING_SERIAL, "");
  const unit = findUnit(noSerial);
  let numbers = numberTokens(noSerial);

  // A lone small number sitting right at the start of the line, with no unit
  // anywhere and no other figures, reads as an S.No column joined onto the
  // description ("5 PCC:") rather than a real rate — a genuine rate almost
  // never stands alone at position 0 with no unit in sight. Drop it so the
  // line falls through to the "no figures" heading/description case below.
  if (numbers.length === 1 && !unit && numbers[0].start <= 2 && numbers[0].value < 1000) {
    numbers = [];
  }

  if (numbers.length === 0) {
    // No real figures — this is either a section heading or (more often, in
    // practice) the first lines of a description block whose pricing arrives
    // on a later line, e.g. "PCC: / a) .../ b) .../ Providing and laying...
    // SQFT 5,500 130 7,15,000". The caller buffers these forward and attaches
    // them to the next line that does carry real numbers.
    return { line: null, lowConfidencePaths: [] };
  }

  // Trust the trailing numbers, not ones embedded mid-description (dimension
  // notes inside a description are the main false-positive risk) — real
  // qty/rate/amount sit at the end of the row in the layout this heuristic
  // targets.
  const tail = numbers.slice(-3);
  const path = `lines[${lineIndex}]`;
  const low: string[] = [];

  let qty: number;
  let rate: number;
  let cutFrom: number;

  if (tail.length === 3) {
    qty = tail[0].value;
    rate = tail[1].value;
    const amount = tail[2].value;
    // Sanity check, not a correction — flag if qty*rate is well off the
    // stated amount, since that means the 3-number guess likely split the
    // wrong triple (e.g. a rate that is itself comma-grouped got split).
    if (amount > 0 && Math.abs(qty * rate - amount) / amount > 0.05) low.push(`${path}.rate`, `${path}.qty`);
    cutFrom = tail[0].start;
  } else if (tail.length === 2) {
    // Ambiguous: could be (qty, rate) or (rate, amount). (qty, rate) is the
    // more common two-number layout, so that is the guess — always flagged.
    qty = tail[0].value;
    rate = tail[1].value;
    low.push(`${path}.qty`, `${path}.rate`);
    cutFrom = tail[0].start;
  } else {
    // Single figure — read as a flat rate (qty defaults to 1), the shape an
    // externally-authored "just a total" row usually takes.
    qty = 1;
    rate = tail[0].value;
    low.push(`${path}.rate`);
    cutFrom = tail[0].start;
  }

  let description = noSerial.slice(0, cutFrom).trim();
  if (unit) {
    // Drop the unit token from the description if it's the last word before
    // the numbers (the common placement); leave it otherwise rather than
    // risk cutting real description text.
    const beforeNumbers = description;
    const stripped = beforeNumbers.replace(new RegExp(`\\b${unit}\\b\\.?\\s*$`, "i"), "").trim();
    if (stripped.length < beforeNumbers.length) description = stripped;
  }
  if (!description) {
    description = noSerial.slice(0, cutFrom).trim() || "(description not captured)";
    low.push(`${path}.description`);
  }

  return {
    line: {
      description,
      unit: unit ?? "NOS",
      qty,
      rate,
      specific: "",
      lumpsumMode: "none",
    },
    lowConfidencePaths: unit ? low : [...low, `${path}.unit`],
  };
}

export interface LineExtractionResult {
  lines: ExtractedLine[];
  lowConfidence: string[];
  gstRate?: number;
  discount?: number;
}

/**
 * Walk a document's text lines (already split one logical row per string —
 * see pdf.ts for how those get built) and pull out line items plus GST/
 * discount if they're stated as a plain "GST 18%" / "Discount 5000" line.
 *
 * Lines with no real figures are buffered as `pendingDescription` and
 * prepended to the next line that does carry numbers, rather than attached
 * to the previous item — quotations conventionally state a heading and any
 * lettered sub-points *before* the row that finally carries qty/rate, not
 * after (see the module doc comment for a worked example). Text that never
 * reaches a numbered line — trailing notes past the last item, say — is
 * simply dropped; it was never going to become a priced line either way.
 */
export function extractLinesFromText(rawLines: string[]): LineExtractionResult {
  const lines: ExtractedLine[] = [];
  const lowConfidence: string[] = [];
  const pendingDescription: string[] = [];
  let gstRate: number | undefined;
  let discount: number | undefined;
  let pastItemTable = false;
  // Whether we've reached the item table yet — either its own header row was
  // recognised, or at least one real item has already been parsed. Before
  // this point a no-number line is document front matter (a title, a
  // one-line "Estimate for ABC Site" heading, …), not a multi-line item
  // heading, and must be dropped rather than buffered — otherwise it silently
  // prepends itself onto the first item's description on every upload.
  let inItemArea = false;

  for (const raw of rawLines) {
    const text = raw.trim();
    if (!text) continue;

    const found = scanGstAndDiscount(text);
    if (found.gstRate !== undefined) gstRate = found.gstRate;
    if (found.discount !== undefined) discount = found.discount;

    if (STOP_MARKERS.test(text)) {
      pastItemTable = true;
      continue;
    }
    if (pastItemTable) continue;

    // The table's own header row ("Description | Qty | Rate | Amount") has
    // no real figures to extract and would otherwise be buffered as if it
    // were part of the first item's description — skip it explicitly.
    if (TABLE_HEADER_MARKERS.test(text) && numberTokens(text).length === 0) {
      inItemArea = true;
      continue;
    }

    if (SUMMARY_LINE.test(text) || HEADER_LABEL_LINE.test(text) || GSTIN_INLINE.test(text)) continue;

    const result = parseItemLine(text, lines.length);
    if (!result.line) {
      if (inItemArea) pendingDescription.push(text);
      continue;
    }
    inItemArea = true;
    if (pendingDescription.length > 0) {
      result.line.description = [...pendingDescription, result.line.description].filter(Boolean).join("\n");
      pendingDescription.length = 0;
    }
    lines.push(result.line);
    lowConfidence.push(...result.lowConfidencePaths);
  }

  return { lines, lowConfidence, gstRate, discount };
}

// 15 chars: 2-digit state + 10-char PAN (5 letters, 4 digits, 1 letter) + 1-digit entity code + literal "Z" + 1 alphanumeric checksum.
const GSTIN_PATTERN = /\b\d{2}[A-Z]{5}\d{4}[A-Z]\dZ[A-Z\d]\b/;
const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[A-Za-z.]{2,}/;
const PHONE_PATTERN = /(?:\+?91[-\s]?)?\b[6-9]\d{9}\b/;
const QUOTE_NUMBER_LINE = /\b(?:quotation|quote|ref(?:erence)?)\s*(?:no\.?|number|#|:)\s*[:\-]?\s*([A-Za-z0-9\-/]{3,})/i;
const DATE_TOKEN = /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/;

/** Best-effort ISO date from a DD/MM/YYYY-style token (the app's own convention). */
function toIsoDate(day: string, month: string, year: string): string | null {
  const y = year.length === 2 ? `20${year}` : year;
  const d = day.padStart(2, "0");
  const m = month.padStart(2, "0");
  const iso = `${y}-${m}-${d}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

/**
 * Header-field scan across the whole document's text. Deliberately
 * conservative: a field is only filled in when a clear pattern matches
 * (GSTIN checksum-shaped, an email address, a quotation-number label) —
 * nothing here guesses a client's name from prose, since a wrong guess
 * there is worse than an empty field the reviewer fills in themselves.
 */
export function extractHeaderFields(fullText: string): Partial<ExtractedQuote> & { lowConfidence: string[] } {
  const out: Partial<ExtractedQuote> = {};
  const low: string[] = [];

  const gstin = GSTIN_PATTERN.exec(fullText);
  if (gstin) out.clientGstin = gstin[0];

  const email = EMAIL_PATTERN.exec(fullText);
  if (email) out.email = email[0];

  const phone = PHONE_PATTERN.exec(fullText);
  if (phone) out.contact = phone[0];

  const quoteNo = QUOTE_NUMBER_LINE.exec(fullText);
  if (quoteNo) out.number = quoteNo[1];

  const dateMatch = DATE_TOKEN.exec(fullText);
  if (dateMatch) {
    const iso = toIsoDate(dateMatch[1], dateMatch[2], dateMatch[3]);
    if (iso) {
      out.date = iso;
      // DD/MM vs MM/DD is inherently ambiguous from the token alone — always
      // worth a second look rather than trusting the assumed convention.
      low.push("date");
    }
  }

  return { ...out, lowConfidence: low };
}
