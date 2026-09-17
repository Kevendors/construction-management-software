import * as XLSX from "xlsx";
import type { ExtractedQuote } from "./schema";
import { emptyExtractedQuote } from "./schema";
import { extractHeaderFields, scanGstAndDiscount } from "./line-heuristics";
import { cellText, findHeaderRow, readItemRows } from "./rows";

/**
 * Spreadsheet extraction is fully deterministic — no heuristic guessing
 * needed, because a spreadsheet already has real columns. This runs in the
 * browser (the upload page calls it directly): `XLSX.read` takes the file's
 * raw bytes as a `Uint8Array` rather than a Node `Buffer`, which keeps this
 * module free of any Node-only API. Row/column matching itself lives in
 * rows.ts, shared with the "Paste from Excel" dialog in the quote builder.
 */

/** Extract a quotation from a spreadsheet's raw bytes (xlsx/xls/csv). */
export function extractFromWorkbook(bytes: Uint8Array): ExtractedQuote {
  const workbook = XLSX.read(bytes, { type: "array" });
  const base = emptyExtractedQuote();

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: true });
    if (rows.length === 0) continue;

    const header = findHeaderRow(rows, 20);
    if (!header) continue; // no recognisable item table on this sheet — try the next one

    const { lines, lowConfidence } = readItemRows(rows, header.columns, header.rowIndex + 1);
    if (lines.length === 0) continue;

    // Header fields: scan the text above the table (company letterhead, "To:"
    // block) for GSTIN/email/phone/date; scan below it for GST%/discount.
    const above = rows.slice(0, header.rowIndex).flat().map(cellText).join(" ");
    const below = rows.slice(header.rowIndex + 1 + lines.length).flat().map(cellText).join(" ");
    const headerFields = extractHeaderFields(above);
    const totals = scanGstAndDiscount(below);

    return {
      ...base,
      ...headerFields,
      lines,
      gstRate: totals.gstRate ?? base.gstRate,
      discount: totals.discount ?? base.discount,
      lowConfidence: [...headerFields.lowConfidence, ...lowConfidence],
    };
  }

  // Nothing recognisable on any sheet — hand back an empty quote so the
  // caller falls through to manual entry rather than erroring.
  return base;
}
