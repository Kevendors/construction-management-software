// Pure derivation helpers — same math as lib/mock/selectors.ts but data-injected
// (no module-level mock imports) so they run against either source.

import type {
  Boq,
  LineItem,
  MaterialItem,
  MaterialUsage,
  PurchaseOrder,
  SubconWorkOrder,
  Task,
  TaskStatus,
  Project,
  SalesInvoice,
  Transaction,
} from "@/lib/types";
import type { DocTotals, ProjectPnL } from "@/lib/mock/selectors";

export const lineSubtotal = (items: LineItem[]) =>
  items.reduce((sum, it) => sum + it.qty * it.rate, 0);

export const lineTotalWithTax = (items: LineItem[], taxRate: number) => {
  const sub = lineSubtotal(items);
  return sub + (sub * taxRate) / 100;
};

export const boqValueOf = (boq: Boq | null) =>
  boq ? lineSubtotal(boq.items) : 0;

export const computeTaskCounts = (tasks: Task[]): Record<TaskStatus, number> => {
  const counts: Record<TaskStatus, number> = {
    not_started: 0,
    ongoing: 0,
    delayed: 0,
    completed: 0,
  };
  for (const t of tasks) counts[t.status]++;
  return counts;
};

export const computeProjectPnL = (
  project: Project,
  txns: Transaction[],
  invoices: SalesInvoice[],
  boq: Boq | null
): ProjectPnL => {
  const totalExpense = txns
    .filter((t) => t.direction === "out")
    .reduce((s, t) => s + t.amount, 0);
  const salesInvoiced = invoices.reduce(
    (s, i) => s + lineTotalWithTax(i.items, i.taxRate),
    0
  );
  const salesReceived = invoices.reduce((s, i) => s + i.received, 0);
  const margin = project.value - totalExpense;
  return {
    projectValue: project.value,
    totalExpense,
    salesInvoiced,
    salesReceived,
    boqValue: boqValueOf(boq),
    margin,
    marginPct: project.value > 0 ? (margin / project.value) * 100 : 0,
  };
};

/* ---------- company-wide (data-injected mirrors of selectors) ---------- */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
const monthIdx = (date: string) => new Date(date).getMonth();

export const computeCompanyTotals = (
  projects: Project[],
  transactions: Transaction[],
  invoices: SalesInvoice[]
) => {
  const value = projects.reduce((s, p) => s + p.value, 0);
  const expense = transactions
    .filter((t) => t.direction === "out")
    .reduce((s, t) => s + t.amount, 0);
  const invoiced = invoices.reduce((s, i) => s + lineTotalWithTax(i.items, i.taxRate), 0);
  const received = invoices.reduce((s, i) => s + i.received, 0);
  return { value, expense, invoiced, received, margin: value - expense };
};

export const computeMonthlyTrend = (
  transactions: Transaction[],
  invoices: SalesInvoice[]
) => {
  const rows = MONTHS.map((m) => ({ month: m, invoice: 0, expense: 0, margin: 0 }));
  for (const inv of invoices) {
    const m = monthIdx(inv.date);
    if (m < rows.length) rows[m].invoice += lineTotalWithTax(inv.items, inv.taxRate);
  }
  for (const t of transactions) {
    if (t.direction !== "out") continue;
    const m = monthIdx(t.date);
    if (m < rows.length) rows[m].expense += t.amount;
  }
  for (const r of rows) r.margin = r.invoice - r.expense;
  return rows;
};

export const computeCashFlow = (transactions: Transaction[]) => {
  const rows = MONTHS.map((m) => ({ month: m, inflow: 0, outflow: 0, balance: 0 }));
  for (const t of transactions) {
    const m = monthIdx(t.date);
    if (m >= rows.length) continue;
    if (t.direction === "in") rows[m].inflow += t.amount;
    else rows[m].outflow += t.amount;
  }
  let running = 0;
  for (const r of rows) {
    running += r.inflow - r.outflow;
    r.balance = running;
  }
  return rows;
};

/** Per-project enrichment used by the dashboard/analytics aggregates. */
export interface EnrichedProject {
  project: Project;
  pnl: ProjectPnL;
  taskCounts: Record<TaskStatus, number>;
}

export const enrichProjects = (
  projects: Project[],
  transactions: Transaction[],
  invoices: SalesInvoice[],
  boqs: Boq[],
  tasks: Task[]
): EnrichedProject[] =>
  projects.map((project) => {
    const boq = boqs.find((b) => b.projectId === project.id) ?? null;
    return {
      project,
      pnl: computeProjectPnL(
        project,
        transactions.filter((t) => t.projectId === project.id),
        invoices.filter((i) => i.projectId === project.id),
        boq
      ),
      taskCounts: computeTaskCounts(tasks.filter((t) => t.projectId === project.id)),
    };
  });

export const computeProjectMargins = (enriched: EnrichedProject[]) =>
  enriched.map(({ project, pnl }) => ({
    name: project.code,
    fullName: project.name,
    margin: pnl.margin,
    marginPct: pnl.marginPct,
  }));

export const computeBudgetVsActual = (enriched: EnrichedProject[]) =>
  enriched.map(({ project, pnl }) => ({
    name: project.code,
    budget: pnl.boqValue,
    actual: pnl.totalExpense,
  }));

export const computePortfolioHealth = (enriched: EnrichedProject[]) =>
  enriched.map(({ project, taskCounts }) => ({
    name: project.code,
    fullName: project.name,
    not_started: taskCounts.not_started,
    ongoing: taskCounts.ongoing,
    delayed: taskCounts.delayed,
    completed: taskCounts.completed,
  }));

/* ---------- material (data-injected) ---------- */

export const isLowStock = (m: MaterialItem) => m.stockQty < m.reorderLevel;

/** Stock vs reorder level — feeds chart 18. */
export const stockLevels = (items: MaterialItem[]) =>
  items.map((m) => ({
    name: m.name,
    short: m.name.split(" ").slice(0, 2).join(" "),
    stock: m.stockQty,
    reorder: m.reorderLevel,
    low: isLowStock(m),
    unit: m.unit,
  }));

const gstSplit = (taxable: number, taxRate: number) => {
  const tax = (taxable * taxRate) / 100;
  return { cgst: tax / 2, sgst: tax / 2, total: tax };
};

export const poTotals = (po: PurchaseOrder): DocTotals => {
  const subtotal = lineSubtotal(po.items as LineItem[]);
  const taxable = subtotal - po.discount;
  const { cgst, sgst } = gstSplit(taxable, po.taxRate);
  return { subtotal, discount: po.discount, taxable, cgst, sgst, grandTotal: taxable + cgst + sgst };
};

export const woTotals = (wo: SubconWorkOrder): DocTotals => {
  const subtotal = lineSubtotal(wo.items as LineItem[]);
  const { cgst, sgst } = gstSplit(subtotal, wo.taxRate);
  return { subtotal, discount: 0, taxable: subtotal, cgst, sgst, grandTotal: subtotal + cgst + sgst };
};

/** Material consumption grouped by item (qty + value). */
export const materialConsumption = (usage: MaterialUsage[], items: MaterialItem[]) => {
  const itemById = new Map(items.map((i) => [i.id, i]));
  const map = new Map<string, number>();
  for (const u of usage) map.set(u.materialItemId, (map.get(u.materialItemId) ?? 0) + u.qty);
  return Array.from(map, ([materialItemId, qty]) => {
    const item = itemById.get(materialItemId);
    return {
      name: item?.name ?? materialItemId,
      qty,
      value: qty * (item?.rate ?? 0),
      unit: item?.unit ?? "",
    };
  });
};
