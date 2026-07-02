# SiteHub — Development History

**SiteHub** is a construction & design management platform for **Keyvendors India Pvt. Ltd.**
Built with **Next.js 16 · React 19 · Tailwind v4 · Recharts · Supabase (Postgres/Auth/Storage) · Vercel**.

- **Live:** https://construction-management-software.vercel.app
- **Repo:** `Kevendors/construction-management-software`  ·  **Code:** `C:\Users\dell\sitehub` (local disk, not Drive)
- **Covers:** initial scaffold (2026-06-19) → 63 committed changes through 2026-07-02

Changelog below is **newest-first**. Short SHAs are shown for traceability; the pre-git scaffold (06-19) predates version control.

---

## 2026-07-02
- Sidebar footer label → **"v0.3 · live"** (was "v0.2 · Phase 2 · mock data"). `(f925c18)`
- **Data cleanup** (admin): kept only the two real projects — **Rajender Nagar** & **Gurgaon 89** — and removed 4 demo projects with their tasks/DPRs/transactions/invoices/work-orders/attendance; cleared demo petty-expense rows; deleted junk test clients (QA Supatest, tngbfdsxaz).

## 2026-07-01
- **Clients / CRM — full CRUD + search:** New Client, Edit, Delete (unlink-safe), client search. `(dac3d69)`
- **Petty Expenses — full expense tracking:** expanded form (Title, mandatory **Project** + **Person**, Category, Amount, **Payment Mode**, Date, Status, Notes, **Bill upload** → private Storage); **filter by project/person**; new **Reports** tab with project-wise & employee-wise totals + charts. `(ebb7651)`
- **Petty Expenses — dashboard functional (Supabase):** Log Expense, Approve/Reject, live KPIs, Supervisor Balance from real ledger. `(d53d8c2)`
- **Business signature:** upload per-quote `(c16cdb5)`; bundled default Keyvendors signature on quotations & work orders `(fce74cf)`; transparent-bg + enlarged `(1451637, f2c15c4)`; trimmed empty margins for correct size `(473231c)`.
- **Quotation calc & columns:** Amount = **Qty × Rate** (removed Sq.ft) `(dba134c)`; editable **Specific** column `(355e16c, fc3d5d1)`; per-line **Lumpsum** in Rate *or* Amount (mutually exclusive), Qty/Unit kept editable `(a2832cb, 0a014fb, 5409d44, cb1441c, e7f878a, c21100d, c94655d)`; centered Rate column `(93c7f46)`.
- **Work Order document** rebuilt to the Keyvendors template; From/Important-Links column alignment fixed on quotation & WO; header logo slightly reduced. `(c300d09, e0d4a06, 9c63971)`

## 2026-06-27
- **Subcontractor module — fully functional:** create flows for Subcontractors, Work Orders (with line items), Progress logs, RA Bills, Material Issues. `(1867704)`
- **Quotation list** search + status filter `(3a15b85)`; **Important Links** clickable with real URLs `(18680cb, fe9c2d8)`.
- **Sidebar rebrand:** dropped "Charu" → "By KeyVendors"; blog link → `/blogs`. `(e43d98c, 5c9fdee, e34c4f8)`
- Quotation **Bag/Feet** units; section colors preserved in print/PDF. `(0afad0a, c97753d)`

## 2026-06-26
- **Phase 1 — Quotations → Supabase:** save / list / re-open with full payload. `(4c2cecc)`
- **Project store → Supabase (Phases 2–6):** projects, tasks, DPRs, site instructions, expenses, invoices, attendance now load from and write to Postgres (replacing localStorage). `(309b1c6)`
- **DPR photos → private Supabase Storage** with signed URLs. `(edd83c4)`
- **Login polish:** show/hide password, "Forgot password?" below the field, "Create one" → "Create Account". `(1c8e0ab, e11a127, 4dc7199)`
- More quotation header/logo sizing. `(d6028ca, 447da86, 9afb7dd)`

## 2026-06-24 → 06-25 — Quotation module
- Added the **smart Quotation module** on the Keyvendors template; matched to the real historical format. `(d3c7d63, 671fd99)`
- **Item master** built from all 53 historical quotations → completed to 96 unique items; removed the generic "Waterproofing (All Types)" catch-all. `(5ade112, 1c31573, 1e20954)`
- **Logo work:** real Keyvendors logo, transparent PNG, landscape + square variants, header alignment/sizing. `(e40774f, c6bb294, ffdab37, eefa490, 8b542df)`

## 2026-06-23 → 06-24 — Authentication
- **Supabase auth:** login / signup, session middleware, org membership. `(25c6c97)`
- Fixed the production build with Supabase configured. `(4f457ea)`
- Self-service **password reset**; logged-in user + **Sign out** in the top bar. `(9b47f91, b34aa0b)`
- **DPR:** Photos field turned into a real image upload. `(e2bd6fb)`

## 2026-06-22 — Projects made interactive
- Project **Overview / Tasks / Updates** fully interactive with auto progress. `(78c2905)`
- **New Project** functional (create + open, persisted). `(f0452dd)`
- **Global search** functional; project data made live across every chart. `(7949768, c6bcff4)`
- Chart focus-outline polish. `(e437c33, 28dfaeb)`

## 2026-06-20 — Initial commit (version control begins)
- **`b1473c1`** — SiteHub scaffold: Projects/Tasks/Gantt, Design, CRM/Quotation/BOQ/Invoices, Dashboards & Analytics, Material, Subcontractor, Payroll/Attendance, Petty Expenses, Equipment (charts 1–19), on a mock data layer with an env-gated Supabase seam (`src/lib/data`) plus schema migration, RLS and demo seed (`supabase/`).

## 2026-06-19 — Pre-git scaffold (Phases 0–2, UI on mock data)
*Predates version control; captured from the original build-history/handoff notes.*
- **Phase 0/1:** fresh `create-next-app` (TS, App Router, `src/`, Tailwind, `@/*`); hand-rolled shadcn-style UI primitives in `src/components/ui/`; slate+amber design system & tokens in `globals.css`; mock data + selectors + domain types + label maps; app shell (sidebar from `src/lib/nav.ts`, topbar, PWA manifest). Modules: Projects (Overview/Tasks/Updates/Design/Commercial/Files), Design Management, CRM, Quotations, Sales Invoices; company + project dashboards (charts 1–13, 16).
- **Phase 2 (Material & Subcontractor):** Material module (Inventory + stock-vs-reorder chart, Requests, POs, Suppliers, Usage) and Subcontractor module (Work Orders, Progress, RA Bills, Material Issues, Subcontractors); **PO/Work-Order PDFs** via print-optimized A4 routes + `DocumentShell`/`PrintButton` + `@media print` chrome hiding.

---

## Feature summary by module

| Module | Status |
|---|---|
| **Authentication** | ✅ Supabase email+password (login/signup/reset), session middleware, org membership, show/hide password |
| **Company Dashboard / Analytics** | ✅ Portfolio KPIs & trend charts (aggregate layer) |
| **Projects** | ✅ List + New Project; Overview/Tasks/Updates live from Supabase; DPR photos in Storage. Design/Commercial/Files tabs disabled |
| **Quotations** | ✅ Full builder + Keyvendors PDF template, 96-item master, GST, Lumpsum modes, Specific column, signature, save/re-open, search/filter, Convert to Project |
| **Clients / CRM** | ✅ Full CRUD + search; detail shows client's projects & quotations |
| **Subcontractor** | ✅ Subcontractors, Work Orders (+PDF), Progress, RA Bills, Material Issues |
| **Petty Expenses** | ✅ Log/Approve/Reject, project & person tracking, bill upload, filters, project/person reports, supervisor balance |
| **Sales Invoices** | 🟡 Read-only list + KPIs; no builder/edit/PDF yet |
| **Material / Payroll / Design / Equipment** | ⬜ Display-only (mock data) |

## Current status

**Done:** Auth, Quotations, Clients/CRM, Subcontractor, Petty Expenses, and the full localStorage → Supabase migration (projects, tasks, DPRs+photos, instructions, expenses, invoices, attendance). Private Storage buckets: `dpr-photos`, `expense-bills`. Org-scoped RLS + membership-verified server actions throughout.

**Pending (roadmap):**
- **Role & Access Control** — roles exist in the DB but are unused (every user is effectively admin); needs an admin "Team/Users" page, supervisor logins, phone+password accounts, and role-based RLS/nav.
- **Project Dashboard** — clickable report cards, activity/history log, Alerts section, replies on updates, real Files tab, per-project petty-expense card.
- **Expense module** — dynamic categories ("Add Category" vs "Others"), disable future dates, reflect petty expenses on the project dashboard.
- **Invoice module** — editable invoice builder + PDF generator (mirror Quotations), multiple invoices per project, project sync.
- **Transaction tracking** — unified ledger so all financial events reflect automatically.
