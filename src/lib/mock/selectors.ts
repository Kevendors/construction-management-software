import {
  advances,
  boqs,
  clients,
  drawings,
  dprs,
  employees,
  equipment,
  expenses,
  goodsReceipts,
  labourAttendance,
  labourContractors,
  materialItems,
  materialIssues,
  materialRequests,
  materialUsage,
  projectFiles,
  projects,
  purchaseBookings,
  purchaseOrders,
  quotations,
  raBills,
  salarySlips,
  salesInvoices,
  siteInstructions,
  subconProgress,
  subconWorkOrders,
  subcontractors,
  suppliers,
  supervisorLedger,
  tasks,
  transactions,
  users,
} from "@/lib/mock/data";
import type {
  Boq,
  CostCode,
  LineItem,
  MaterialItem,
  Project,
  PurchaseOrder,
  SalarySlip,
  SubconWorkOrder,
  Task,
  TaskStatus,
} from "@/lib/types";

/* ---------- simple lookups ---------- */

export const getUser = (id: string | null) =>
  users.find((u) => u.id === id) ?? null;
export const getClient = (id: string) => clients.find((c) => c.id === id) ?? null;
export const getProject = (id: string) => projects.find((p) => p.id === id) ?? null;

export const getProjectTasks = (projectId: string) =>
  tasks.filter((t) => t.projectId === projectId);
export const getProjectDprs = (projectId: string) =>
  dprs.filter((d) => d.projectId === projectId);
export const getProjectInstructions = (projectId: string) =>
  siteInstructions.filter((s) => s.projectId === projectId);
export const getProjectFiles = (projectId: string) =>
  projectFiles.filter((f) => f.projectId === projectId);
export const getProjectDrawings = (projectId: string) =>
  drawings.filter((d) => d.projectId === projectId);
export const getProjectBoq = (projectId: string): Boq | null =>
  boqs.find((b) => b.projectId === projectId) ?? null;
export const getProjectInvoices = (projectId: string) =>
  salesInvoices.filter((i) => i.projectId === projectId);
export const getProjectTransactions = (projectId: string) =>
  transactions.filter((t) => t.projectId === projectId);
export const getProjectExpenses = (projectId: string) =>
  expenses.filter((e) => e.projectId === projectId);
export const getClientQuotations = (clientId: string) =>
  quotations.filter((q) => q.clientId === clientId);

/* ---------- money helpers ---------- */

export const lineSubtotal = (items: LineItem[]) =>
  items.reduce((sum, it) => sum + it.qty * it.rate, 0);

export const lineTotalWithTax = (items: LineItem[], taxRate: number) => {
  const sub = lineSubtotal(items);
  return sub + (sub * taxRate) / 100;
};

export const boqValue = (projectId: string) => {
  const b = getProjectBoq(projectId);
  return b ? lineSubtotal(b.items) : 0;
};

/* ---------- task status ---------- */

export const taskStatusCounts = (projectId: string) => {
  const t = getProjectTasks(projectId);
  const counts: Record<TaskStatus, number> = {
    not_started: 0,
    ongoing: 0,
    delayed: 0,
    completed: 0,
  };
  for (const task of t) counts[task.status]++;
  return counts;
};

export const taskProgressPercent = (task: Task) =>
  task.progressTarget > 0
    ? Math.min(100, (task.progressValue / task.progressTarget) * 100)
    : 0;

/* ---------- project P&L ---------- */

export interface ProjectPnL {
  projectValue: number;
  totalExpense: number; // outflow transactions
  salesInvoiced: number; // invoice totals incl tax
  salesReceived: number;
  boqValue: number;
  margin: number; // value - expense
  marginPct: number;
}

export const projectPnL = (projectId: string): ProjectPnL => {
  const project = getProject(projectId)!;
  const txns = getProjectTransactions(projectId);
  const totalExpense = txns
    .filter((t) => t.direction === "out")
    .reduce((s, t) => s + t.amount, 0);
  const invs = getProjectInvoices(projectId);
  const salesInvoiced = invs.reduce(
    (s, i) => s + lineTotalWithTax(i.items, i.taxRate),
    0
  );
  const salesReceived = invs.reduce((s, i) => s + i.received, 0);
  const margin = project.value - totalExpense;
  return {
    projectValue: project.value,
    totalExpense,
    salesInvoiced,
    salesReceived,
    boqValue: boqValue(projectId),
    margin,
    marginPct: project.value > 0 ? (margin / project.value) * 100 : 0,
  };
};

/* ---------- expense breakdowns ---------- */

export const expenseByCategory = (projectId: string) => {
  const out = getProjectTransactions(projectId).filter((t) => t.direction === "out");
  const map = new Map<string, number>();
  for (const t of out) map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  return Array.from(map, ([category, amount]) => ({ category, amount }));
};

export const expenseByCostCode = (projectId: string) => {
  const out = getProjectTransactions(projectId).filter((t) => t.direction === "out");
  const map = new Map<CostCode, number>();
  for (const t of out) map.set(t.costCode, (map.get(t.costCode) ?? 0) + t.amount);
  return Array.from(map, ([costCode, amount]) => ({ costCode, amount }));
};

/* ---------- company-wide ---------- */

export const companyTotals = () => {
  const value = projects.reduce((s, p) => s + p.value, 0);
  const expense = transactions
    .filter((t) => t.direction === "out")
    .reduce((s, t) => s + t.amount, 0);
  const invoiced = salesInvoices.reduce(
    (s, i) => s + lineTotalWithTax(i.items, i.taxRate),
    0
  );
  const received = salesInvoices.reduce((s, i) => s + i.received, 0);
  return { value, expense, invoiced, received, margin: value - expense };
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];

/** Monthly invoice / expense / margin trend across all projects (2026 H1). */
export const monthlyTrend = () => {
  const init = () =>
    MONTHS.map((m) => ({ month: m, invoice: 0, expense: 0, margin: 0 }));
  const rows = init();
  const idx = (date: string) => new Date(date).getMonth(); // 0=Jan

  for (const inv of salesInvoices) {
    const m = idx(inv.date);
    if (m < rows.length) rows[m].invoice += lineTotalWithTax(inv.items, inv.taxRate);
  }
  for (const t of transactions) {
    if (t.direction !== "out") continue;
    const m = idx(t.date);
    if (m < rows.length) rows[m].expense += t.amount;
  }
  for (const r of rows) r.margin = r.invoice - r.expense;
  return rows;
};

/** Per-project margin comparison. */
export const projectMargins = () =>
  projects.map((p: Project) => {
    const pnl = projectPnL(p.id);
    return { name: p.code, fullName: p.name, margin: pnl.margin, marginPct: pnl.marginPct };
  });

/** Budget (BOQ) vs actual spend per project. */
export const budgetVsActual = () =>
  projects.map((p) => {
    const pnl = projectPnL(p.id);
    return { name: p.code, budget: pnl.boqValue, actual: pnl.totalExpense };
  });

/* ================================================================== */
/* Phase 2 — Material & Subcontractor                                  */
/* ================================================================== */

/* ---------- lookups ---------- */

export const getSupplier = (id: string) => suppliers.find((s) => s.id === id) ?? null;
export const getSubcontractor = (id: string) =>
  subcontractors.find((s) => s.id === id) ?? null;
export const getMaterialItem = (id: string) =>
  materialItems.find((m) => m.id === id) ?? null;
export const getPO = (id: string) => purchaseOrders.find((p) => p.id === id) ?? null;
export const getWorkOrder = (id: string) =>
  subconWorkOrders.find((w) => w.id === id) ?? null;

export const getProjectMaterialRequests = (projectId: string) =>
  materialRequests.filter((r) => r.projectId === projectId);
export const getProjectUsage = (projectId: string) =>
  materialUsage.filter((u) => u.projectId === projectId);
export const getPOReceipts = (poId: string) =>
  goodsReceipts.filter((g) => g.poId === poId);
export const getPOBookings = (poId: string) =>
  purchaseBookings.filter((b) => b.poId === poId);
export const getWoProgress = (workOrderId: string) =>
  subconProgress
    .filter((p) => p.workOrderId === workOrderId)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
export const getWoRaBills = (workOrderId: string) =>
  raBills.filter((r) => r.workOrderId === workOrderId);

/* ---------- GST + document totals ---------- */

/** Split a tax amount into equal CGST / SGST halves. */
export const gstSplit = (taxableAmount: number, taxRate: number) => {
  const tax = (taxableAmount * taxRate) / 100;
  return { cgst: tax / 2, sgst: tax / 2, total: tax };
};

export interface DocTotals {
  subtotal: number;
  discount: number;
  taxable: number;
  cgst: number;
  sgst: number;
  grandTotal: number;
}

export const poTotals = (po: PurchaseOrder): DocTotals => {
  const subtotal = lineSubtotal(po.items);
  const taxable = subtotal - po.discount;
  const { cgst, sgst } = gstSplit(taxable, po.taxRate);
  return {
    subtotal,
    discount: po.discount,
    taxable,
    cgst,
    sgst,
    grandTotal: taxable + cgst + sgst,
  };
};

export const woTotals = (wo: SubconWorkOrder): DocTotals => {
  const subtotal = lineSubtotal(wo.items);
  const { cgst, sgst } = gstSplit(subtotal, wo.taxRate);
  return {
    subtotal,
    discount: 0,
    taxable: subtotal,
    cgst,
    sgst,
    grandTotal: subtotal + cgst + sgst,
  };
};

/* ---------- inventory / stock ---------- */

export const isLowStock = (m: MaterialItem) => m.stockQty < m.reorderLevel;

export const lowStockItems = () => materialItems.filter(isLowStock);

/** Stock vs reorder level — feeds chart 18. */
export const stockLevels = () =>
  materialItems.map((m) => ({
    name: m.name,
    short: m.name.split(" ").slice(0, 2).join(" "),
    stock: m.stockQty,
    reorder: m.reorderLevel,
    low: isLowStock(m),
    unit: m.unit,
  }));

/** Material consumption grouped by item (qty + value). */
export const materialConsumption = () => {
  const map = new Map<string, number>();
  for (const u of materialUsage) map.set(u.materialItemId, (map.get(u.materialItemId) ?? 0) + u.qty);
  return Array.from(map, ([materialItemId, qty]) => {
    const item = getMaterialItem(materialItemId);
    return {
      name: item?.name ?? materialItemId,
      qty,
      value: qty * (item?.rate ?? 0),
      unit: item?.unit ?? "",
    };
  });
};

/* ---------- subcon-scoped material issues ---------- */

export const getSubconIssues = (subcontractorId: string) =>
  materialIssues.filter((i) => i.subcontractorId === subcontractorId);

/* ================================================================== */
/* Phase 3 — Payroll, Attendance, Expenses, Equipment                  */
/* ================================================================== */

/* ---------- lookups ---------- */

export const getEmployee = (id: string) => employees.find((e) => e.id === id) ?? null;
export const getContractor = (id: string) =>
  labourContractors.find((c) => c.id === id) ?? null;
export const getEquipment = (id: string) => equipment.find((e) => e.id === id) ?? null;

/* ---------- salary slip totals ---------- */

export interface SlipTotals {
  earnings: number; // basic + hra + allowances
  deductions: number; // pf + esi + advance
  net: number;
}

export const slipTotals = (s: SalarySlip): SlipTotals => {
  const earnings = s.basic + s.hra + s.allowances;
  const deductions = s.pf + s.esi + s.advanceDeduction;
  return { earnings, deductions, net: earnings - deductions };
};

export const getEmployeeSlips = (employeeId: string) =>
  salarySlips
    .filter((s) => s.employeeId === employeeId)
    .sort((a, b) => b.month.localeCompare(a.month));

export const latestSlipMonth = () =>
  salarySlips.reduce((m, s) => (s.month > m ? s.month : m), "0000-00");

/** Monthly staff payroll (net) for a given month, e.g. "2026-05". */
export const monthlyPayroll = (month: string) =>
  salarySlips
    .filter((s) => s.month === month)
    .reduce((sum, s) => sum + slipTotals(s).net, 0);

/** Chart 19 — payroll cost broken down by department (net pay). */
export const payrollByDepartment = (month: string) => {
  const map = new Map<string, number>();
  for (const s of salarySlips.filter((x) => x.month === month)) {
    const emp = getEmployee(s.employeeId);
    if (!emp) continue;
    map.set(emp.department, (map.get(emp.department) ?? 0) + slipTotals(s).net);
  }
  return Array.from(map, ([department, amount]) => ({ department, amount }));
};

/* ---------- attendance ---------- */

export const getContractorAttendance = (contractorId: string) =>
  labourAttendance
    .filter((a) => a.contractorId === contractorId)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));

/** Daily present/absent totals across all contractors (feeds the 7-day chart). */
export const labourAttendanceByDay = () => {
  const map = new Map<string, { present: number; absent: number }>();
  for (const a of labourAttendance) {
    const cur = map.get(a.date) ?? { present: 0, absent: 0 };
    cur.present += a.present;
    cur.absent += a.absent;
    map.set(a.date, cur);
  }
  return Array.from(map, ([date, v]) => ({ date, ...v })).sort(
    (a, b) => +new Date(a.date) - +new Date(b.date)
  );
};

export const labourPresentOn = (date: string) =>
  labourAttendance
    .filter((a) => a.date === date)
    .reduce((s, a) => s + a.present, 0);

/* ---------- advances ---------- */

export const advanceOutstanding = (a: { amount: number; recovered: number }) =>
  a.amount - a.recovered;

export const totalAdvancesOutstanding = () =>
  advances.reduce((s, a) => s + advanceOutstanding(a), 0);

/* ---------- supervisor balance ---------- */

export interface SupervisorBalance {
  supervisorId: string;
  received: number;
  paid: number;
  balance: number;
}

export const supervisorBalances = (): SupervisorBalance[] => {
  const ids = Array.from(new Set(supervisorLedger.map((l) => l.supervisorId)));
  return ids.map((supervisorId) => {
    const rows = supervisorLedger.filter((l) => l.supervisorId === supervisorId);
    const received = rows.filter((l) => l.direction === "received").reduce((s, l) => s + l.amount, 0);
    const paid = rows.filter((l) => l.direction === "paid").reduce((s, l) => s + l.amount, 0);
    return { supervisorId, received, paid, balance: received - paid };
  });
};

export const getSupervisorEntries = (supervisorId: string) =>
  supervisorLedger
    .filter((l) => l.supervisorId === supervisorId)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));

/* ---------- equipment ---------- */

export const equipmentCounts = () => ({
  total: equipment.length,
  inUse: equipment.filter((e) => e.status === "in_use").length,
  idle: equipment.filter((e) => e.status === "idle").length,
  maintenance: equipment.filter((e) => e.status === "maintenance").length,
  monthlyCost: equipment.reduce((s, e) => s + e.monthlyRate, 0),
});

/* ================================================================== */
/* Phase 4 — Analytics (portfolio health + Gantt)                      */
/* ================================================================== */

/** Chart 15 — portfolio health: task-status counts per project (stacked). */
export const portfolioHealth = () =>
  projects.map((p) => {
    const counts = taskStatusCounts(p.id);
    return {
      name: p.code,
      fullName: p.name,
      not_started: counts.not_started,
      ongoing: counts.ongoing,
      delayed: counts.delayed,
      completed: counts.completed,
    };
  });

/** Chart 17 — Gantt model: positions each task on a shared time axis. */
export interface GanttRow {
  task: Task;
  leftPct: number;
  widthPct: number;
  progressPct: number;
}
export interface GanttModel {
  rows: GanttRow[];
  months: { label: string; leftPct: number }[];
  start: number;
  end: number;
}

export const buildGantt = (input: Task[]): GanttModel => {
  if (input.length === 0) return { rows: [], months: [], start: 0, end: 0 };
  const starts = input.map((t) => +new Date(t.startDate));
  const ends = input.map((t) => +new Date(t.endDate));
  const start = Math.min(...starts);
  const end = Math.max(...ends);
  const span = Math.max(1, end - start);

  const rows: GanttRow[] = input.map((task) => {
    const s = +new Date(task.startDate);
    const e = +new Date(task.endDate);
    return {
      task,
      leftPct: ((s - start) / span) * 100,
      widthPct: Math.max(1.5, ((e - s) / span) * 100),
      progressPct: taskProgressPercent(task),
    };
  });

  // month gridlines from the first of each month within the domain
  const months: { label: string; leftPct: number }[] = [];
  const cur = new Date(start);
  cur.setDate(1);
  if (+cur < start) cur.setMonth(cur.getMonth() + 1);
  while (+cur <= end) {
    months.push({
      label: cur.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      leftPct: ((+cur - start) / span) * 100,
    });
    cur.setMonth(cur.getMonth() + 1);
  }

  return { rows, months, start, end };
};

/* ---------- cash-flow (chart 14) ---------- */

/** Monthly cash in / out + running balance across all projects (2026 H1). */
export const cashFlow = () => {
  const rows = MONTHS.map((m) => ({ month: m, inflow: 0, outflow: 0, balance: 0 }));
  const idx = (date: string) => new Date(date).getMonth();
  for (const t of transactions) {
    const m = idx(t.date);
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
