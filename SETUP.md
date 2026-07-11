# SiteHub — Setup & Run

Internal construction & design project-management platform for Charu.
See `PLAN.md` (in the Google Drive project folder) for the full scope and roadmap.

## Status

- **Phase 0 (Foundation)** ✅ — Next.js 16 + React 19 + Tailwind v4, app shell, design system, PWA manifest.
- **Phase 1 (must-have modules)** ✅ UI on a **mock data layer** — Projects/Tasks/Progress, Design Management, CRM + Quotation + BOQ, Dashboards & P&L (charts 1–13, 16).
- **Phase 2 (Material & Subcontractor)** ✅ UI on mock data — warehouse inventory + stock-level chart (18), material requests, purchase orders, suppliers, usage; subcontractors, work orders, progress, RA bills, material issues. PO & Work Order produce real PDFs via **print-optimized A4 views** (browser Print → Save as PDF).
- **Phase 3 (Payroll/Attendance · Petty Expenses · Equipment)** ✅ UI on mock data — GPS labour attendance, staff payroll + salary-slip print (chart 19), contractors, advances; petty-expense approval + supervisor imprest ledger; equipment/tools/assets. Cash-flow chart (14) added to the dashboard.
- **Phase 4 (Analytics & polish)** ✅ UI on mock data — Company Analytics page (portfolio health chart 15, portfolio Gantt chart 17), per-project Gantt on the Tasks tab, live notifications dropdown in the topbar.
- **Supabase wiring** 🟡 in progress — schema migration + RLS and client helpers landed (`supabase/migrations/0001_init.sql`, `src/lib/supabase/`). Still pending: swapping `selectors.ts` for server queries on the read-only pages.
- **Live multi-device sync** 🟢 code complete, awaiting DB apply — the client stores (`src/lib/store/project-store.tsx`, `category-store.tsx`) now run **Supabase + Realtime** when env is set, so a change on one device streams to all others in ~1s; they fall back to localStorage/mock when env is absent. New: `supabase/migrations/0002_realtime_activity.sql` (activity_log + categories tables, dynamic-category columns, DPR photos, Realtime enabled), `src/lib/supabase/active-org.ts`, inverse row-writers in `src/lib/data/mappers.ts`. To go live: apply `supabase/apply_all.sql` in the SQL editor, set `.env.local`, sign up, and link the user in `memberships`.

> **Run location:** the runnable copy lives on **local disk** at `C:\Users\<you>\sitehub` — **not** on Google Drive, which leaves `node_modules` as 0-byte stubs and won't start (`next` fails to load). Copy source to local disk and `npm ci` there.

Without env the app still runs with **no backend** — data comes from `src/lib/mock/data.ts`. With env + the migrated DB it reads/writes live Postgres.

## Requirements

- Node ≥ 20 (built on Node 24)
- npm

## Run

```bash
cd C:\Users\dell\sitehub
npm install      # first time only
npm run dev      # http://localhost:3000
```

Other scripts:

```bash
npm run build    # production build (currently green)
npm run start    # serve the production build
npm run lint
```

> **Location note:** the app lives at `C:\Users\dell\sitehub` (local disk),
> **not** inside Google Drive. Next.js/Turbopack writes thousands of files to
> `node_modules` and `.next`; keeping those in a synced Drive folder causes
> file-lock errors and slow builds. Keep code here and treat `PLAN.md` in Drive
> as the spec of record.

## Where things are

```
src/
  app/                      route segments (App Router)
    page.tsx                Company Dashboard (charts 9–13, 16)
    projects/               list + [id] detail (tabs: Overview/Tasks/Updates/Design/Commercial/Files)
    clients/                CRM list + [id] detail
    quotations/             quotations with line items + totals
    invoices/               sales invoices
    design/                 drawings + revisions
    material/               inventory/requests/POs/suppliers/usage + po/[id]/print
    subcon/                 work orders/progress/RA bills/issues + wo/[id]/print
  components/
    layout/                 app shell (sidebar, topbar, page header)
    ui/                     primitives (button, card, badge, table, tabs, …)
    charts/                 Recharts components (gauge, donut, bars, trends, pie)
    dashboard/              StatCard
    projects/               project detail tabs
    design/                 DrawingList (shared)
  lib/
    types.ts                domain types (mirror planned Postgres schema)
    labels.ts               status → label/badge-variant maps
    nav.ts                  sidebar config
    utils.ts                cn(), INR/number formatters
    mock/
      data.ts               seed data (single source of truth)
      selectors.ts          derived values (P&L, expense breakdowns, trends)
```

The dashboards are **derived** from `selectors.ts` (P&L, expense by category /
cost code, monthly trends), never from stored totals — same principle the
Supabase views/RPCs will follow.

## Next step — Supabase wire-up

The mock layer is shaped to swap for Supabase with minimal churn. Progress:

1. ✅ `npm i @supabase/supabase-js @supabase/ssr` (installed).
2. ✅ Schema landed — `supabase/migrations/0001_init.sql`: every table across
   Phases 1–4 (org/profiles/memberships, clients, projects, tasks, drawings,
   quotations, BOQ, invoices, transactions, material, subcon, payroll,
   attendance, advances, equipment, notifications) with enums, FK indexes and
   **RLS scoped by `org_id`** (one member-scoped policy per table via a `DO`
   loop; `is_org_member()` is `security definer` so policies don't recurse).
   `handle_new_user()` auto-creates a profile on signup.
3. ✅ Client helpers — `src/lib/supabase/client.ts` (browser) and `server.ts`
   (SSR, cookie-wired so RLS sees the user). `.env.example` documents the vars.

4. 🟡 **Data-access seam (read paths migrated)** — `src/lib/data/` holds async,
   env-gated queries that hit Supabase when configured and **fall back to mock**
   until then (`isSupabaseConfigured()` in `src/lib/supabase/config.ts`). Pieces:
   - `mappers.ts` — snake_case DB rows → camelCase domain types.
   - `compute.ts` — pure, data-injected P&L / trend / cash-flow / portfolio math
     (no mock imports), so derived dashboards work against either source.
   - `crm.ts`, `projects.ts`, `dashboard.ts`, `commercial.ts`, `design.ts`,
     `operations.ts`, `material.ts`, `subcon.ts` — `server-only` query modules
     (parallel `Promise.all` fetches + joins). **Equipment**, **Material** and
     **Subcon** show the client-component pattern: the route page fetches a typed
     `board` and passes it to the (client) module/tabs as props; derived helpers
     (`stockLevels`, `poTotals`, `woTotals`, `materialConsumption`, …) moved to
     `compute.ts` as pure fns.
   Migrated pages (now `async`, identical render on mock): **Company Dashboard**,
   **Analytics**, **Clients list**, **Client detail** (async
   `generateStaticParams`), **Projects list**, **Quotations**, **Invoices**,
   **Design**, **Equipment**, **Material** (5 tabs + PO print doc), **Subcon**
   (5 tabs + WO print doc).
5. ✅ **Demo seed** — `supabase/seed.sql` populates the tables those pages read
   (org, clients, projects, tasks, transactions, invoices, BOQ, quotations,
   drawings, equipment, material items/requests/POs/receipts/usage, suppliers,
   subcontractors/work orders/progress/RA bills/material issues) with
   deterministic UUIDs, mirroring the mock. Apply after the migration so the
   read surface lights up with real data.

Remaining:

6. Create a Supabase project; copy `.env.example` → `.env.local` and fill in
   `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (never commit).
   `supabase db reset` (runs migration + seed), then `insert into memberships`
   linking your signed-in user to the org (see the note at the foot of the
   seed). The migrated pages then read live data with **no code change**.
7. Migrate the last two client-component modules (payroll, expenses) by passing
   server-fetched props in — same pattern as Equipment/Material/Subcon; extend
   `seed.sql` with their tables. Both carry person-linked columns (`by_id`,
   `supervisor_id`, author/approver, attendance authors, …) that seed cleanly
   only once real users exist, so do them after the auth/sign-in step.
8. Add `middleware.ts` for Supabase Auth session refresh + a sign-in flow.
