# SiteHub — Setup & Run

Internal construction & design project-management platform for Charu.
See `PLAN.md` (in the Google Drive project folder) for the full scope and roadmap.

## Status

- **Phase 0 (Foundation)** ✅ — Next.js 16 + React 19 + Tailwind v4, app shell, design system, PWA manifest.
- **Phase 1 (must-have modules)** ✅ UI on a **mock data layer** — Projects/Tasks/Progress, Design Management, CRM + Quotation + BOQ, Dashboards & P&L (charts 1–13, 16).
- **Phase 2 (Material & Subcontractor)** ✅ UI on mock data — warehouse inventory + stock-level chart (18), material requests, purchase orders, suppliers, usage; subcontractors, work orders, progress, RA bills, material issues. PO & Work Order produce real PDFs via **print-optimized A4 views** (browser Print → Save as PDF).
- **Phase 3 (Payroll/Attendance · Petty Expenses · Equipment)** ✅ UI on mock data — GPS labour attendance, staff payroll + salary-slip print (chart 19), contractors, advances; petty-expense approval + supervisor imprest ledger; equipment/tools/assets. Cash-flow chart (14) added to the dashboard.
- **Phase 4 (Analytics & polish)** ✅ UI on mock data — Company Analytics page (portfolio health chart 15, portfolio Gantt chart 17), per-project Gantt on the Tasks tab, live notifications dropdown in the topbar.
- **Supabase wiring** 🟡 in progress — schema migration + RLS and client helpers landed (`supabase/migrations/0001_init.sql`, `src/lib/supabase/`). Still pending: a live project, swapping `selectors.ts` for server queries, and Auth.

Everything still runs with **no backend** — data comes from `src/lib/mock/data.ts` until the queries are swapped.

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

## Project team assignment & scoped visibility (migrations 0008–0010)

The super admin assigns users (any of the 11 roles) to projects from each
project's **Team** tab; non-super-admins then only see the projects they're
assigned to (lists, dashboards, tasks, expenses, transactions, invoices,
design). **Assignment is always manual and super_admin-only** — creating a
project, setting its `pm_id`, or anything else never adds anyone to a roster
(a PM who creates a project won't see it until the super admin assigns them).
Apply on a live DB **in this order**:

1. `0008_roles_enum.sql` — extends the `role` enum (super_admin, supervisor,
   hr, staff, viewer) + `memberships.is_active`. Run alone: new enum values
   can't be *used* in the transaction that adds them.
2. `0009_project_members.sql` — `project_members` table + RLS (writes =
   super_admin only) and the `is_project_member()` helper.
3. **Deploy the app**, then have the super admin fill each project's Team tab
   — including every PM: nobody is enrolled automatically.
4. `0010_project_scoped_visibility.sql` — flips RLS so non-super-admins only
   read rows for assigned projects, and re-filters `list_org_projects()`
   (security definer, so it must filter itself). Applying this last avoids
   locking out users who haven't been assigned yet.
5. `0011_remove_auto_assignment.sql` — only needed on DBs that ran the earlier
   revision of 0009 (which auto-enrolled the PM/creator via a trigger): drops
   that trigger. Harmless no-op elsewhere.

Until 0009/0010 are applied the app degrades gracefully: the client store and
server data layer treat a missing `project_members` table as "org-wide
visibility" (today's behavior). Material/subcon/equipment/notifications and
item child tables (boq_items, …) stay org-scoped by role — follow-up.
