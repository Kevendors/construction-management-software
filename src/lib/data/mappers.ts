// Translate snake_case Postgres rows into the camelCase domain types the UI
// renders against. One mapper per table; keeps query files declarative.

import type {
  Boq,
  BoqItem,
  Client,
  Drawing,
  DrawingVersion,
  Equipment,
  Expense,
  LineItem,
  MaterialIssue,
  MaterialItem,
  MaterialRequest,
  MaterialUsage,
  PoItem,
  Project,
  ProjectMember,
  PurchaseOrder,
  Quotation,
  RaBill,
  SalesInvoice,
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
  geofence_lat?: number | null;
  geofence_lng?: number | null;
  geofence_radius_m?: number | null;
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

export interface ExpenseRow {
  id: string;
  title: string | null;
  project_id: string | null;
  date: string;
  category: Expense["category"];
  cost_code: Expense["costCode"];
  amount: number;
  payment_mode: string | null;
  note: string | null;
  status: Expense["status"];
  by_id: string | null;
  bill_path: string | null;
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
  geofenceLat: r.geofence_lat ?? null,
  geofenceLng: r.geofence_lng ?? null,
  geofenceRadiusM: r.geofence_radius_m ?? null,
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

export interface ProjectMemberRow {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectMember["role"];
}

export const mapProjectMember = (r: ProjectMemberRow): ProjectMember => ({
  id: r.id,
  projectId: r.project_id,
  userId: r.user_id,
  role: r.role,
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

export const mapExpense = (r: ExpenseRow): Expense => ({
  id: r.id,
  title: r.title ?? "",
  projectId: r.project_id ?? "",
  date: r.date,
  category: r.category,
  costCode: r.cost_code,
  amount: Number(r.amount),
  paymentMode: r.payment_mode ?? "",
  note: r.note ?? "",
  status: r.status,
  byId: r.by_id ?? "",
  billPath: r.bill_path ?? "",
});
