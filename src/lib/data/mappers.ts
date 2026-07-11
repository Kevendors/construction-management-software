// Translate snake_case Postgres rows into the camelCase domain types the UI
// renders against. One mapper per table; keeps query files declarative.

import type {
  ActivityLogEntry,
  Boq,
  BoqItem,
  Client,
  Dpr,
  Drawing,
  DrawingVersion,
  Employee,
  Equipment,
  Expense,
  LabourAttendance,
  LineItem,
  MaterialIssue,
  MaterialItem,
  MaterialRequest,
  MaterialUsage,
  PoItem,
  Project,
  PurchaseOrder,
  Quotation,
  RaBill,
  SalesInvoice,
  SiteInstruction,
  Subcontractor,
  SubconProgress,
  SubconWorkOrder,
  Supplier,
  Task,
  Transaction,
  User,
  WoItem,
} from "@/lib/types";

/* ---------- DB row shapes (only the columns we read) ---------- */

export interface ClientRow {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  gst: string | null;
  created_at: string;
}

export interface ProjectRow {
  id: string;
  code: string;
  name: string;
  client_id: string | null;
  value: number;
  status: Project["status"];
  start_date: string | null;
  end_date: string | null;
  percent_complete: number;
  location: string | null;
  pm_id: string | null;
}

export interface LineItemRow {
  id: string;
  description: string;
  cost_code: LineItem["costCode"] | null;
  qty: number;
  unit: string | null;
  rate: number;
}

export interface QuotationRow {
  id: string;
  number: string;
  client_id: string | null;
  project_name: string | null;
  date: string;
  valid_until: string | null;
  status: Quotation["status"];
  tax_rate: number;
  quotation_items?: LineItemRow[];
}

export interface InvoiceRow {
  id: string;
  number: string;
  project_id: string | null;
  client_id: string | null;
  date: string;
  due_date: string | null;
  tax_rate: number;
  received: number;
  status: SalesInvoice["status"];
  invoice_items?: LineItemRow[];
}

export interface BoqRow {
  id: string;
  project_id: string;
  boq_items?: (LineItemRow & { cost_code: BoqItem["costCode"] })[];
}

export interface TaskRow {
  id: string;
  project_id: string;
  parent_id: string | null;
  name: string;
  assignee_id: string | null;
  start_date: string | null;
  end_date: string | null;
  status: Task["status"];
  progress_value: number;
  progress_target: number;
  unit: Task["unit"];
  delay_days: number;
}

export interface TransactionRow {
  id: string;
  project_id: string | null;
  party_id: string | null;
  date: string;
  direction: Transaction["direction"];
  amount: number;
  cost_code: Transaction["costCode"];
  category: Transaction["category"];
  note: string | null;
}

/* ---------- mappers ---------- */

export const mapClient = (r: ClientRow): Client => ({
  id: r.id,
  name: r.name,
  company: r.company ?? "",
  email: r.email ?? "",
  phone: r.phone ?? "",
  address: r.address ?? "",
  gst: r.gst ?? "",
  createdAt: r.created_at,
});

export const mapProject = (r: ProjectRow): Project => ({
  id: r.id,
  code: r.code,
  name: r.name,
  clientId: r.client_id ?? "",
  value: Number(r.value),
  status: r.status,
  startDate: r.start_date ?? "",
  endDate: r.end_date ?? "",
  percentComplete: Number(r.percent_complete),
  location: r.location ?? "",
  pmId: r.pm_id ?? "",
});

export const mapLineItem = (r: LineItemRow): LineItem => ({
  id: r.id,
  description: r.description,
  costCode: r.cost_code ?? undefined,
  qty: Number(r.qty),
  unit: r.unit ?? "",
  rate: Number(r.rate),
});

export const mapQuotation = (r: QuotationRow): Quotation => ({
  id: r.id,
  number: r.number,
  clientId: r.client_id ?? "",
  projectName: r.project_name ?? "",
  date: r.date,
  validUntil: r.valid_until ?? "",
  status: r.status,
  taxRate: Number(r.tax_rate),
  items: (r.quotation_items ?? []).map(mapLineItem),
});

export const mapInvoice = (r: InvoiceRow): SalesInvoice => ({
  id: r.id,
  number: r.number,
  projectId: r.project_id ?? "",
  clientId: r.client_id ?? "",
  date: r.date,
  dueDate: r.due_date ?? "",
  taxRate: Number(r.tax_rate),
  received: Number(r.received),
  status: r.status,
  items: (r.invoice_items ?? []).map(mapLineItem),
});

export const mapBoq = (r: BoqRow): Boq => ({
  id: r.id,
  projectId: r.project_id,
  items: (r.boq_items ?? []).map((it) => ({
    ...mapLineItem(it),
    costCode: it.cost_code,
  })),
});

export const mapTask = (r: TaskRow): Task => ({
  id: r.id,
  projectId: r.project_id,
  parentId: r.parent_id,
  name: r.name,
  assigneeId: r.assignee_id,
  startDate: r.start_date ?? "",
  endDate: r.end_date ?? "",
  status: r.status,
  progressValue: Number(r.progress_value),
  progressTarget: Number(r.progress_target),
  unit: r.unit,
  delayDays: r.delay_days,
});

export interface DrawingVersionRow {
  id: string;
  rev: string;
  date: string;
  by_id: string | null;
  notes: string | null;
  file_kb: number;
}

export interface DrawingRow {
  id: string;
  project_id: string;
  title: string;
  discipline: Drawing["discipline"];
  current_rev: string | null;
  status: Drawing["status"];
  drawing_versions?: DrawingVersionRow[];
}

const mapDrawingVersion = (r: DrawingVersionRow): DrawingVersion => ({
  rev: r.rev,
  date: r.date,
  byId: r.by_id ?? "",
  notes: r.notes ?? "",
  fileKb: r.file_kb,
});

export const mapDrawing = (r: DrawingRow): Drawing => ({
  id: r.id,
  projectId: r.project_id,
  title: r.title,
  discipline: r.discipline,
  currentRev: r.current_rev ?? "",
  status: r.status,
  versions: (r.drawing_versions ?? [])
    .map(mapDrawingVersion)
    .sort((a, b) => +new Date(a.date) - +new Date(b.date)),
});

export interface UserRow {
  id: string;
  name: string;
  avatar_color: string | null;
  initials: string | null;
  role?: User["role"] | null;
}

export const mapUser = (r: UserRow): User => ({
  id: r.id,
  name: r.name,
  role: r.role ?? "engineer",
  avatarColor: r.avatar_color ?? "#1e3a5f",
  initials: r.initials ?? "",
});

export interface SupplierRow {
  id: string;
  name: string;
  company: string | null;
  contact: string | null;
  phone: string | null;
  email: string | null;
  gst: string | null;
  address: string | null;
}

export const mapSupplier = (r: SupplierRow): Supplier => ({
  id: r.id,
  name: r.name,
  company: r.company ?? "",
  contact: r.contact ?? "",
  phone: r.phone ?? "",
  email: r.email ?? "",
  gst: r.gst ?? "",
  address: r.address ?? "",
});

export interface MaterialItemRow {
  id: string;
  name: string;
  category: MaterialItem["category"];
  unit: string;
  stock_qty: number;
  reorder_level: number;
  rate: number;
}

export const mapMaterialItem = (r: MaterialItemRow): MaterialItem => ({
  id: r.id,
  name: r.name,
  category: r.category,
  unit: r.unit,
  stockQty: Number(r.stock_qty),
  reorderLevel: Number(r.reorder_level),
  rate: Number(r.rate),
});

export interface MaterialRequestLineRow {
  material_item_id: string | null;
  qty: number;
}

export interface MaterialRequestRow {
  id: string;
  number: string;
  project_id: string | null;
  by_id: string | null;
  date: string;
  status: MaterialRequest["status"];
  note: string | null;
  material_request_lines?: MaterialRequestLineRow[];
}

export const mapMaterialRequest = (r: MaterialRequestRow): MaterialRequest => ({
  id: r.id,
  number: r.number,
  projectId: r.project_id ?? "",
  byId: r.by_id ?? "",
  date: r.date,
  status: r.status,
  note: r.note ?? "",
  lines: (r.material_request_lines ?? []).map((l) => ({
    materialItemId: l.material_item_id ?? "",
    qty: Number(l.qty),
  })),
});

export interface PoItemRow {
  id: string;
  description: string;
  material_item_id: string | null;
  qty: number;
  unit: string | null;
  rate: number;
}

const mapPoItem = (r: PoItemRow): PoItem => ({
  id: r.id,
  description: r.description,
  materialItemId: r.material_item_id,
  qty: Number(r.qty),
  unit: r.unit ?? "",
  rate: Number(r.rate),
});

export interface PurchaseOrderRow {
  id: string;
  number: string;
  supplier_id: string | null;
  project_id: string | null;
  date: string;
  status: PurchaseOrder["status"];
  tax_rate: number;
  discount: number;
  terms: string | null;
  payment_terms: string | null;
  po_items?: PoItemRow[];
}

export const mapPurchaseOrder = (r: PurchaseOrderRow): PurchaseOrder => ({
  id: r.id,
  number: r.number,
  supplierId: r.supplier_id ?? "",
  projectId: r.project_id ?? "",
  date: r.date,
  status: r.status,
  taxRate: Number(r.tax_rate),
  discount: Number(r.discount),
  terms: r.terms ?? "",
  paymentTerms: r.payment_terms ?? "",
  items: (r.po_items ?? []).map(mapPoItem),
});

export interface MaterialUsageRow {
  id: string;
  project_id: string | null;
  material_item_id: string | null;
  qty: number;
  date: string;
  ref: string | null;
}

export const mapMaterialUsage = (r: MaterialUsageRow): MaterialUsage => ({
  id: r.id,
  projectId: r.project_id ?? "",
  materialItemId: r.material_item_id ?? "",
  qty: Number(r.qty),
  date: r.date,
  ref: r.ref ?? "",
});

export interface SubcontractorRow {
  id: string;
  name: string;
  company: string | null;
  trade: Subcontractor["trade"];
  contact: string | null;
  phone: string | null;
  gst: string | null;
}

export const mapSubcontractor = (r: SubcontractorRow): Subcontractor => ({
  id: r.id,
  name: r.name,
  company: r.company ?? "",
  trade: r.trade,
  contact: r.contact ?? "",
  phone: r.phone ?? "",
  gst: r.gst ?? "",
});

export interface WoItemRow {
  id: string;
  description: string;
  qty: number;
  unit: string | null;
  rate: number;
}

const mapWoItem = (r: WoItemRow): WoItem => ({
  id: r.id,
  description: r.description,
  qty: Number(r.qty),
  unit: r.unit ?? "",
  rate: Number(r.rate),
});

export interface SubconWorkOrderRow {
  id: string;
  number: string;
  subcontractor_id: string | null;
  project_id: string | null;
  date: string;
  status: SubconWorkOrder["status"];
  tax_rate: number;
  signatory: string | null;
  wo_items?: WoItemRow[];
}

export const mapWorkOrder = (r: SubconWorkOrderRow): SubconWorkOrder => ({
  id: r.id,
  number: r.number,
  subcontractorId: r.subcontractor_id ?? "",
  projectId: r.project_id ?? "",
  date: r.date,
  status: r.status,
  taxRate: Number(r.tax_rate),
  signatory: r.signatory ?? "",
  items: (r.wo_items ?? []).map(mapWoItem),
});

export interface SubconProgressRow {
  id: string;
  work_order_id: string;
  date: string;
  percent: number;
  note: string | null;
}

export const mapSubconProgress = (r: SubconProgressRow): SubconProgress => ({
  id: r.id,
  workOrderId: r.work_order_id,
  date: r.date,
  percent: Number(r.percent),
  note: r.note ?? "",
});

export interface MaterialIssueRow {
  id: string;
  subcontractor_id: string | null;
  project_id: string | null;
  material_item_id: string | null;
  qty: number;
  date: string;
}

export const mapMaterialIssue = (r: MaterialIssueRow): MaterialIssue => ({
  id: r.id,
  subcontractorId: r.subcontractor_id ?? "",
  projectId: r.project_id ?? "",
  materialItemId: r.material_item_id ?? "",
  qty: Number(r.qty),
  date: r.date,
});

export interface RaBillRow {
  id: string;
  number: string;
  work_order_id: string;
  date: string;
  percent_complete: number;
  gross_amount: number;
  deductions: number;
  net_amount: number;
  status: RaBill["status"];
}

export const mapRaBill = (r: RaBillRow): RaBill => ({
  id: r.id,
  number: r.number,
  workOrderId: r.work_order_id,
  date: r.date,
  percentComplete: Number(r.percent_complete),
  grossAmount: Number(r.gross_amount),
  deductions: Number(r.deductions),
  netAmount: Number(r.net_amount),
  status: r.status,
});

export interface EquipmentRow {
  id: string;
  code: string;
  name: string;
  kind: Equipment["kind"];
  ownership: Equipment["ownership"];
  status: Equipment["status"];
  project_id: string | null;
  monthly_rate: number;
  acquired_date: string | null;
}

export const mapEquipment = (r: EquipmentRow): Equipment => ({
  id: r.id,
  code: r.code,
  name: r.name,
  kind: r.kind,
  ownership: r.ownership,
  status: r.status,
  projectId: r.project_id,
  monthlyRate: Number(r.monthly_rate),
  acquiredDate: r.acquired_date ?? "",
});

export const mapTransaction = (r: TransactionRow): Transaction => ({
  id: r.id,
  projectId: r.project_id ?? "",
  partyId: r.party_id,
  date: r.date,
  direction: r.direction,
  amount: Number(r.amount),
  costCode: r.cost_code,
  category: r.category,
  note: r.note ?? "",
});

/* ==========================================================================
 * Client-store entities: forward mappers (row -> domain) + inverse writers
 * (domain -> insertable row). Used by the Supabase-backed project/category
 * stores for reads, Realtime patches, and writes. Kept server-free so the
 * browser store can import them.
 * ======================================================================== */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Postgres uuid/FK columns reject non-uuid ids (e.g. mock "u1"); null them. */
export const uuidOrNull = (v?: string | null): string | null =>
  v && UUID_RE.test(v) ? v : null;

/** Empty date strings must become NULL, not '' (invalid for a date column). */
const dateOrNull = (v?: string | null): string | null => (v ? v : null);

/* ---------- DPR ---------- */
export interface DprRow {
  id: string;
  project_id: string;
  date: string;
  author_id: string | null;
  weather: string | null;
  work_done: string | null;
  labour_count: number;
  photos: number;
  photo_urls?: string[] | null;
}

export const mapDpr = (r: DprRow): Dpr => ({
  id: r.id,
  projectId: r.project_id,
  date: r.date,
  authorId: r.author_id ?? "",
  weather: r.weather ?? "",
  workDone: r.work_done ?? "",
  labourCount: Number(r.labour_count),
  photos: Number(r.photos),
  photoUrls: r.photo_urls ?? [],
});

export const toDprRow = (d: Omit<Dpr, "id">, orgId: string, userId: string | null) => ({
  org_id: orgId,
  project_id: d.projectId,
  date: d.date,
  author_id: uuidOrNull(userId ?? d.authorId),
  weather: d.weather,
  work_done: d.workDone,
  labour_count: d.labourCount,
  photos: d.photos,
  photo_urls: d.photoUrls ?? [],
});

/* ---------- Site instruction ---------- */
export interface SiteInstructionRow {
  id: string;
  project_id: string;
  date: string;
  by_id: string | null;
  text: string;
  priority: SiteInstruction["priority"];
}

export const mapInstruction = (r: SiteInstructionRow): SiteInstruction => ({
  id: r.id,
  projectId: r.project_id,
  date: r.date,
  byId: r.by_id ?? "",
  text: r.text,
  priority: r.priority,
});

export const toInstructionRow = (
  s: Omit<SiteInstruction, "id">,
  orgId: string,
  userId: string | null
) => ({
  org_id: orgId,
  project_id: s.projectId,
  date: s.date,
  by_id: uuidOrNull(userId ?? s.byId),
  text: s.text,
  priority: s.priority,
});

/* ---------- Labour attendance ---------- */
export interface LabourAttendanceRow {
  id: string;
  contractor_id: string | null;
  project_id: string | null;
  date: string;
  shift: LabourAttendance["shift"];
  present: number;
  absent: number;
  gps: string | null;
}

export const mapAttendance = (r: LabourAttendanceRow): LabourAttendance => ({
  id: r.id,
  contractorId: r.contractor_id ?? "",
  projectId: r.project_id ?? "",
  date: r.date,
  shift: r.shift,
  present: Number(r.present),
  absent: Number(r.absent),
  gps: r.gps ?? "",
});

export const toAttendanceRow = (a: Omit<LabourAttendance, "id">, orgId: string) => ({
  org_id: orgId,
  contractor_id: uuidOrNull(a.contractorId),
  project_id: uuidOrNull(a.projectId),
  date: a.date,
  shift: a.shift,
  present: a.present,
  absent: a.absent,
  gps: a.gps,
});

/* ---------- Employee ---------- */
export interface EmployeeRow {
  id: string;
  name: string;
  designation: string | null;
  department: Employee["department"];
  monthly_ctc: number;
  join_date: string | null;
  phone: string | null;
  initials: string | null;
  avatar_color: string | null;
}

export const mapEmployee = (r: EmployeeRow): Employee => ({
  id: r.id,
  name: r.name,
  designation: r.designation ?? "",
  department: r.department,
  monthlyCtc: Number(r.monthly_ctc),
  joinDate: r.join_date ?? "",
  phone: r.phone ?? "",
  initials: r.initials ?? "",
  avatarColor: r.avatar_color ?? "#1e3a5f",
});

export const toEmployeeRow = (e: Omit<Employee, "id">, orgId: string) => ({
  org_id: orgId,
  name: e.name,
  designation: e.designation,
  department: e.department,
  monthly_ctc: e.monthlyCtc,
  join_date: dateOrNull(e.joinDate),
  phone: e.phone,
  initials: e.initials,
  avatar_color: e.avatarColor,
});

/** Partial employee patch (camel -> snake) for updates; only present keys. */
export const toEmployeePatch = (p: Partial<Employee>): Record<string, unknown> => {
  const row: Record<string, unknown> = {};
  if (p.name !== undefined) row.name = p.name;
  if (p.designation !== undefined) row.designation = p.designation;
  if (p.department !== undefined) row.department = p.department;
  if (p.monthlyCtc !== undefined) row.monthly_ctc = p.monthlyCtc;
  if (p.joinDate !== undefined) row.join_date = dateOrNull(p.joinDate);
  if (p.phone !== undefined) row.phone = p.phone;
  if (p.initials !== undefined) row.initials = p.initials;
  if (p.avatarColor !== undefined) row.avatar_color = p.avatarColor;
  return row;
};

/* ---------- Expense ---------- */
export interface ExpenseRow {
  id: string;
  project_id: string | null;
  date: string;
  category: string;
  cost_code: string;
  amount: number;
  note: string | null;
  status: Expense["status"];
  by_id: string | null;
}

export const mapExpense = (r: ExpenseRow): Expense => ({
  id: r.id,
  projectId: r.project_id ?? "",
  date: r.date,
  category: r.category,
  costCode: r.cost_code,
  amount: Number(r.amount),
  note: r.note ?? "",
  status: r.status,
  byId: r.by_id ?? "",
});

export const toExpenseRow = (
  e: Omit<Expense, "id">,
  orgId: string,
  userId: string | null
) => ({
  org_id: orgId,
  project_id: uuidOrNull(e.projectId),
  date: e.date,
  category: e.category,
  cost_code: e.costCode,
  amount: e.amount,
  note: e.note,
  status: e.status,
  by_id: uuidOrNull(userId ?? e.byId),
});

/* ---------- Activity log ---------- */
export interface ActivityLogRow {
  id: string;
  project_id: string | null;
  action: ActivityLogEntry["action"];
  entity: ActivityLogEntry["entity"];
  entity_id: string | null;
  logged_at: string;
  user_id: string | null;
  details: string | null;
}

export const mapActivity = (r: ActivityLogRow): ActivityLogEntry => ({
  id: r.id,
  projectId: r.project_id ?? "",
  action: r.action,
  entity: r.entity,
  entityId: r.entity_id ?? "",
  timestamp: r.logged_at,
  userId: r.user_id ?? "",
  details: r.details ?? "",
});

export const toActivityRow = (
  e: Omit<ActivityLogEntry, "id" | "timestamp">,
  orgId: string
) => ({
  org_id: orgId,
  project_id: uuidOrNull(e.projectId),
  action: e.action,
  entity: e.entity,
  entity_id: e.entityId,
  user_id: uuidOrNull(e.userId),
  details: e.details,
});

/* ---------- Project (inverse only; mapProject already defined) ---------- */
export const toProjectRow = (p: Omit<Project, "id">, orgId: string) => ({
  org_id: orgId,
  code: p.code,
  name: p.name,
  client_id: uuidOrNull(p.clientId),
  value: p.value,
  status: p.status,
  start_date: dateOrNull(p.startDate),
  end_date: dateOrNull(p.endDate),
  percent_complete: p.percentComplete,
  location: p.location,
  pm_id: uuidOrNull(p.pmId),
});

/* ---------- Task (inverse; mapTask already defined) ---------- */
export const toTaskRow = (t: Omit<Task, "id">, orgId: string) => ({
  org_id: orgId,
  project_id: t.projectId,
  parent_id: uuidOrNull(t.parentId),
  name: t.name,
  assignee_id: uuidOrNull(t.assigneeId),
  start_date: dateOrNull(t.startDate),
  end_date: dateOrNull(t.endDate),
  status: t.status,
  progress_value: t.progressValue,
  progress_target: t.progressTarget,
  unit: t.unit,
  delay_days: t.delayDays,
});

/** Partial task patch (camel -> snake) for updates; only present keys emitted. */
export const toTaskPatch = (p: Partial<Task>): Record<string, unknown> => {
  const row: Record<string, unknown> = {};
  if (p.projectId !== undefined) row.project_id = p.projectId;
  if (p.parentId !== undefined) row.parent_id = uuidOrNull(p.parentId);
  if (p.name !== undefined) row.name = p.name;
  if (p.assigneeId !== undefined) row.assignee_id = uuidOrNull(p.assigneeId);
  if (p.startDate !== undefined) row.start_date = dateOrNull(p.startDate);
  if (p.endDate !== undefined) row.end_date = dateOrNull(p.endDate);
  if (p.status !== undefined) row.status = p.status;
  if (p.progressValue !== undefined) row.progress_value = p.progressValue;
  if (p.progressTarget !== undefined) row.progress_target = p.progressTarget;
  if (p.unit !== undefined) row.unit = p.unit;
  if (p.delayDays !== undefined) row.delay_days = p.delayDays;
  return row;
};

/* ---------- Transaction (inverse; mapTransaction already defined) ---------- */
export const toTransactionRow = (t: Omit<Transaction, "id">, orgId: string) => ({
  org_id: orgId,
  project_id: uuidOrNull(t.projectId),
  party_id: uuidOrNull(t.partyId),
  date: t.date,
  direction: t.direction,
  amount: t.amount,
  cost_code: t.costCode,
  category: t.category,
  note: t.note,
});

/* ---------- Invoice (inverse; mapInvoice already defined) ---------- */
export const toInvoiceRow = (i: Omit<SalesInvoice, "id">, orgId: string) => ({
  org_id: orgId,
  number: i.number,
  project_id: uuidOrNull(i.projectId),
  client_id: uuidOrNull(i.clientId),
  date: i.date,
  due_date: dateOrNull(i.dueDate),
  tax_rate: i.taxRate,
  received: i.received,
  status: i.status,
});

export const toInvoiceItemRows = (
  items: LineItem[],
  orgId: string,
  invoiceId: string
) =>
  items.map((it) => ({
    org_id: orgId,
    invoice_id: invoiceId,
    description: it.description,
    qty: it.qty,
    unit: it.unit,
    rate: it.rate,
  }));
