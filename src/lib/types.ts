// Domain types for SiteHub. These mirror the planned Postgres schema
// (see PLAN.md §C.3) but are the shape the UI renders against the mock layer.

export type Role =
  | "super_admin"
  | "pm"
  | "supervisor"
  | "accountant"
  | "hr"
  | "staff"
  | "architect"
  | "engineer"
  | "subcontractor"
  | "viewer"
  | "client";

export type ProjectStatus = "planning" | "ongoing" | "on_hold" | "completed";

export type TaskStatus = "not_started" | "ongoing" | "delayed" | "completed";

export type ProgressUnit = "meter" | "numbers" | "sqft" | "lumpsum" | "percent";

export type CostCode = "material" | "machinery" | "diesel" | "labour" | "other";

export type TxnDirection = "in" | "out";

export type ExpenseCategory =
  | "material"
  | "salary"
  | "site"
  | "subcon"
  | "other";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface User {
  id: string;
  name: string;
  role: Role;
  avatarColor: string;
  initials: string;
}

export interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  gst: string;
  createdAt: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  clientId: string;
  value: number;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  percentComplete: number;
  location: string;
  pmId: string;
  /** Optional site geo-fence (all three null = fence disabled). */
  geofenceLat: number | null;
  geofenceLng: number | null;
  geofenceRadiusM: number | null;
}

/** A user's assignment to a single project (drives per-project visibility). */
export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: Role;
}

export interface Task {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
  assigneeId: string | null;
  startDate: string;
  endDate: string;
  status: TaskStatus;
  progressValue: number;
  progressTarget: number;
  unit: ProgressUnit;
  delayDays: number;
}

export interface Dpr {
  id: string;
  projectId: string;
  date: string;
  authorId: string;
  weather: string;
  workDone: string;
  labourCount: number;
  photos: number;
  /** Uploaded site photos as compressed data URLs (client-stored). */
  photoUrls?: string[];
}

export interface SiteInstruction {
  id: string;
  projectId: string;
  date: string;
  byId: string;
  text: string;
  priority: "low" | "medium" | "high";
}

export interface ProjectFile {
  id: string;
  projectId: string;
  name: string;
  kind: "photo" | "pdf" | "dwg" | "doc";
  sizeKb: number;
  uploadedAt: string;
  uploadedById: string;
}

export interface Drawing {
  id: string;
  projectId: string;
  title: string;
  discipline: "architectural" | "structural" | "mep" | "interior";
  currentRev: string;
  status: "draft" | "for_review" | "approved" | "superseded";
  versions: DrawingVersion[];
}

export interface DrawingVersion {
  rev: string;
  date: string;
  byId: string;
  notes: string;
  fileKb: number;
}

export interface LineItem {
  id: string;
  description: string;
  costCode?: CostCode;
  qty: number;
  unit: string;
  rate: number;
}

export interface Quotation {
  id: string;
  number: string;
  clientId: string;
  projectName: string;
  date: string;
  validUntil: string;
  status: "draft" | "sent" | "accepted" | "rejected";
  items: LineItem[];
  taxRate: number;
}

export interface BoqItem extends LineItem {
  costCode: CostCode;
}

export interface Boq {
  id: string;
  projectId: string;
  items: BoqItem[];
}

export interface SalesInvoice {
  id: string;
  number: string;
  projectId: string;
  clientId: string;
  date: string;
  dueDate: string;
  items: LineItem[];
  taxRate: number;
  received: number;
  status: "draft" | "sent" | "partial" | "paid" | "overdue";
}

export interface Transaction {
  id: string;
  projectId: string;
  partyId: string | null;
  date: string;
  direction: TxnDirection;
  amount: number;
  // Category & cost code are dynamic (org master lists), so plain strings.
  costCode: CostCode | string;
  category: ExpenseCategory | string;
  note: string;
}

export interface Expense {
  id: string;
  title?: string;
  projectId: string;
  date: string;
  category: ExpenseCategory;
  costCode: CostCode;
  amount: number;
  paymentMode?: string;
  note: string;
  status: ApprovalStatus;
  byId: string;
  /** Storage path of the uploaded bill/receipt (empty if none). */
  billPath?: string;
  /** Signed URL for the bill, minted server-side on load. */
  billUrl?: string;
}

export interface AttendanceDay {
  date: string;
  present: number;
  absent: number;
}

/* ------------------------------------------------------------------ */
/* Phase 2 — Material & Subcontractor                                  */
/* ------------------------------------------------------------------ */

export type POStatus = "draft" | "sent" | "received" | "closed";
export type WOStatus = "draft" | "issued" | "in_progress" | "completed";
export type RAStatus = "draft" | "submitted" | "certified" | "paid";

export type MaterialCategory =
  | "cement"
  | "steel"
  | "aggregate"
  | "blocks"
  | "electrical"
  | "plumbing"
  | "finishes"
  | "consumables";

export type Trade =
  | "rcc"
  | "mep"
  | "plumbing"
  | "electrical"
  | "facade"
  | "finishes"
  | "waterproofing";

export interface Supplier {
  id: string;
  name: string;
  company: string;
  contact: string;
  phone: string;
  email: string;
  gst: string;
  address: string;
}

export interface Subcontractor {
  id: string;
  name: string;
  company: string;
  trade: Trade;
  contact: string;
  phone: string;
  gst: string;
}

export interface MaterialItem {
  id: string;
  name: string;
  category: MaterialCategory;
  unit: string;
  stockQty: number;
  reorderLevel: number;
  rate: number;
}

export interface MaterialRequestLine {
  materialItemId: string;
  qty: number;
}

export interface MaterialRequest {
  id: string;
  number: string;
  projectId: string;
  byId: string;
  date: string;
  status: ApprovalStatus;
  lines: MaterialRequestLine[];
  note: string;
}

export interface PoItem {
  id: string;
  description: string;
  materialItemId: string | null;
  qty: number;
  unit: string;
  rate: number;
}

export interface PurchaseOrder {
  id: string;
  number: string;
  supplierId: string;
  projectId: string;
  date: string;
  status: POStatus;
  items: PoItem[];
  taxRate: number;
  discount: number;
  terms: string;
  paymentTerms: string;
}

export interface GoodsReceiptLine {
  poItemId: string;
  qtyReceived: number;
}

export interface GoodsReceipt {
  id: string;
  number: string;
  poId: string;
  date: string;
  byId: string;
  lines: GoodsReceiptLine[];
}

export interface PurchaseBooking {
  id: string;
  poId: string;
  billNo: string;
  date: string;
  amount: number;
  status: "booked" | "paid";
}

export interface MaterialUsage {
  id: string;
  projectId: string;
  materialItemId: string;
  qty: number;
  date: string;
  ref: string;
}

export interface WoItem {
  id: string;
  description: string;
  qty: number;
  unit: string;
  rate: number;
}

export interface SubconWorkOrder {
  id: string;
  number: string;
  subcontractorId: string;
  projectId: string;
  date: string;
  status: WOStatus;
  items: WoItem[];
  taxRate: number;
  signatory: string;
}

export interface SubconProgress {
  id: string;
  workOrderId: string;
  date: string;
  percent: number;
  note: string;
}

export interface MaterialIssue {
  id: string;
  subcontractorId: string;
  projectId: string;
  materialItemId: string;
  qty: number;
  date: string;
}

export interface RaBill {
  id: string;
  number: string;
  workOrderId: string;
  date: string;
  percentComplete: number;
  grossAmount: number;
  deductions: number;
  netAmount: number;
  status: RAStatus;
}

/* ------------------------------------------------------------------ */
/* Phase 3 — Payroll, Attendance, Expenses, Equipment                  */
/* ------------------------------------------------------------------ */

export type Department = "engineering" | "design" | "site" | "accounts" | "admin";
export type SalarySlipStatus = "draft" | "finalised" | "paid";
export type Shift = "general" | "first" | "second";
export type AdvanceParty = "employee" | "contractor";
export type AdvanceStatus = "open" | "settling" | "cleared";
export type EquipmentKind = "machinery" | "tool" | "asset";
export type EquipmentStatus = "in_use" | "idle" | "maintenance";
export type Ownership = "owned" | "rented";
export type LedgerDirection = "received" | "paid";

export interface Employee {
  id: string;
  name: string;
  designation: string;
  department: Department;
  monthlyCtc: number;
  joinDate: string;
  phone: string;
  initials: string;
  avatarColor: string;
}

export interface SalarySlip {
  id: string;
  employeeId: string;
  month: string; // "2026-05"
  paidDays: number;
  monthDays: number;
  basic: number;
  hra: number;
  allowances: number;
  pf: number;
  esi: number;
  advanceDeduction: number;
  status: SalarySlipStatus;
}

export interface LabourContractor {
  id: string;
  name: string;
  company: string;
  trade: Trade;
  phone: string;
  headcount: number;
  dayRate: number; // avg wage per head per shift
}

export interface LabourAttendance {
  id: string;
  contractorId: string;
  projectId: string;
  date: string;
  shift: Shift;
  present: number;
  absent: number;
  gps: string; // "28.6139, 77.2090"
}

/**
 * Per-employee GPS + selfie attendance — one record per user per day.
 * Keyed on the login (memberships.user_id); `employeeId` is the KV### code
 * from memberships.employee_id ("" until migration 0015 is applied).
 */
export interface EmployeeAttendance {
  id: string;
  userId: string;
  employeeId: string;
  userName: string;
  projectId: string;
  date: string; // "2026-07-17" (org-local day)
  checkInAt: string; // ISO timestamp
  checkInLat: number | null;
  checkInLng: number | null;
  checkInSelfiePath: string;
  checkOutAt: string; // "" while still checked in
  checkOutLat: number | null;
  checkOutLng: number | null;
  checkOutSelfiePath: string;
  totalMinutes: number; // 0 until check-out
  overtimeMinutes: number;
}

export interface Advance {
  id: string;
  partyType: AdvanceParty;
  partyId: string;
  date: string;
  amount: number;
  recovered: number;
  status: AdvanceStatus;
  note: string;
}

export interface Equipment {
  id: string;
  code: string;
  name: string;
  kind: EquipmentKind;
  ownership: Ownership;
  status: EquipmentStatus;
  projectId: string | null;
  monthlyRate: number; // rental or depreciation per month
  acquiredDate: string;
}

export interface SupervisorLedgerEntry {
  id: string;
  supervisorId: string; // user id
  projectId: string;
  date: string;
  direction: LedgerDirection; // received = advance from office, paid = spent at site
  amount: number;
  note: string;
}

export type NotificationKind = "approval" | "delay" | "payment" | "stock" | "info";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  date: string;
  read: boolean;
  href?: string;
}
