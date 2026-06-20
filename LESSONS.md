# SiteHub — Lessons & Decisions

Non-obvious things learned while building. Read before continuing so you don't
re-discover them the hard way.

## Environment / location
- **Keep the app off Google Drive.** Code lives at `C:\Users\dell\sitehub`, not in
  `G:\My Drive\...\Construction Management Software` (that holds only `PLAN.md`).
  Next.js writes thousands of files to `node_modules`/`.next`; on a synced Drive
  folder that causes file-lock errors and slow/failed builds. Paths with `#` also
  break Turbopack.
- Windows + Git Bash for tooling. `npm run build`/`dev`/`lint` all work.

## Build / tooling gotchas
- **Recharts 3 tooltip `formatter` typing is strict.** The `value` arg is
  `ValueType | undefined`, so an explicit `(v: number) => ...` fails type-check.
  Write `formatter={(v, n) => [formatINR(Number(v)), n]}` — no annotation, coerce
  with `Number()`. (This bit us once; all chart tooltips now follow this.)
- **`ResponsiveContainer` logs `width(-1) height(-1)` during `next build`.** Harmless
  SSG warning (no DOM at prerender). Charts render fine in-browser. When grepping
  build output, filter these lines out to read real errors.
- **Next 16 route params are async.** In server pages use
  `({ params }: { params: Promise<{ id: string }> })` and `const { id } = await params;`.
  Dynamic routes also export `generateStaticParams()` so they SSG.
- **`lucide-react` v1**: `Image` icon clashes with `next/image`; import it aliased
  (`Image as ImageIcon`). Watch for similar name clashes.
- After edits, `npx tsc --noEmit` is a fast pre-build typecheck; keep lint clean
  (it caught an unused import once).

## Architecture decisions
- **UI primitives are hand-rolled** (`src/components/ui/`), not shadcn-CLI. Same
  visual tokens, simpler/no-Radix, fully under our control. `Tabs` is a small
  context-based client component (no Radix).
- **Mock-first.** Pages render from `src/lib/mock/data.ts`; all derived numbers
  (P&L, expense breakdowns, trends, GST splits, totals) live in
  `src/lib/mock/selectors.ts`. This mirrors the planned Postgres views/RPCs —
  when wiring Supabase, replace selector bodies, keep component props identical.
- **Pattern per module:** server `page.tsx` → client module component with `Tabs`.
  Interactive tabs are client components that import mock data directly (fine for
  static seed data). List pages are server components.
- **Tables/cards/badges** come from `ui/`; status→label/variant maps live in
  `src/lib/labels.ts` (one place to restyle statuses).

## PDF / print
- **PO & Work Order PDFs use the browser, not a library.** Dedicated print routes
  render an A4 `DocumentShell`; `PrintButton` calls `window.print()`. `@media print`
  in `globals.css` sets `[data-app-chrome]{display:none}` + `@page A4` so only the
  document prints. Sidebar & topbar are tagged `data-app-chrome`.
- `@react-pdf/renderer` (per `PLAN.md`) was deferred — the print view covers the
  need with zero dependency and the same layout can feed react-pdf later.

## Data conventions
- Currency = INR via `formatINR()` (`{ compact: true }` for KPIs/axes). Today's
  date context is mid-June 2026; seed data spans 2025-09 → 2026-06 across projects
  p1–p4 so dashboards/trends look populated.
- GST shown as CGST+SGST split (`gstSplit()` = taxRate/2 each).
- Some material items are intentionally below reorder level to exercise chart 18's
  low-stock (red) styling.

## Watch-outs for next phases
- When enabling `phase: 3` nav items, remove the `phase` field in `src/lib/nav.ts`
  (the sidebar disables any item with a truthy `phase`).
- Keep new derived values in `selectors.ts`, not inline in components, so the
  Supabase swap stays mechanical.
