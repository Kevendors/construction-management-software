"use client";

import * as React from "react";
import { ClipboardPaste } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, Select, Textarea } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { COLUMN_ROLE_LABELS, findHeaderRow, readItemRows, type ColumnRole } from "@/lib/extraction/rows";
import { extractedLineToQuoteLine } from "@/lib/extraction/to-quote-state";
import type { QuoteLine } from "@/lib/quotation/compute";

const ROLE_OPTIONS: (ColumnRole | "ignore")[] = ["ignore", "description", "unit", "qty", "rate", "amount", "specific"];
const MAX_MAPPED_COLUMNS = 10;
const PREVIEW_ROWS = 6;

/** Split clipboard text (Excel/Google Sheets both copy cell ranges this way) into a grid. */
function parseClipboardGrid(text: string): string[][] {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => line.split("\t"));
}

/**
 * Bulk-add line items by pasting cells copied from Excel or Google Sheets —
 * the fast alternative to entering rows one at a time, without needing any
 * external account or connection. Reuses the same deterministic column
 * matching as the Excel file importer (src/lib/extraction/rows.ts); when a
 * header row can't be auto-detected (the user copied data-only rows), falls
 * back to letting them assign each column's role by hand.
 */
export function PasteRowsDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (lines: QuoteLine[]) => void;
}) {
  const [text, setText] = React.useState("");
  const [manualColumns, setManualColumns] = React.useState<Partial<Record<ColumnRole, number>>>({});
  const [firstRowIsHeader, setFirstRowIsHeader] = React.useState(true);

  const rows = React.useMemo(() => parseClipboardGrid(text), [text]);
  const autoHeader = React.useMemo(() => findHeaderRow(rows, 5), [rows]);

  // Auto-detection wins whenever it finds something; manual mapping is the
  // fallback for a paste that's data-only (no header row was copied).
  const usingManual = !autoHeader && rows.length > 0;
  const columns = autoHeader ? autoHeader.columns : manualColumns;
  const startRow = autoHeader ? autoHeader.rowIndex + 1 : firstRowIsHeader ? 1 : 0;

  const result = React.useMemo(() => readItemRows(rows, columns, startRow), [rows, columns, startRow]);

  const columnCount = Math.min(MAX_MAPPED_COLUMNS, Math.max(0, ...rows.map((r) => r.length)));

  function setManualRole(colIndex: number, role: ColumnRole | "ignore") {
    setManualColumns((prev) => {
      const next = { ...prev };
      // Each role is used at most once — picking it for this column clears
      // any other column that was previously assigned the same role.
      for (const key of Object.keys(next) as ColumnRole[]) {
        if (next[key] === colIndex) delete next[key];
      }
      if (role !== "ignore") next[role] = colIndex;
      return next;
    });
  }

  function reset() {
    setText("");
    setManualColumns({});
    setFirstRowIsHeader(true);
  }

  function confirm() {
    if (result.lines.length === 0) return;
    onAdd(result.lines.map(extractedLineToQuoteLine));
    reset();
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Paste from Excel"
      description="Copy a range of cells from Excel or Google Sheets, then paste it below to add several items at once."
      className="max-w-2xl"
    >
      <div className="space-y-4">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Click here, then press Ctrl+V (or Cmd+V) to paste the cells you copied…"
          className="min-h-[120px] font-mono text-xs"
          autoFocus
        />

        {usingManual && (
          <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            <p className="font-medium">Couldn&apos;t find a header row automatically.</p>
            <p className="text-amber-800">
              Tell us what each column is below, or re-copy including the header row (Description, Qty, Rate, …) from your sheet.
            </p>
          </div>
        )}

        {usingManual && columnCount > 0 && (
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={firstRowIsHeader}
                onChange={(e) => setFirstRowIsHeader(e.target.checked)}
              />
              The first pasted row is a header (not an item)
            </label>
            <div className="overflow-x-auto rounded-md border border-border">
              <div className="grid gap-px bg-border" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(110px, 1fr))` }}>
                {Array.from({ length: columnCount }, (_, c) => {
                  const assigned = (Object.entries(manualColumns) as [ColumnRole, number][]).find(([, idx]) => idx === c)?.[0];
                  return (
                    <Select
                      key={c}
                      aria-label={`Column ${c + 1} role`}
                      value={assigned ?? "ignore"}
                      onChange={(e) => setManualRole(c, e.target.value as ColumnRole | "ignore")}
                      className="h-8 rounded-none border-0 bg-card text-xs"
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r === "ignore" ? "Ignore" : COLUMN_ROLE_LABELS[r]}
                        </option>
                      ))}
                    </Select>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">
              {autoHeader
                ? "Header row detected — columns mapped automatically."
                : usingManual
                  ? "Preview of what will be added:"
                  : ""}
            </p>
            {result.lines.length > 0 ? (
              <div className="max-h-64 overflow-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.lines.slice(0, PREVIEW_ROWS).map((l, i) => (
                      <TableRow key={i}>
                        <TableCell className="max-w-xs truncate">{l.description}</TableCell>
                        <TableCell>{l.unit}</TableCell>
                        <TableCell className="text-right tabular-nums">{l.qty}</TableCell>
                        <TableCell className="text-right tabular-nums">{l.rate}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {result.lines.length > PREVIEW_ROWS && (
                  <p className="border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
                    +{result.lines.length - PREVIEW_ROWS} more row{result.lines.length - PREVIEW_ROWS === 1 ? "" : "s"}
                  </p>
                )}
              </div>
            ) : (
              !autoHeader &&
              usingManual && (
                <p className="rounded-md bg-secondary/50 px-3 py-2 text-sm text-muted-foreground">
                  Assign at least a Description column and one of Qty / Rate / Amount to see a preview.
                </p>
              )
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => { reset(); onClose(); }}>
            Cancel
          </Button>
          <Button type="button" onClick={confirm} disabled={result.lines.length === 0}>
            <ClipboardPaste className="h-4 w-4" />
            Add {result.lines.length || ""} Item{result.lines.length === 1 ? "" : "s"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
