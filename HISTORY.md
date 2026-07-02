# SiteHub — Build History & Handoff

Running log of what's been built, so any session (including a cold start) can
continue. Pair with `SETUP.md` (how to run) and `LESSONS.md` (gotchas/decisions).
Spec of record: `PLAN.md` in the Google Drive project folder.

- **Code location:** `C:\Users\dell\sitehub` (local disk — NOT Google Drive).
- **Stack:** Next.js 16.2.9 · React 19.2.4 · Tailwind v4 · Recharts 3 · zod · lucide.
- **Data:** mock layer only (`src/lib/mock/`). No backend yet.

---

## Timeline

### 2026-06-19 — Phase 0 + Phase 1 (fresh scaffold)
The `PLAN.md` "build status" referenced a `keyvendors/sitehub` tree that did **not**
exist on this machine, so the project was scaffolded fresh (user approved "scaffold
fresh here").

- Scaffolded `create-next-app` (TS, App Router, src dir, Tailwind, `@/*` alias).
- Hand-rolled shadcn-style UI primitives in `src/components/ui/` (button, card,
  badge, progress, table, tabs, input, separator, avatar) — chose this over the
  shadcn CLI for a reliable green build.
- Design system in `src/app/globals.css`: slate + amber construction palette,
  full token set, chart colors, dark-mode vars.
- Mock data (`src/lib/mock/data.ts`) + derived selectors (`src/lib/mock/selectors.ts`)
  + domain types (`src/lib/types.ts`) + label maps (`src/lib/labels.ts`).
- App shell: sidebar (`src/lib/nav.ts` drives it), topbar, `AppShell`, PWA manifest.
- **Modules:** Projects (list + detail tabs: Overview/Tasks/Updates/Design/Commercial/Files),
  Design Management, CRM (clients + detail), Quotations, Sales Invoices.
- **Dashboards:** company dashboard (home) + project dashboard (Overview tab),
  charts 1–13 & 16.
- Result: `npm run build` green (17 routes), lint clean.

### 2026-06-19 — Phase 2 (Material & Subcontractor)
User reviewed Phase 1 UI, approved continuing mock-first. Plan file:
`C:\Users\dell\.claude\plans\deep-orbiting-hearth.md`.

- Extended data layer: suppliers, subcontractors, material items, requests, POs,
  goods receipts, purchase bookings, usage, work orders, progress, material issues,
  RA bills (types + seed + selectors + labels).
- **Material module** (`/material`): tabs Inventory (+ **chart 18** stock-vs-reorder),
  Requests, Purchase Orders, Suppliers, Usage.
- **Subcontractor module** (`/subcon`): tabs Work Orders, Progress, RA Bills,
  Material Issues, Subcontractors.
- **PO / Work Order PDFs** via print-optimized A4 routes
  (`/material/po/[id]/print`, `/subcon/wo/[id]/print`) + `PrintButton` +
  `DocumentShell`; `@media print` in globals.css hides app chrome
  (sidebar/topbar tagged `data-app-chrome`).
- Enabled Material/Subcontractor in `src/lib/nav.ts` (removed `phase: 2`).
- Result: `npm run build` green (23 routes), lint clean, all routes 200.

---

## Current state (as of last session)

- Phases 0, 1, 2 complete as **UI on mock data**. Building green, lint clean.
- All "buttons" (New X, Upload, Approve, PDF-of-quotation) are UI-only stubs
  except PO/WO print, which produce real PDFs via the browser.
- Sidebar: Payroll & Equipment still disabled (`phase: 3`).

## Next steps (pick up here)

1. **Phase 3** — Payroll & Attendance, Petty Site Expenses (approval + supervisor
   balance), Equipment & Assets. Add charts 14 (cash-flow) & 19 (payroll breakdown).
   Enable the `phase: 3` nav items when built.
2. **Supabase wiring** (can be done before or after Phase 3) — Auth, Postgres
   schema + RLS from `PLAN.md §C.3`, then reimplement `src/lib/mock/selectors.ts`
   as server queries / views. Component props are stable, so pages barely change.
3. **Phase 4** — full company analytics (charts 15, 17 Gantt), notifications,
   offline background-sync, role-based dashboards, export/reporting.

See `LESSONS.md` before starting — it has the non-obvious constraints.
