import type { ExtractedLine } from "./schema";

/**
 * Deterministic row/column reading shared by the Excel/CSV file importer
 * (excel.ts) and the "Paste from Excel" dialog in the quotation builder —
 * both end up with the same shape of data (a 2D grid of cell text), one from
 * `XLSX.utils.sheet_to_json`, the other from splitting clipboard text on
 * newlines/tabs (Excel and Google Sheets both put a tab-separated grid on
 * the clipboard when you copy a cell range).
 */

export type ColumnRole = "description" | "unit" | "qty" | "rate" | "amount" | "specific";

export const COLUMN_ROLE_LABELS: Record<ColumnRole, string> = {
  description: "Description",
  unit: "Unit",
  qty: "Qty",
  rate: "Rate",
  amount: "Amount",
  specific: "Specific",
};

/** Header-cell text this extractor recognises for each column role. */
const COLUMN_SYNONYMS: Record<ColumnRole, string[]> = {
  description: ["description", "particulars", "item", "item description", "work description", "scope"],
  unit: ["unit", "uom", "u.o.m"],
  qty: ["qty", "quantity", "qnty"],
  rate: ["rate", "unit rate", "unit price", "price"],
  amount: ["amount", "total", "value"],
  specific: ["specific", "remarks", "notes", "note"],
};

export interface HeaderMatch {
  rowIndex: number;
  columns: Partial<Record<ColumnRole, number>>;
}

export const cellText = (cell: unknown): string => (cell === undefined || cell === null ? "" : String(cell).trim());

/** Scan the first `maxRows` rows for one that looks like the item table's header. */
export function findHeaderRow(rows: unknown[][], maxRows: number): HeaderMatch | null {
  const scanLimit = Math.min(rows.length, maxRows);
  for (let r = 0; r < scanLimit; r++) {
    const row = rows[r];
    const columns: HeaderMatch["columns"] = {};
    row.forEach((cell, c) => {
      const text = cellText(cell).toLowerCase();
      if (!text) return;
      for (const [role, synonyms] of Object.entries(COLUMN_SYNONYMS) as [ColumnRole, string[]][]) {
        if (role in columns) continue; // first match wins for this role
        if (synonyms.some((s) => text === s || text.includes(s))) columns[role] = c;
      }
    });
    // Require description + at least one of qty/rate/amount to call this a
    // real header row — a single stray "Notes" cell elsewhere shouldn't count.
    if (columns.description !== undefined && (columns.qty !== undefined || columns.rate !== undefined || columns.amount !== undefined)) {
      return { rowIndex: r, columns };
    }
  }
  return null;
}

const STOP_MARKERS = /\b(sub\s*-?total|grand\s*total|total\s*amount|terms|signature)\b/i;

/** Read item rows given a column mapping, starting right after `startRow`. */
export function readItemRows(
  rows: unknown[][],
  columns: Partial<Record<ColumnRole, number>>,
  startRow: number
): { lines: ExtractedLine[]; lowConfidence: string[] } {
  const lines: ExtractedLine[] = [];
  const lowConfidence: string[] = [];

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    const description = columns.description !== undefined ? cellText(row[columns.description]) : "";
    if (!description) continue; // blank description row — skip rather than stop; a spacer row is common
    if (STOP_MARKERS.test(description)) break;

    const path = `lines[${lines.length}]`;
    const qtyText = columns.qty !== undefined ? cellText(row[columns.qty]) : "";
    const rateText = columns.rate !== undefined ? cellText(row[columns.rate]) : "";
    const amountText = columns.amount !== undefined ? cellText(row[columns.amount]) : "";

    let qty = Number(qtyText.replace(/,/g, "")) || 0;
    let rate = Number(rateText.replace(/,/g, "")) || 0;
    const amount = Number(amountText.replace(/,/g, "")) || 0;

    if (columns.qty === undefined || !qtyText) {
      // No quantity column, or this row's cell is blank — a rate-only /
      // lump-sum-shaped row. Fall back to the amount if that's all we have.
      qty = 1;
      if (!rate && amount) rate = amount;
      lowConfidence.push(`${path}.qty`);
    }
    if (columns.rate === undefined || !rateText) {
      if (!rate && amount && qty) rate = amount / qty;
      lowConfidence.push(`${path}.rate`);
    }

    lines.push({
      description,
      unit: columns.unit !== undefined ? cellText(row[columns.unit]) || "NOS" : "NOS",
      qty,
      rate,
      specific: columns.specific !== undefined ? cellText(row[columns.specific]) : "",
      lumpsumMode: "none",
    });
  }

  return { lines, lowConfidence };
}
