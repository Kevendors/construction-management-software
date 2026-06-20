import type {
  AdvanceStatus,
  ApprovalStatus,
  CostCode,
  Department,
  EquipmentKind,
  EquipmentStatus,
  MaterialCategory,
  Ownership,
  POStatus,
  ProjectStatus,
  RAStatus,
  SalarySlipStatus,
  Shift,
  TaskStatus,
  Trade,
  WOStatus,
} from "@/lib/types";

type Variant =
  | "default"
  | "secondary"
  | "outline"
  | "success"
  | "warning"
  | "destructive"
  | "info"
  | "muted";

export const taskStatusMeta: Record<TaskStatus, { label: string; variant: Variant }> = {
  not_started: { label: "Not Started", variant: "muted" },
  ongoing: { label: "Ongoing", variant: "info" },
  delayed: { label: "Delayed", variant: "destructive" },
  completed: { label: "Completed", variant: "success" },
};

export const projectStatusMeta: Record<ProjectStatus, { label: string; variant: Variant }> = {
  planning: { label: "Planning", variant: "muted" },
  ongoing: { label: "Ongoing", variant: "info" },
  on_hold: { label: "On Hold", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
};

export const approvalMeta: Record<ApprovalStatus, { label: string; variant: Variant }> = {
  pending: { label: "Pending", variant: "warning" },
  approved: { label: "Approved", variant: "success" },
  rejected: { label: "Rejected", variant: "destructive" },
};

export const costCodeLabel: Record<CostCode, string> = {
  material: "Material",
  machinery: "Machinery",
  diesel: "Diesel",
  labour: "Labour",
  other: "Other",
};

export const categoryLabel: Record<string, string> = {
  material: "Material",
  salary: "Salary",
  site: "Site",
  subcon: "Subcon",
  other: "Other",
};

export const roleLabel: Record<string, string> = {
  admin: "Admin",
  pm: "Project Manager",
  architect: "Architect",
  engineer: "Site Engineer",
  accountant: "Accountant",
  subcontractor: "Subcontractor",
  client: "Client",
};

export const invoiceStatusMeta: Record<string, { label: string; variant: Variant }> = {
  draft: { label: "Draft", variant: "muted" },
  sent: { label: "Sent", variant: "info" },
  partial: { label: "Partial", variant: "warning" },
  paid: { label: "Paid", variant: "success" },
  overdue: { label: "Overdue", variant: "destructive" },
};

export const quotationStatusMeta: Record<string, { label: string; variant: Variant }> = {
  draft: { label: "Draft", variant: "muted" },
  sent: { label: "Sent", variant: "info" },
  accepted: { label: "Accepted", variant: "success" },
  rejected: { label: "Rejected", variant: "destructive" },
};

export const drawingStatusMeta: Record<string, { label: string; variant: Variant }> = {
  draft: { label: "Draft", variant: "muted" },
  for_review: { label: "For Review", variant: "warning" },
  approved: { label: "Approved", variant: "success" },
  superseded: { label: "Superseded", variant: "outline" },
};

/* ---------- Phase 2 ---------- */

export const poStatusMeta: Record<POStatus, { label: string; variant: Variant }> = {
  draft: { label: "Draft", variant: "muted" },
  sent: { label: "Sent", variant: "info" },
  received: { label: "Received", variant: "success" },
  closed: { label: "Closed", variant: "outline" },
};

export const woStatusMeta: Record<WOStatus, { label: string; variant: Variant }> = {
  draft: { label: "Draft", variant: "muted" },
  issued: { label: "Issued", variant: "info" },
  in_progress: { label: "In Progress", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
};

export const raStatusMeta: Record<RAStatus, { label: string; variant: Variant }> = {
  draft: { label: "Draft", variant: "muted" },
  submitted: { label: "Submitted", variant: "warning" },
  certified: { label: "Certified", variant: "info" },
  paid: { label: "Paid", variant: "success" },
};

export const bookingStatusMeta: Record<string, { label: string; variant: Variant }> = {
  booked: { label: "Booked", variant: "warning" },
  paid: { label: "Paid", variant: "success" },
};

export const tradeLabel: Record<Trade, string> = {
  rcc: "RCC",
  mep: "MEP",
  plumbing: "Plumbing",
  electrical: "Electrical",
  facade: "Facade",
  finishes: "Finishes",
  waterproofing: "Waterproofing",
};

export const materialCategoryLabel: Record<MaterialCategory, string> = {
  cement: "Cement",
  steel: "Steel",
  aggregate: "Aggregate",
  blocks: "Blocks",
  electrical: "Electrical",
  plumbing: "Plumbing",
  finishes: "Finishes",
  consumables: "Consumables",
};

/* ---------- Phase 3 ---------- */

export const departmentLabel: Record<Department, string> = {
  engineering: "Engineering",
  design: "Design",
  site: "Site",
  accounts: "Accounts",
  admin: "Admin",
};

export const shiftLabel: Record<Shift, string> = {
  general: "General",
  first: "First",
  second: "Second",
};

export const salarySlipStatusMeta: Record<SalarySlipStatus, { label: string; variant: Variant }> = {
  draft: { label: "Draft", variant: "muted" },
  finalised: { label: "Finalised", variant: "info" },
  paid: { label: "Paid", variant: "success" },
};

export const advanceStatusMeta: Record<AdvanceStatus, { label: string; variant: Variant }> = {
  open: { label: "Open", variant: "warning" },
  settling: { label: "Settling", variant: "info" },
  cleared: { label: "Cleared", variant: "success" },
};

export const equipmentStatusMeta: Record<EquipmentStatus, { label: string; variant: Variant }> = {
  in_use: { label: "In Use", variant: "success" },
  idle: { label: "Idle", variant: "muted" },
  maintenance: { label: "Maintenance", variant: "warning" },
};

export const equipmentKindLabel: Record<EquipmentKind, string> = {
  machinery: "Machinery",
  tool: "Tool",
  asset: "Asset",
};

export const ownershipMeta: Record<Ownership, { label: string; variant: Variant }> = {
  owned: { label: "Owned", variant: "outline" },
  rented: { label: "Rented", variant: "secondary" },
};
