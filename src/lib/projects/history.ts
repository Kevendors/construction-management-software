import type {
  Dpr,
  Expense,
  SalesInvoice,
  SiteInstruction,
  Transaction,
} from "@/lib/types";
import { lineTotalWithTax } from "@/lib/mock/selectors";
import { formatINR } from "@/lib/utils";

export type HistoryKind = "dpr" | "instruction" | "expense_in" | "expense_out" | "invoice" | "petty";

export interface HistoryEvent {
  id: string;
  ts: number; // epoch ms, for sorting
  date: string; // ISO date
  kind: HistoryKind;
  title: string;
  detail: string;
}

export interface HistoryInput {
  dprs: Dpr[];
  instructions: SiteInstruction[];
  transactions: Transaction[];
  invoices: SalesInvoice[];
  expenses: Expense[];
}

const ts = (d: string) => (d ? new Date(d).getTime() : 0);
const clip = (s: string, n = 90) => (s.length > n ? s.slice(0, n).trimEnd() + "…" : s);

/**
 * Build a chronological (newest-first) activity history for a project by
 * merging its own records. Pure + derived, so it always reflects live data.
 */
export function deriveProjectHistory(input: HistoryInput): HistoryEvent[] {
  const events: HistoryEvent[] = [];

  for (const d of input.dprs) {
    events.push({
      id: `dpr-${d.id}`,
      ts: ts(d.date),
      date: d.date,
      kind: "dpr",
      title: "Daily progress report",
      detail: clip(d.workDone || `${d.labourCount} labour on site`),
    });
  }

  for (const s of input.instructions) {
    events.push({
      id: `si-${s.id}`,
      ts: ts(s.date),
      date: s.date,
      kind: "instruction",
      title: `Site instruction (${s.priority})`,
      detail: clip(s.text),
    });
  }

  for (const t of input.transactions) {
    const isIn = t.direction === "in";
    events.push({
      id: `txn-${t.id}`,
      ts: ts(t.date),
      date: t.date,
      kind: isIn ? "expense_in" : "expense_out",
      title: isIn ? "Payment received" : "Expense booked",
      detail: `${formatINR(t.amount)}${t.note ? ` · ${clip(t.note, 50)}` : ""}`,
    });
  }

  for (const i of input.invoices) {
    events.push({
      id: `inv-${i.id}`,
      ts: ts(i.date),
      date: i.date,
      kind: "invoice",
      title: `Invoice ${i.number}`,
      detail: formatINR(lineTotalWithTax(i.items, i.taxRate)),
    });
  }

  for (const e of input.expenses) {
    events.push({
      id: `exp-${e.id}`,
      ts: ts(e.date),
      date: e.date,
      kind: "petty",
      title: `Petty expense${e.title ? `: ${e.title}` : ""}`,
      detail: `${formatINR(e.amount)} · ${e.status}`,
    });
  }

  return events.sort((a, b) => b.ts - a.ts);
}
