import type {
  Advance,
  AppNotification,
  AttendanceDay,
  Boq,
  Client,
  Dpr,
  Drawing,
  Employee,
  EmployeeAttendance,
  Equipment,
  Expense,
  GoodsReceipt,
  LabourAttendance,
  LabourContractor,
  MaterialIssue,
  MaterialItem,
  MaterialRequest,
  MaterialUsage,
  Project,
  ProjectFile,
  ProjectMember,
  PurchaseBooking,
  PurchaseOrder,
  Quotation,
  RaBill,
  SalarySlip,
  SalesInvoice,
  SiteInstruction,
  Subcontractor,
  SubconProgress,
  SubconWorkOrder,
  Supplier,
  SupervisorLedgerEntry,
  Task,
  Transaction,
  User,
} from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export const users: User[] = [
  { id: "u1", name: "Arjun Mehta", role: "super_admin", avatarColor: "#1e3a5f", initials: "AM" },
  { id: "u2", name: "Priya Nair", role: "pm", avatarColor: "#b45309", initials: "PN" },
  { id: "u3", name: "Rohan Das", role: "architect", avatarColor: "#0369a1", initials: "RD" },
  { id: "u4", name: "Sana Kapoor", role: "engineer", avatarColor: "#15803d", initials: "SK" },
  { id: "u5", name: "Vikram Rao", role: "engineer", avatarColor: "#7c3aed", initials: "VR" },
  { id: "u6", name: "Neha Joshi", role: "accountant", avatarColor: "#be123c", initials: "NJ" },
];

export const currentUser = users[0];

/* ------------------------------------------------------------------ */
/* Project team assignments (super admin assigns any role per project) */
/* ------------------------------------------------------------------ */

export const projectMembers: ProjectMember[] = [
  // Priya (PM) runs all four projects — mirrors each project's pmId
  { id: "pmem1", projectId: "p1", userId: "u2", role: "pm" },
  { id: "pmem2", projectId: "p2", userId: "u2", role: "pm" },
  { id: "pmem3", projectId: "p3", userId: "u2", role: "pm" },
  { id: "pmem4", projectId: "p4", userId: "u2", role: "pm" },
  // site team
  { id: "pmem5", projectId: "p1", userId: "u3", role: "architect" },
  { id: "pmem6", projectId: "p1", userId: "u4", role: "engineer" },
  { id: "pmem7", projectId: "p2", userId: "u5", role: "engineer" },
  { id: "pmem8", projectId: "p3", userId: "u4", role: "engineer" },
  // finance
  { id: "pmem9", projectId: "p2", userId: "u6", role: "accountant" },
];

/* ------------------------------------------------------------------ */
/* Clients                                                             */
/* ------------------------------------------------------------------ */

export const clients: Client[] = [
  {
    id: "c1",
    name: "Rakesh Agarwal",
    company: "Agarwal Estates Pvt Ltd",
    email: "rakesh@agarwalestates.in",
    phone: "+91 98100 11223",
    address: "Sector 62, Noida, UP",
    gst: "09AABCA1234L1ZP",
    createdAt: "2025-09-12",
  },
  {
    id: "c2",
    name: "Meera Sharma",
    company: "Sharma Residency",
    email: "meera.sharma@gmail.com",
    phone: "+91 99710 44556",
    address: "Vasant Kunj, New Delhi",
    gst: "07ABXPS5678K1Z2",
    createdAt: "2025-10-03",
  },
  {
    id: "c3",
    name: "Imtiaz Khan",
    company: "Crescent Hospitality",
    email: "imtiaz@crescenthotels.com",
    phone: "+91 90045 78901",
    address: "MG Road, Gurugram, HR",
    gst: "06AADCC9012M1Z8",
    createdAt: "2025-11-20",
  },
  {
    id: "c4",
    name: "Lakshmi Iyer",
    company: "Iyer Family Trust",
    email: "lakshmi.iyer@outlook.com",
    phone: "+91 98860 23344",
    address: "Indiranagar, Bengaluru, KA",
    gst: "29AAATI3456N1Z1",
    createdAt: "2026-01-08",
  },
];

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

export const projects: Project[] = [
  {
    id: "p1",
    code: "SH-001",
    name: "Agarwal Corporate Tower",
    clientId: "c1",
    value: 48500000,
    status: "ongoing",
    startDate: "2025-10-01",
    endDate: "2026-09-30",
    percentComplete: 62,
    location: "Sector 62, Noida",
    pmId: "u2",
    // Demo geo-fence around the Noida site (Sector 62)
    geofenceLat: 28.6273,
    geofenceLng: 77.3714,
    geofenceRadiusM: 300,
  },
  {
    id: "p2",
    code: "SH-002",
    name: "Sharma Villa Renovation",
    clientId: "c2",
    value: 9800000,
    status: "ongoing",
    startDate: "2025-11-15",
    endDate: "2026-07-31",
    percentComplete: 81,
    location: "Vasant Kunj, Delhi",
    pmId: "u2",
    geofenceLat: null,
    geofenceLng: null,
    geofenceRadiusM: null,
  },
  {
    id: "p3",
    code: "SH-003",
    name: "Crescent Boutique Hotel",
    clientId: "c3",
    value: 73200000,
    status: "ongoing",
    startDate: "2026-01-10",
    endDate: "2027-03-31",
    percentComplete: 28,
    location: "MG Road, Gurugram",
    pmId: "u2",
    geofenceLat: null,
    geofenceLng: null,
    geofenceRadiusM: null,
  },
  {
    id: "p4",
    code: "SH-004",
    name: "Iyer Residence",
    clientId: "c4",
    value: 14200000,
    status: "planning",
    startDate: "2026-03-01",
    endDate: "2026-12-15",
    percentComplete: 8,
    location: "Indiranagar, Bengaluru",
    pmId: "u2",
    geofenceLat: null,
    geofenceLng: null,
    geofenceRadiusM: null,
  },
];

/* ------------------------------------------------------------------ */
/* Tasks (project p1 detailed; others lighter)                         */
/* ------------------------------------------------------------------ */

export const tasks: Task[] = [
  // p1
  { id: "t1", projectId: "p1", parentId: null, name: "Site mobilisation & excavation", assigneeId: "u4", startDate: "2025-10-01", endDate: "2025-11-15", status: "completed", progressValue: 100, progressTarget: 100, unit: "percent", delayDays: 0 },
  { id: "t2", projectId: "p1", parentId: null, name: "Foundation & raft", assigneeId: "u4", startDate: "2025-11-16", endDate: "2026-01-20", status: "completed", progressValue: 100, progressTarget: 100, unit: "percent", delayDays: 0 },
  { id: "t3", projectId: "p1", parentId: null, name: "RCC superstructure", assigneeId: "u5", startDate: "2026-01-21", endDate: "2026-06-30", status: "ongoing", progressValue: 8, progressTarget: 14, unit: "numbers", delayDays: 0 },
  { id: "t3a", projectId: "p1", parentId: "t3", name: "Columns & beams (floors 1-8)", assigneeId: "u5", startDate: "2026-01-21", endDate: "2026-04-30", status: "completed", progressValue: 8, progressTarget: 8, unit: "numbers", delayDays: 0 },
  { id: "t3b", projectId: "p1", parentId: "t3", name: "Slab casting (floors 9-14)", assigneeId: "u5", startDate: "2026-05-01", endDate: "2026-06-30", status: "ongoing", progressValue: 0, progressTarget: 6, unit: "numbers", delayDays: 0 },
  { id: "t4", projectId: "p1", parentId: null, name: "Block work & plastering", assigneeId: "u4", startDate: "2026-04-01", endDate: "2026-07-15", status: "ongoing", progressValue: 3429.5, progressTarget: 6000, unit: "meter", delayDays: 0 },
  { id: "t5", projectId: "p1", parentId: null, name: "MEP rough-in", assigneeId: "u5", startDate: "2026-05-15", endDate: "2026-08-15", status: "delayed", progressValue: 12, progressTarget: 40, unit: "percent", delayDays: 6 },
  { id: "t6", projectId: "p1", parentId: null, name: "Facade glazing", assigneeId: "u3", startDate: "2026-07-01", endDate: "2026-09-15", status: "not_started", progressValue: 0, progressTarget: 100, unit: "percent", delayDays: 0 },
  { id: "t7", projectId: "p1", parentId: null, name: "Interior fit-out & handover", assigneeId: "u3", startDate: "2026-08-01", endDate: "2026-09-30", status: "not_started", progressValue: 0, progressTarget: 100, unit: "percent", delayDays: 0 },

  // p2
  { id: "t10", projectId: "p2", parentId: null, name: "Demolition & structural strengthening", assigneeId: "u4", startDate: "2025-11-15", endDate: "2026-01-10", status: "completed", progressValue: 100, progressTarget: 100, unit: "percent", delayDays: 0 },
  { id: "t11", projectId: "p2", parentId: null, name: "Flooring & joinery", assigneeId: "u3", startDate: "2026-01-11", endDate: "2026-04-30", status: "completed", progressValue: 100, progressTarget: 100, unit: "percent", delayDays: 0 },
  { id: "t12", projectId: "p2", parentId: null, name: "Painting & finishes", assigneeId: "u3", startDate: "2026-05-01", endDate: "2026-06-30", status: "ongoing", progressValue: 47, progressTarget: 50, unit: "numbers", delayDays: 0 },
  { id: "t13", projectId: "p2", parentId: null, name: "Landscaping & handover", assigneeId: "u4", startDate: "2026-07-01", endDate: "2026-07-31", status: "not_started", progressValue: 0, progressTarget: 100, unit: "percent", delayDays: 0 },

  // p3
  { id: "t20", projectId: "p3", parentId: null, name: "Piling & foundation", assigneeId: "u5", startDate: "2026-01-10", endDate: "2026-05-30", status: "ongoing", progressValue: 60, progressTarget: 100, unit: "percent", delayDays: 0 },
  { id: "t21", projectId: "p3", parentId: null, name: "Structural frame", assigneeId: "u5", startDate: "2026-06-01", endDate: "2026-11-30", status: "delayed", progressValue: 5, progressTarget: 20, unit: "percent", delayDays: 12 },
  { id: "t22", projectId: "p3", parentId: null, name: "Envelope & MEP", assigneeId: "u4", startDate: "2026-10-01", endDate: "2027-01-31", status: "not_started", progressValue: 0, progressTarget: 100, unit: "percent", delayDays: 0 },

  // p4
  { id: "t30", projectId: "p4", parentId: null, name: "Design development & approvals", assigneeId: "u3", startDate: "2026-03-01", endDate: "2026-05-15", status: "ongoing", progressValue: 35, progressTarget: 100, unit: "percent", delayDays: 0 },
  { id: "t31", projectId: "p4", parentId: null, name: "Site preparation", assigneeId: "u4", startDate: "2026-05-16", endDate: "2026-06-30", status: "not_started", progressValue: 0, progressTarget: 100, unit: "percent", delayDays: 0 },
];

/* ------------------------------------------------------------------ */
/* DPR / Site instructions / Files                                     */
/* ------------------------------------------------------------------ */

export const dprs: Dpr[] = [
  { id: "d1", projectId: "p1", date: "2026-06-18", authorId: "u4", weather: "Clear, 38°C", workDone: "Slab shuttering for floor 9 completed. Rebar tying in progress.", labourCount: 42, photos: 6 },
  { id: "d2", projectId: "p1", date: "2026-06-17", authorId: "u5", weather: "Hazy, 39°C", workDone: "Block work on floor 6 east wing. MEP conduiting floor 4.", labourCount: 38, photos: 4 },
  { id: "d3", projectId: "p1", date: "2026-06-16", authorId: "u4", weather: "Clear, 37°C", workDone: "Plastering floor 5. Material received: 200 cement bags.", labourCount: 45, photos: 8 },
  { id: "d4", projectId: "p2", date: "2026-06-18", authorId: "u3", weather: "Clear, 36°C", workDone: "Final coat painting in master suite. Wardrobe install ground floor.", labourCount: 12, photos: 5 },
];

export const siteInstructions: SiteInstruction[] = [
  { id: "si1", projectId: "p1", date: "2026-06-15", byId: "u2", text: "Use M30 grade concrete for floor 9 slab as per revised structural note SR-12.", priority: "high" },
  { id: "si2", projectId: "p1", date: "2026-06-10", byId: "u3", text: "Maintain 150mm cover for facade embeds; coordinate with glazing vendor.", priority: "medium" },
  { id: "si3", projectId: "p2", date: "2026-06-12", byId: "u2", text: "Client requested matte finish on all internal doors. Update before final coat.", priority: "medium" },
];

export const projectFiles: ProjectFile[] = [
  { id: "f1", projectId: "p1", name: "Floor9_slab_progress.jpg", kind: "photo", sizeKb: 2480, uploadedAt: "2026-06-18", uploadedById: "u4" },
  { id: "f2", projectId: "p1", name: "Structural_note_SR-12.pdf", kind: "pdf", sizeKb: 640, uploadedAt: "2026-06-15", uploadedById: "u3" },
  { id: "f3", projectId: "p1", name: "GA_plan_rev_C.dwg", kind: "dwg", sizeKb: 5120, uploadedAt: "2026-06-08", uploadedById: "u3" },
  { id: "f4", projectId: "p2", name: "Master_suite_finished.jpg", kind: "photo", sizeKb: 3110, uploadedAt: "2026-06-18", uploadedById: "u3" },
];

/* ------------------------------------------------------------------ */
/* Design / Drawings                                                   */
/* ------------------------------------------------------------------ */

export const drawings: Drawing[] = [
  {
    id: "dr1", projectId: "p1", title: "General Arrangement Plan", discipline: "architectural",
    currentRev: "C", status: "approved",
    versions: [
      { rev: "A", date: "2025-09-20", byId: "u3", notes: "Initial issue for client review", fileKb: 4800 },
      { rev: "B", date: "2025-10-30", byId: "u3", notes: "Core relocated per structural input", fileKb: 4950 },
      { rev: "C", date: "2026-06-08", byId: "u3", notes: "Lift lobby revised; approved for construction", fileKb: 5120 },
    ],
  },
  {
    id: "dr2", projectId: "p1", title: "Structural Framing — Typical Floor", discipline: "structural",
    currentRev: "B", status: "for_review",
    versions: [
      { rev: "A", date: "2025-11-02", byId: "u4", notes: "First structural issue", fileKb: 3600 },
      { rev: "B", date: "2026-06-05", byId: "u4", notes: "M30 grade note added (SR-12)", fileKb: 3720 },
    ],
  },
  {
    id: "dr3", projectId: "p1", title: "MEP Services Layout", discipline: "mep",
    currentRev: "A", status: "draft",
    versions: [
      { rev: "A", date: "2026-05-20", byId: "u5", notes: "Draft coordination model export", fileKb: 6200 },
    ],
  },
  {
    id: "dr4", projectId: "p2", title: "Interior Layout — Ground Floor", discipline: "interior",
    currentRev: "D", status: "approved",
    versions: [
      { rev: "A", date: "2025-11-20", byId: "u3", notes: "Concept", fileKb: 2800 },
      { rev: "B", date: "2025-12-15", byId: "u3", notes: "Client revisions r1", fileKb: 2900 },
      { rev: "C", date: "2026-02-10", byId: "u3", notes: "Matte door finish", fileKb: 3000 },
      { rev: "D", date: "2026-05-01", byId: "u3", notes: "Final for execution", fileKb: 3050 },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Quotations / BOQ / Invoices                                         */
/* ------------------------------------------------------------------ */

export const quotations: Quotation[] = [
  {
    id: "q1", number: "QTN-2026-014", clientId: "c4", projectName: "Iyer Residence",
    date: "2026-02-02", validUntil: "2026-03-04", status: "accepted", taxRate: 18,
    items: [
      { id: "qi1", description: "Architectural design & drawings", qty: 1, unit: "lot", rate: 950000 },
      { id: "qi2", description: "Civil construction (built-up)", qty: 4200, unit: "sqft", rate: 2200 },
      { id: "qi3", description: "Interior fit-out", qty: 1, unit: "lot", rate: 2800000 },
    ],
  },
  {
    id: "q2", number: "QTN-2026-021", clientId: "c3", projectName: "Crescent — Phase 2 spa wing",
    date: "2026-05-18", validUntil: "2026-06-18", status: "sent", taxRate: 18,
    items: [
      { id: "qi4", description: "Spa & wellness wing construction", qty: 1, unit: "lot", rate: 8200000 },
      { id: "qi5", description: "Specialised MEP", qty: 1, unit: "lot", rate: 1900000 },
    ],
  },
];

export const boqs: Boq[] = [
  {
    id: "b1", projectId: "p1",
    items: [
      { id: "bi1", description: "RCC works (M30) incl. steel & formwork", costCode: "material", qty: 2800, unit: "cum", rate: 8200 },
      { id: "bi2", description: "Block work & plaster", costCode: "material", qty: 6000, unit: "sqm", rate: 850 },
      { id: "bi3", description: "Structural steel — facade support", costCode: "material", qty: 42, unit: "MT", rate: 78000 },
      { id: "bi4", description: "Skilled & unskilled labour", costCode: "labour", qty: 1, unit: "lot", rate: 6800000 },
      { id: "bi5", description: "Tower crane & hoist", costCode: "machinery", qty: 11, unit: "month", rate: 220000 },
      { id: "bi6", description: "DG & site power (diesel)", costCode: "diesel", qty: 11, unit: "month", rate: 95000 },
      { id: "bi7", description: "MEP & finishes", costCode: "other", qty: 1, unit: "lot", rate: 7400000 },
    ],
  },
  {
    id: "b2", projectId: "p2",
    items: [
      { id: "bi10", description: "Structural strengthening", costCode: "material", qty: 1, unit: "lot", rate: 1200000 },
      { id: "bi11", description: "Flooring & joinery", costCode: "material", qty: 1, unit: "lot", rate: 2400000 },
      { id: "bi12", description: "Labour", costCode: "labour", qty: 1, unit: "lot", rate: 1900000 },
      { id: "bi13", description: "Finishes & landscaping", costCode: "other", qty: 1, unit: "lot", rate: 1600000 },
    ],
  },
];

export const salesInvoices: SalesInvoice[] = [
  {
    id: "inv1", number: "INV-2026-031", projectId: "p1", clientId: "c1",
    date: "2026-04-05", dueDate: "2026-05-05", taxRate: 18, received: 8260000, status: "paid",
    items: [{ id: "ii1", description: "RA Bill #3 — superstructure milestone", qty: 1, unit: "lot", rate: 7000000 }],
  },
  {
    id: "inv2", number: "INV-2026-038", projectId: "p1", clientId: "c1",
    date: "2026-05-28", dueDate: "2026-06-27", taxRate: 18, received: 3000000, status: "partial",
    items: [{ id: "ii2", description: "RA Bill #4 — block work milestone", qty: 1, unit: "lot", rate: 5500000 }],
  },
  {
    id: "inv3", number: "INV-2026-040", projectId: "p2", clientId: "c2",
    date: "2026-06-01", dueDate: "2026-07-01", taxRate: 18, received: 0, status: "sent",
    items: [{ id: "ii3", description: "Finishing stage milestone", qty: 1, unit: "lot", rate: 2200000 }],
  },
  {
    id: "inv4", number: "INV-2026-029", projectId: "p3", clientId: "c3",
    date: "2026-03-20", dueDate: "2026-04-20", taxRate: 18, received: 11800000, status: "paid",
    items: [{ id: "ii4", description: "Mobilisation advance + RA Bill #1", qty: 1, unit: "lot", rate: 10000000 }],
  },
];

/* ------------------------------------------------------------------ */
/* Transactions / Expenses                                             */
/* ------------------------------------------------------------------ */

export const transactions: Transaction[] = [
  // p1 outflows
  { id: "x1", projectId: "p1", partyId: null, date: "2026-01-15", direction: "out", amount: 4200000, costCode: "material", category: "material", note: "RMC supply Jan" },
  { id: "x2", projectId: "p1", partyId: null, date: "2026-02-12", direction: "out", amount: 3800000, costCode: "material", category: "material", note: "Steel & block" },
  { id: "x3", projectId: "p1", partyId: null, date: "2026-03-10", direction: "out", amount: 1500000, costCode: "labour", category: "salary", note: "Labour wages Mar" },
  { id: "x4", projectId: "p1", partyId: null, date: "2026-04-08", direction: "out", amount: 1650000, costCode: "labour", category: "salary", note: "Labour wages Apr" },
  { id: "x5", projectId: "p1", partyId: null, date: "2026-04-22", direction: "out", amount: 220000, costCode: "machinery", category: "site", note: "Crane rental" },
  { id: "x6", projectId: "p1", partyId: null, date: "2026-05-05", direction: "out", amount: 95000, costCode: "diesel", category: "site", note: "DG diesel" },
  { id: "x7", projectId: "p1", partyId: null, date: "2026-05-20", direction: "out", amount: 2900000, costCode: "material", category: "material", note: "Block & cement" },
  { id: "x8", projectId: "p1", partyId: null, date: "2026-06-02", direction: "out", amount: 1700000, costCode: "labour", category: "salary", note: "Labour wages Jun" },
  { id: "x9", projectId: "p1", partyId: null, date: "2026-06-10", direction: "out", amount: 480000, costCode: "other", category: "subcon", note: "MEP subcon RA1" },
  // p1 inflows
  { id: "xi1", projectId: "p1", partyId: "c1", date: "2026-04-06", direction: "in", amount: 8260000, costCode: "other", category: "other", note: "INV-2026-031" },
  { id: "xi2", projectId: "p1", partyId: "c1", date: "2026-06-01", direction: "in", amount: 3000000, costCode: "other", category: "other", note: "INV-2026-038 part" },

  // p2
  { id: "x20", projectId: "p2", partyId: null, date: "2026-02-10", direction: "out", amount: 1100000, costCode: "material", category: "material", note: "Flooring material" },
  { id: "x21", projectId: "p2", partyId: null, date: "2026-04-15", direction: "out", amount: 900000, costCode: "labour", category: "salary", note: "Labour" },
  { id: "x22", projectId: "p2", partyId: null, date: "2026-05-20", direction: "out", amount: 700000, costCode: "other", category: "other", note: "Finishes" },

  // p3
  { id: "x30", projectId: "p3", partyId: null, date: "2026-02-28", direction: "out", amount: 5200000, costCode: "material", category: "material", note: "Piling material" },
  { id: "x31", projectId: "p3", partyId: null, date: "2026-04-30", direction: "out", amount: 2100000, costCode: "labour", category: "salary", note: "Labour" },
  { id: "xi3", projectId: "p3", partyId: "c3", date: "2026-03-21", direction: "in", amount: 11800000, costCode: "other", category: "other", note: "INV-2026-029" },
];

export const expenses: Expense[] = [
  { id: "e1", projectId: "p1", date: "2026-06-17", category: "site", costCode: "diesel", amount: 8500, note: "Diesel for site DG (40L)", status: "approved", byId: "u4" },
  { id: "e2", projectId: "p1", date: "2026-06-18", category: "material", costCode: "material", amount: 22000, note: "Binding wire + consumables", status: "pending", byId: "u5" },
  { id: "e3", projectId: "p1", date: "2026-06-16", category: "site", costCode: "other", amount: 4200, note: "Water tanker", status: "approved", byId: "u4" },
  { id: "e4", projectId: "p1", date: "2026-06-18", category: "other", costCode: "other", amount: 15000, note: "Safety nets & PPE", status: "pending", byId: "u4" },
  { id: "e5", projectId: "p2", date: "2026-06-17", category: "material", costCode: "material", amount: 9800, note: "Paint top-up", status: "approved", byId: "u3" },
  { id: "e6", projectId: "p1", date: "2026-06-19", category: "site", costCode: "labour", amount: 6500, note: "Unloading charges — steel delivery", status: "pending", byId: "u5" },
  { id: "e7", projectId: "p3", date: "2026-06-18", category: "site", costCode: "diesel", amount: 11200, note: "JCB diesel (55L)", status: "approved", byId: "u5" },
  { id: "e8", projectId: "p3", date: "2026-06-19", category: "other", costCode: "other", amount: 3400, note: "First-aid & site stationery", status: "rejected", byId: "u5" },
  { id: "e9", projectId: "p1", date: "2026-06-19", category: "site", costCode: "other", amount: 5200, note: "Crane operator overtime food", status: "pending", byId: "u4" },
];

/* ------------------------------------------------------------------ */
/* Attendance (last 7 days, project p1)                                */
/* ------------------------------------------------------------------ */

export const attendance: AttendanceDay[] = [
  { date: "2026-06-12", present: 40, absent: 5 },
  { date: "2026-06-13", present: 44, absent: 3 },
  { date: "2026-06-14", present: 0, absent: 0 },
  { date: "2026-06-15", present: 41, absent: 6 },
  { date: "2026-06-16", present: 45, absent: 2 },
  { date: "2026-06-17", present: 38, absent: 9 },
  { date: "2026-06-18", present: 42, absent: 5 },
];

/* ================================================================== */
/* Phase 2 — Material & Subcontractor                                  */
/* ================================================================== */

export const suppliers: Supplier[] = [
  {
    id: "s1", name: "Sunil Verma", company: "UltraBuild Materials Pvt Ltd",
    contact: "Sunil Verma", phone: "+91 98110 22001", email: "sales@ultrabuild.in",
    gst: "09AAACU1234F1ZV", address: "Industrial Area, Sahibabad, UP",
  },
  {
    id: "s2", name: "Farah Sheikh", company: "SteelLine Traders",
    contact: "Farah Sheikh", phone: "+91 99100 55002", email: "orders@steelline.co.in",
    gst: "07AAFCS5678G1Z3", address: "Wazirpur, New Delhi",
  },
  {
    id: "s3", name: "Mahesh Pillai", company: "Crescent Electricals & Plumbing",
    contact: "Mahesh Pillai", phone: "+91 90080 33003", email: "info@crescentep.com",
    gst: "06AAGCC9012H1Z9", address: "Sector 18, Gurugram, HR",
  },
];

export const subcontractors: Subcontractor[] = [
  {
    id: "sc1", name: "Ravi Yadav", company: "Yadav RCC Works",
    trade: "rcc", contact: "Ravi Yadav", phone: "+91 98730 11221", gst: "09ADFPY1122A1ZK",
  },
  {
    id: "sc2", name: "Anil Kumar", company: "PowerFlow MEP Services",
    trade: "mep", contact: "Anil Kumar", phone: "+91 99580 44556", gst: "07AEKPK3344B1Z2",
  },
  {
    id: "sc3", name: "Deepak Shah", company: "ClearView Facade Systems",
    trade: "facade", contact: "Deepak Shah", phone: "+91 90250 77889", gst: "06AFLPS5566C1Z7",
  },
];

export const materialItems: MaterialItem[] = [
  { id: "m1", name: "OPC 53 Grade Cement", category: "cement", unit: "bag", stockQty: 180, reorderLevel: 200, rate: 410 },
  { id: "m2", name: "TMT Steel Bar 16mm", category: "steel", unit: "MT", stockQty: 8.5, reorderLevel: 6, rate: 71500 },
  { id: "m3", name: "TMT Steel Bar 12mm", category: "steel", unit: "MT", stockQty: 3.2, reorderLevel: 5, rate: 72000 },
  { id: "m4", name: "Coarse Aggregate 20mm", category: "aggregate", unit: "cum", stockQty: 240, reorderLevel: 150, rate: 1450 },
  { id: "m5", name: "River Sand", category: "aggregate", unit: "cum", stockQty: 95, reorderLevel: 120, rate: 2100 },
  { id: "m6", name: "AAC Block 600x200x200", category: "blocks", unit: "no", stockQty: 4200, reorderLevel: 3000, rate: 62 },
  { id: "m7", name: "PVC Conduit 25mm", category: "electrical", unit: "m", stockQty: 380, reorderLevel: 500, rate: 38 },
  { id: "m8", name: "CPVC Pipe 1in", category: "plumbing", unit: "m", stockQty: 620, reorderLevel: 400, rate: 145 },
];

export const materialRequests: MaterialRequest[] = [
  {
    id: "mr1", number: "MR-2026-051", projectId: "p1", byId: "u4", date: "2026-06-16",
    status: "approved", note: "Floor 9 slab pour",
    lines: [
      { materialItemId: "m1", qty: 220 },
      { materialItemId: "m2", qty: 4 },
    ],
  },
  {
    id: "mr2", number: "MR-2026-054", projectId: "p1", byId: "u5", date: "2026-06-18",
    status: "pending", note: "MEP rough-in floor 4",
    lines: [
      { materialItemId: "m7", qty: 300 },
      { materialItemId: "m8", qty: 120 },
    ],
  },
  {
    id: "mr3", number: "MR-2026-055", projectId: "p3", byId: "u5", date: "2026-06-17",
    status: "pending", note: "Piling reinforcement",
    lines: [{ materialItemId: "m3", qty: 6 }],
  },
];

export const purchaseOrders: PurchaseOrder[] = [
  {
    id: "po1", number: "PO-2026-088", supplierId: "s1", projectId: "p1", date: "2026-06-10",
    status: "received", taxRate: 28, discount: 12000,
    terms: "Delivery within 3 days at site. Material to conform to IS standards. Rejected material to be lifted by supplier.",
    paymentTerms: "50% advance, balance within 30 days of delivery.",
    items: [
      { id: "poi1", description: "OPC 53 Grade Cement", materialItemId: "m1", qty: 400, unit: "bag", rate: 410 },
      { id: "poi2", description: "Coarse Aggregate 20mm", materialItemId: "m4", qty: 120, unit: "cum", rate: 1450 },
    ],
  },
  {
    id: "po2", number: "PO-2026-092", supplierId: "s2", projectId: "p1", date: "2026-06-15",
    status: "sent", taxRate: 18, discount: 0,
    terms: "Material to be delivered in single lot. Test certificates required.",
    paymentTerms: "Net 45 days from delivery.",
    items: [
      { id: "poi3", description: "TMT Steel Bar 16mm", materialItemId: "m2", qty: 6, unit: "MT", rate: 71500 },
      { id: "poi4", description: "TMT Steel Bar 12mm", materialItemId: "m3", qty: 4, unit: "MT", rate: 72000 },
    ],
  },
];

export const goodsReceipts: GoodsReceipt[] = [
  {
    id: "gr1", number: "GRN-2026-061", poId: "po1", date: "2026-06-13", byId: "u4",
    lines: [
      { poItemId: "poi1", qtyReceived: 400 },
      { poItemId: "poi2", qtyReceived: 120 },
    ],
  },
];

export const purchaseBookings: PurchaseBooking[] = [
  { id: "pb1", poId: "po1", billNo: "UB/2026/2231", date: "2026-06-14", amount: 384000, status: "booked" },
];

export const materialUsage: MaterialUsage[] = [
  { id: "mu1", projectId: "p1", materialItemId: "m1", qty: 220, date: "2026-06-17", ref: "Floor 9 slab" },
  { id: "mu2", projectId: "p1", materialItemId: "m4", qty: 80, date: "2026-06-17", ref: "Floor 9 slab" },
  { id: "mu3", projectId: "p1", materialItemId: "m6", qty: 1800, date: "2026-06-12", ref: "Block work floor 6" },
  { id: "mu4", projectId: "p1", materialItemId: "m2", qty: 3.5, date: "2026-06-16", ref: "Column reinforcement" },
];

export const subconWorkOrders: SubconWorkOrder[] = [
  {
    id: "wo1", number: "WO-2026-017", subcontractorId: "sc1", projectId: "p1", date: "2026-02-01",
    status: "in_progress", taxRate: 18, signatory: "Priya Nair (Project Manager)",
    items: [
      { id: "woi1", description: "RCC superstructure — labour & shuttering (per cum)", qty: 2800, unit: "cum", rate: 1850 },
      { id: "woi2", description: "Steel cutting, bending & tying (per MT)", qty: 320, unit: "MT", rate: 6500 },
    ],
  },
  {
    id: "wo2", number: "WO-2026-024", subcontractorId: "sc2", projectId: "p1", date: "2026-05-10",
    status: "issued", taxRate: 18, signatory: "Priya Nair (Project Manager)",
    items: [
      { id: "woi3", description: "MEP rough-in — electrical & plumbing (lumpsum)", qty: 1, unit: "lot", rate: 2400000 },
    ],
  },
];

export const subconProgress: SubconProgress[] = [
  { id: "sp1", workOrderId: "wo1", date: "2026-04-30", percent: 45, note: "Columns & beams floors 1-8 complete" },
  { id: "sp2", workOrderId: "wo1", date: "2026-06-15", percent: 58, note: "Slab casting floors 9-11 in progress" },
  { id: "sp3", workOrderId: "wo2", date: "2026-06-12", percent: 12, note: "Conduiting floor 4 started" },
];

export const materialIssues: MaterialIssue[] = [
  { id: "mi1", subcontractorId: "sc1", projectId: "p1", materialItemId: "m2", qty: 3.5, date: "2026-06-16" },
  { id: "mi2", subcontractorId: "sc2", projectId: "p1", materialItemId: "m7", qty: 150, date: "2026-06-18" },
];

export const raBills: RaBill[] = [
  {
    id: "ra1", number: "RA-WO017-03", workOrderId: "wo1", date: "2026-05-05",
    percentComplete: 45, grossAmount: 4660000, deductions: 233000, netAmount: 4427000, status: "paid",
  },
  {
    id: "ra2", number: "RA-WO017-04", workOrderId: "wo1", date: "2026-06-16",
    percentComplete: 58, grossAmount: 1346000, deductions: 67300, netAmount: 1278700, status: "submitted",
  },
];

/* ================================================================== */
/* Phase 3 — Payroll, Attendance, Expenses, Equipment                  */
/* ================================================================== */

/* ---------- Staff employees (office + site) ---------- */

export const employees: Employee[] = [
  { id: "emp1", name: "Arjun Mehta", designation: "Director", department: "admin", monthlyCtc: 280000, joinDate: "2018-04-01", phone: "+91 98100 10001", initials: "AM", avatarColor: "#1e3a5f" },
  { id: "emp2", name: "Priya Nair", designation: "Project Manager", department: "engineering", monthlyCtc: 165000, joinDate: "2020-06-15", phone: "+91 98100 10002", initials: "PN", avatarColor: "#b45309" },
  { id: "emp3", name: "Rohan Das", designation: "Senior Architect", department: "design", monthlyCtc: 142000, joinDate: "2019-09-01", phone: "+91 98100 10003", initials: "RD", avatarColor: "#0369a1" },
  { id: "emp4", name: "Sana Kapoor", designation: "Site Engineer", department: "site", monthlyCtc: 78000, joinDate: "2022-02-10", phone: "+91 98100 10004", initials: "SK", avatarColor: "#15803d" },
  { id: "emp5", name: "Vikram Rao", designation: "Site Engineer", department: "site", monthlyCtc: 74000, joinDate: "2022-08-22", phone: "+91 98100 10005", initials: "VR", avatarColor: "#7c3aed" },
  { id: "emp6", name: "Neha Joshi", designation: "Accountant", department: "accounts", monthlyCtc: 88000, joinDate: "2021-03-05", phone: "+91 98100 10006", initials: "NJ", avatarColor: "#be123c" },
  { id: "emp7", name: "Imran Sheikh", designation: "Junior Architect", department: "design", monthlyCtc: 62000, joinDate: "2023-07-12", phone: "+91 98100 10007", initials: "IS", avatarColor: "#0d9488" },
  { id: "emp8", name: "Kavya Reddy", designation: "Site Supervisor", department: "site", monthlyCtc: 54000, joinDate: "2023-11-01", phone: "+91 98100 10008", initials: "KR", avatarColor: "#9333ea" },
];

/* ---------- Salary slips for May 2026 ---------- */
/* basic = 50% CTC, hra = 20%, allowances = remainder; pf = 12% of basic, esi where applicable. */

export const salarySlips: SalarySlip[] = [
  { id: "ss1", employeeId: "emp1", month: "2026-05", paidDays: 31, monthDays: 31, basic: 140000, hra: 56000, allowances: 84000, pf: 16800, esi: 0, advanceDeduction: 0, status: "paid" },
  { id: "ss2", employeeId: "emp2", month: "2026-05", paidDays: 31, monthDays: 31, basic: 82500, hra: 33000, allowances: 49500, pf: 9900, esi: 0, advanceDeduction: 25000, status: "paid" },
  { id: "ss3", employeeId: "emp3", month: "2026-05", paidDays: 31, monthDays: 31, basic: 71000, hra: 28400, allowances: 42600, pf: 8520, esi: 0, advanceDeduction: 0, status: "paid" },
  { id: "ss4", employeeId: "emp4", month: "2026-05", paidDays: 29, monthDays: 31, basic: 39000, hra: 15600, allowances: 23400, pf: 4680, esi: 585, advanceDeduction: 10000, status: "paid" },
  { id: "ss5", employeeId: "emp5", month: "2026-05", paidDays: 31, monthDays: 31, basic: 37000, hra: 14800, allowances: 22200, pf: 4440, esi: 555, advanceDeduction: 0, status: "paid" },
  { id: "ss6", employeeId: "emp6", month: "2026-05", paidDays: 31, monthDays: 31, basic: 44000, hra: 17600, allowances: 26400, pf: 5280, esi: 0, advanceDeduction: 0, status: "paid" },
  { id: "ss7", employeeId: "emp7", month: "2026-05", paidDays: 30, monthDays: 31, basic: 31000, hra: 12400, allowances: 18600, pf: 3720, esi: 465, advanceDeduction: 0, status: "paid" },
  { id: "ss8", employeeId: "emp8", month: "2026-05", paidDays: 31, monthDays: 31, basic: 27000, hra: 10800, allowances: 16200, pf: 3240, esi: 405, advanceDeduction: 8000, status: "paid" },
  // June 2026 — finalised, not yet paid
  { id: "ss9", employeeId: "emp4", month: "2026-06", paidDays: 26, monthDays: 30, basic: 39000, hra: 15600, allowances: 23400, pf: 4680, esi: 585, advanceDeduction: 10000, status: "finalised" },
  { id: "ss10", employeeId: "emp8", month: "2026-06", paidDays: 28, monthDays: 30, basic: 27000, hra: 10800, allowances: 16200, pf: 3240, esi: 405, advanceDeduction: 8000, status: "draft" },
];

/* ---------- Labour contractors ---------- */

export const labourContractors: LabourContractor[] = [
  { id: "lc1", name: "Ram Singh", company: "Singh Labour Suppliers", trade: "rcc", phone: "+91 99110 22001", headcount: 48, dayRate: 720 },
  { id: "lc2", name: "Bablu Mahto", company: "Mahto Mason Group", trade: "finishes", phone: "+91 99110 22002", headcount: 22, dayRate: 680 },
  { id: "lc3", name: "Salim Ansari", company: "Ansari MEP Labour", trade: "mep", phone: "+91 99110 22003", headcount: 16, dayRate: 850 },
];

/* ---------- GPS-based labour attendance (last 7 days, shift-based) ---------- */

export const labourAttendance: LabourAttendance[] = [
  { id: "la1", contractorId: "lc1", projectId: "p1", date: "2026-06-18", shift: "first", present: 44, absent: 4, gps: "28.6271, 77.3784" },
  { id: "la2", contractorId: "lc2", projectId: "p1", date: "2026-06-18", shift: "first", present: 20, absent: 2, gps: "28.6271, 77.3784" },
  { id: "la3", contractorId: "lc3", projectId: "p1", date: "2026-06-18", shift: "second", present: 14, absent: 2, gps: "28.6271, 77.3784" },
  { id: "la4", contractorId: "lc1", projectId: "p1", date: "2026-06-17", shift: "first", present: 40, absent: 8, gps: "28.6270, 77.3786" },
  { id: "la5", contractorId: "lc2", projectId: "p1", date: "2026-06-17", shift: "first", present: 21, absent: 1, gps: "28.6270, 77.3786" },
  { id: "la6", contractorId: "lc1", projectId: "p1", date: "2026-06-16", shift: "first", present: 46, absent: 2, gps: "28.6272, 77.3783" },
  { id: "la7", contractorId: "lc2", projectId: "p1", date: "2026-06-16", shift: "first", present: 22, absent: 0, gps: "28.6272, 77.3783" },
  { id: "la8", contractorId: "lc1", projectId: "p1", date: "2026-06-15", shift: "first", present: 41, absent: 7, gps: "28.6269, 77.3785" },
  { id: "la9", contractorId: "lc3", projectId: "p1", date: "2026-06-15", shift: "second", present: 13, absent: 3, gps: "28.6269, 77.3785" },
  { id: "la10", contractorId: "lc1", projectId: "p1", date: "2026-06-13", shift: "first", present: 45, absent: 3, gps: "28.6271, 77.3784" },
  { id: "la11", contractorId: "lc2", projectId: "p1", date: "2026-06-13", shift: "first", present: 20, absent: 2, gps: "28.6271, 77.3784" },
  { id: "la12", contractorId: "lc1", projectId: "p1", date: "2026-06-12", shift: "first", present: 38, absent: 10, gps: "28.6270, 77.3786" },
];

/* ---------- Employee GPS + selfie attendance (self check-in/out) ---------- */
/* Generated relative to today so "My Attendance" and the admin board always
   have current-month data. Deterministic (no Math.random). */

const attendanceIst = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });
const attendanceDay = (daysAgo: number) =>
  attendanceIst.format(new Date(Date.now() - daysAgo * 86400000));
// minutesFromMidnight must be a whole minutes-of-day value (0–1439) — building
// the "HH:MM" string by hand instead of via divmod overflows into invalid
// times like "08:74" once the minute part passes 59.
const istIsoFromMinutes = (date: string, minutesFromMidnight: number) => {
  const h = Math.floor(minutesFromMidnight / 60);
  const m = minutesFromMidnight % 60;
  return `${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+05:30`;
};

function buildEmployeeAttendance(): EmployeeAttendance[] {
  const people = [
    { userId: "u1", employeeId: "KV001", userName: "Arjun Mehta", projectId: "p1" },
    { userId: "u2", employeeId: "KV002", userName: "Priya Nair", projectId: "p1" },
    { userId: "u4", employeeId: "KV004", userName: "Sana Kapoor", projectId: "p3" },
  ];
  const rows: EmployeeAttendance[] = [];
  let n = 0;
  for (let daysAgo = 20; daysAgo >= 0; daysAgo--) {
    const date = attendanceDay(daysAgo);
    if (new Date(`${date}T00:00:00`).getDay() === 0) continue; // Sunday holiday
    people.forEach((p, pi) => {
      // Skip a few scattered weekdays so Absent shows up (u1 stays regular).
      if (pi > 0 && (daysAgo + pi * 3) % 7 === 2) return;
      const checkInMinutes = 8 * 60 + 45 + ((daysAgo * 7 + pi * 11) % 30); // 08:45–09:14
      const checkOutMinutes = 17 * 60 + 45 + ((daysAgo * 5 + pi * 13) % 45); // 17:45–18:29 (some OT)
      const checkedIn = istIsoFromMinutes(date, checkInMinutes);
      const isOpenToday = daysAgo === 0 && p.userId === "u1"; // demo the Check Out state
      const checkedOut = isOpenToday ? "" : istIsoFromMinutes(date, checkOutMinutes);
      const total = checkedOut
        ? Math.floor((+new Date(checkedOut) - +new Date(checkedIn)) / 60000)
        : 0;
      rows.push({
        id: `ea${++n}`,
        userId: p.userId,
        employeeId: p.employeeId,
        userName: p.userName,
        projectId: p.projectId,
        date,
        checkInAt: checkedIn,
        checkInLat: 28.6273,
        checkInLng: 77.3714,
        checkInSelfiePath: "",
        checkOutAt: checkedOut,
        checkOutLat: checkedOut ? 28.6273 : null,
        checkOutLng: checkedOut ? 77.3714 : null,
        checkOutSelfiePath: "",
        totalMinutes: total,
        overtimeMinutes: Math.max(0, total - 480),
      });
    });
  }
  return rows;
}

export const employeeAttendance: EmployeeAttendance[] = buildEmployeeAttendance();

/* ---------- Advances (employees + contractors) ---------- */

export const advances: Advance[] = [
  { id: "adv1", partyType: "employee", partyId: "emp2", date: "2026-04-10", amount: 100000, recovered: 75000, status: "settling", note: "Personal advance, recovered @25k/month" },
  { id: "adv2", partyType: "employee", partyId: "emp4", date: "2026-03-05", amount: 50000, recovered: 30000, status: "settling", note: "Medical advance" },
  { id: "adv3", partyType: "employee", partyId: "emp8", date: "2026-05-20", amount: 40000, recovered: 8000, status: "open", note: "Festival advance" },
  { id: "adv4", partyType: "contractor", partyId: "lc1", date: "2026-06-01", amount: 300000, recovered: 180000, status: "settling", note: "Weekly wage advance — adjusted in RA" },
  { id: "adv5", partyType: "contractor", partyId: "lc3", date: "2026-06-10", amount: 120000, recovered: 0, status: "open", note: "Mobilisation advance MEP labour" },
];

/* ---------- Equipment & assets ---------- */

export const equipment: Equipment[] = [
  { id: "eq1", code: "TC-01", name: "Potain Tower Crane MCi 85", kind: "machinery", ownership: "rented", status: "in_use", projectId: "p1", monthlyRate: 220000, acquiredDate: "2025-11-01" },
  { id: "eq2", code: "PH-02", name: "Material Hoist 2T", kind: "machinery", ownership: "owned", status: "in_use", projectId: "p1", monthlyRate: 35000, acquiredDate: "2021-05-10" },
  { id: "eq3", code: "EX-03", name: "JCB 3DX Backhoe Loader", kind: "machinery", ownership: "rented", status: "idle", projectId: "p3", monthlyRate: 165000, acquiredDate: "2026-01-12" },
  { id: "eq4", code: "DG-04", name: "Kirloskar 125 kVA DG Set", kind: "machinery", ownership: "owned", status: "in_use", projectId: "p1", monthlyRate: 28000, acquiredDate: "2020-08-20" },
  { id: "eq5", code: "CM-05", name: "Concrete Mixer 10/7", kind: "machinery", ownership: "owned", status: "maintenance", projectId: "p2", monthlyRate: 12000, acquiredDate: "2019-03-15" },
  { id: "eq6", code: "VB-06", name: "Needle Vibrator Set (x4)", kind: "tool", ownership: "owned", status: "in_use", projectId: "p1", monthlyRate: 4000, acquiredDate: "2023-06-01" },
  { id: "eq7", code: "WT-07", name: "Total Station Leica TS07", kind: "tool", ownership: "owned", status: "idle", projectId: null, monthlyRate: 9000, acquiredDate: "2022-10-05" },
  { id: "eq8", code: "SC-08", name: "Cup-lock Scaffolding (5T set)", kind: "asset", ownership: "owned", status: "in_use", projectId: "p1", monthlyRate: 45000, acquiredDate: "2021-01-20" },
  { id: "eq9", code: "PP-09", name: "Diesel Pump 3in", kind: "tool", ownership: "rented", status: "idle", projectId: "p3", monthlyRate: 6000, acquiredDate: "2026-02-01" },
  { id: "eq10", code: "LV-10", name: "Site Vehicle — Bolero Pickup", kind: "asset", ownership: "owned", status: "in_use", projectId: "p1", monthlyRate: 22000, acquiredDate: "2022-04-18" },
];

/* ---------- Supervisor balance ledger (imprest: received vs paid) ---------- */

export const supervisorLedger: SupervisorLedgerEntry[] = [
  { id: "sl1", supervisorId: "u4", projectId: "p1", date: "2026-06-01", direction: "received", amount: 150000, note: "Monthly site imprest" },
  { id: "sl2", supervisorId: "u4", projectId: "p1", date: "2026-06-05", direction: "paid", amount: 18500, note: "Diesel & consumables" },
  { id: "sl3", supervisorId: "u4", projectId: "p1", date: "2026-06-10", direction: "paid", amount: 42000, note: "Petty labour & tea/snacks" },
  { id: "sl4", supervisorId: "u4", projectId: "p1", date: "2026-06-15", direction: "paid", amount: 27000, note: "Hardware & safety items" },
  { id: "sl5", supervisorId: "u4", projectId: "p1", date: "2026-06-16", direction: "received", amount: 50000, note: "Top-up imprest" },
  { id: "sl6", supervisorId: "u5", projectId: "p1", date: "2026-06-02", direction: "received", amount: 80000, note: "MEP floor imprest" },
  { id: "sl7", supervisorId: "u5", projectId: "p1", date: "2026-06-12", direction: "paid", amount: 31500, note: "Conduit, wire & sundries" },
  { id: "sl8", supervisorId: "u5", projectId: "p3", date: "2026-06-14", direction: "received", amount: 60000, note: "Crescent site imprest" },
  { id: "sl9", supervisorId: "u5", projectId: "p3", date: "2026-06-18", direction: "paid", amount: 22400, note: "Piling consumables" },
];

/* ---------- Notifications (topbar feed) ---------- */

export const notifications: AppNotification[] = [
  { id: "n1", kind: "approval", title: "4 expenses awaiting approval", body: "Pending petty-site expenses across SH-001 & SH-003.", date: "2026-06-20", read: false, href: "/expenses" },
  { id: "n2", kind: "delay", title: "Task delayed — Crescent Hotel", body: "Structural frame (SH-003) delayed by 12 days.", date: "2026-06-19", read: false, href: "/projects/p3" },
  { id: "n3", kind: "stock", title: "Low stock alert", body: "OPC Cement, 12mm steel & river sand are below reorder level.", date: "2026-06-19", read: false, href: "/material" },
  { id: "n4", kind: "payment", title: "RA bill submitted", body: "RA-WO017-04 (₹12.8L net) awaiting certification.", date: "2026-06-16", read: true, href: "/subcon" },
  { id: "n5", kind: "info", title: "Salary run finalised", body: "June payroll finalised for site staff — review before disbursal.", date: "2026-06-18", read: true, href: "/payroll" },
];
