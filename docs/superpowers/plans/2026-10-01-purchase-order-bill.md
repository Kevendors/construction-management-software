# Purchase Order/Bill Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Purchase Order/Bill" module to the Commercial section — a page that shows the
existing Purchase Orders (reused from the Material module, not forked) alongside a brand-new
Purchase Bill concept (the vendor's own bill/invoice to us, with Draft→Sent→Partial→Paid payment
tracking), with a "Convert to Bill" handoff from a PO.

**Architecture:** `purchase_bills`/`purchase_bill_items` tables modeled directly on
`sales_invoices`/`invoice_items` (normalized columns + a `payload jsonb` holding the full builder
state). A new `src/lib/purchases/compute.ts` mirrors `src/lib/invoice/compute.ts` exactly
(`BillState`/`computeBill`). Server actions in `src/app/purchases/actions.ts` mirror
`src/app/invoices/actions.ts`. UI at `/purchases` (list, two tabs) and `/purchases/bill/new`
(builder) mirror the Quotations/Invoices list and builder pages pixel-for-pixel in structure.

**Tech Stack:** Next.js 16 App Router + Server Actions, Supabase (Postgres + RLS), TypeScript,
Tailwind v4 — same stack as every other module in this codebase, no new dependencies.

## Global Constraints

- No automated test suite exists in this project — "testing" a task means `npm run build` in the
  local mirror (`C:\Users\dell\sitehub-build`) for type-check, plus a live manual/browser check
  against the deployed site once pushed. There is no `pytest`/`jest` to run.
- **Claude cannot execute DDL directly** — no Postgres connection is available, only the Supabase
  REST/Storage APIs. The migration SQL must be pasted into the Supabase SQL editor **by the user**,
  with exact plain-language steps (see Task 1).
- Every new Server Action file mirrors the existing pattern exactly: `getAuthContext()` → role
  gate → `createAdminClient()` write where privileged, `logActivity()`, `{ id?, error? }` return —
  see `src/app/invoices/actions.ts` for the canonical example.
- Follow existing TypeScript/React conventions already in the codebase (feature folders under
  `src/components/<feature>/`, thin server page + client module, snake_case↔camelCase mapping in
  `src/lib/data/mappers.ts`).
- Mirror to the local build directory and run `npm run build` before every commit (never build on
  the Drive-synced `sitehub/` folder directly — see `CLAUDE.md`).
- Push to `main` only after a clean build; poll the Vercel deployment status via
  `gh api repos/Kevendors/construction-management-software/commits/<sha>/status` before
  live-verifying.

---

### Task 1: Migration — `purchase_bills` / `purchase_bill_items` tables + RLS

**Files:**
- Create: `supabase/migrations/0025_purchase_bills.sql`

**Interfaces:**
- Produces: `purchase_bills` table (`id, org_id, number, supplier_id, project_id, source_po_id,
  date, due_date, tax_rate, paid, status, payload, created_at`), `purchase_bill_items` table
  (`id, org_id, bill_id, description, material_item_id, qty, unit, rate`), enum
  `purchase_bill_status` (`'draft'|'sent'|'partial'|'paid'`).

- [ ] **Step 1: Write the migration**

```sql
-- ----------------------------------------------------------------------------
-- 0025 — Purchase Bills (accounts payable for material suppliers)
--
-- The purchase-side mirror of sales_invoices: a vendor's own bill to us,
-- tracking what we owe and what's been paid. Reuses the existing
-- purchase_orders/suppliers/projects tables; source_po_id is an optional
-- link back to the PO a bill was converted from (null for a standalone
-- bill that never had a formal PO).
--
-- Safe to re-run. Apply in the Supabase SQL editor.
-- ----------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'purchase_bill_status') then
    create type purchase_bill_status as enum ('draft', 'sent', 'partial', 'paid');
  end if;
end $$;

create table if not exists public.purchase_bills (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.orgs(id) on delete cascade,
  number       text not null,
  supplier_id  uuid references public.suppliers(id) on delete set null,
  project_id   uuid references public.projects(id) on delete set null,
  source_po_id uuid references public.purchase_orders(id) on delete set null,
  date         date not null,
  due_date     date,
  tax_rate     numeric not null default 0,
  paid         numeric not null default 0,
  status       purchase_bill_status not null default 'draft',
  payload      jsonb,
  created_at   timestamptz not null default now()
);

create table if not exists public.purchase_bill_items (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.orgs(id) on delete cascade,
  bill_id           uuid not null references public.purchase_bills(id) on delete cascade,
  description       text not null,
  material_item_id  uuid references public.material_items(id) on delete set null,
  qty               numeric not null default 0,
  unit              text,
  rate              numeric not null default 0
);

alter table public.purchase_bills enable row level security;
alter table public.purchase_bill_items enable row level security;

-- Read: any org member (same as sales_invoices / purchase_orders read policy).
drop policy if exists purchase_bills_read on public.purchase_bills;
create policy purchase_bills_read on public.purchase_bills
  for select using (is_org_member(org_id));

drop policy if exists purchase_bill_items_read on public.purchase_bill_items;
create policy purchase_bill_items_read on public.purchase_bill_items
  for select using (is_org_member(org_id));

-- Write: super_admin, accountant, or whichever roles already have the
-- purchase_orders write policy's role set (mirrors 0013's PO grant group) —
-- re-using has_role so this never drifts from the PO write policy by hand.
drop policy if exists purchase_bills_write on public.purchase_bills;
create policy purchase_bills_write on public.purchase_bills
  for all using (
    has_role(org_id, array['super_admin', 'accountant', 'pm', 'site_engineer'])
  ) with check (
    has_role(org_id, array['super_admin', 'accountant', 'pm', 'site_engineer'])
  );

drop policy if exists purchase_bill_items_write on public.purchase_bill_items;
create policy purchase_bill_items_write on public.purchase_bill_items
  for all using (
    has_role(org_id, array['super_admin', 'accountant', 'pm', 'site_engineer'])
  ) with check (
    has_role(org_id, array['super_admin', 'accountant', 'pm', 'site_engineer'])
  );

create index if not exists purchase_bills_org_idx on public.purchase_bills (org_id);
create index if not exists purchase_bills_source_po_idx on public.purchase_bills (source_po_id);
create index if not exists purchase_bill_items_bill_idx on public.purchase_bill_items (bill_id);
```

- [ ] **Step 2: Check the write-policy role list against this project's live `purchase_orders` policy before applying**

Run this against the live DB (I can do this myself via the service-role REST API — no user
action needed) to see the exact role array the existing PO write policy uses, so Step 1's
`purchase_bills_write`/`purchase_bill_items_write` role list matches it exactly (the list above —
`super_admin, accountant, pm, site_engineer` — is a best guess from `Role` in `src/lib/types.ts`
and must be corrected to whatever `0013_purchase_order_grants.sql` actually wrote):

```bash
curl -s "$URL/rest/v1/rpc/pg_get_policydef" ... # or simply open
# supabase/migrations/0013_purchase_order_grants.sql and 0014_purchase_orders_project_scoped.sql
# in this repo and copy their exact role array into Step 1 before handing the SQL to the user.
```

Read both files directly (`Read` tool) — do not guess. Update Step 1's SQL to match exactly, then
proceed.

- [ ] **Step 3: Hand the corrected SQL to the user**

Tell them, in plain numbered steps (same format used earlier in this project for migrations
0023/0024): go to supabase.com → log in → open the project → SQL Editor → New query → paste the
corrected SQL from Step 1 → Run → confirm "Success. No rows returned".

- [ ] **Step 4: Verify the tables exist**

Once the user confirms success, verify via the service-role REST API:

```bash
curl -s "$URL/rest/v1/purchase_bills?select=id&limit=1" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

Expected: `[]` (empty array, not a `42P01`/`PGRST205` "relation does not exist" error).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0025_purchase_bills.sql
git commit -m "feat: add purchase_bills/purchase_bill_items tables"
```

---

### Task 2: Types, status labels, and mappers

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/labels.ts`
- Modify: `src/lib/data/mappers.ts`

**Interfaces:**
- Consumes: `PurchaseOrder`, `PoItem`, `Supplier` (already defined in `src/lib/types.ts`).
- Produces: `PurchaseBillStatus`, `PurchaseBill`, `PurchaseBillItem` types; `purchaseBillStatusMeta`
  label map; `PurchaseBillRow`/`PurchaseBillItemRow` + `mapPurchaseBill`/`mapPurchaseBillItem` in
  `mappers.ts` — every later task that reads a bill row uses these exact names.

- [ ] **Step 1: Add types to `src/lib/types.ts`** (near `PurchaseOrder`, after line 333)

```typescript
export type PurchaseBillStatus = "draft" | "sent" | "partial" | "paid";

export interface PurchaseBillItem {
  id: string;
  description: string;
  materialItemId: string | null;
  qty: number;
  unit: string;
  rate: number;
}

export interface PurchaseBill {
  id: string;
  number: string;
  supplierId: string;
  projectId: string;
  sourcePoId: string | null;
  date: string;
  dueDate: string;
  status: PurchaseBillStatus;
  taxRate: number;
  paid: number;
  items: PurchaseBillItem[];
}
```

- [ ] **Step 2: Add status labels to `src/lib/labels.ts`** (near `poStatusMeta`)

```typescript
export const purchaseBillStatusMeta: Record<PurchaseBillStatus, { label: string; variant: Variant }> = {
  draft: { label: "Draft", variant: "muted" },
  sent: { label: "Sent", variant: "info" },
  partial: { label: "Partial", variant: "warning" },
  paid: { label: "Paid", variant: "success" },
};
```

Add `PurchaseBillStatus` to the existing `import type { ... } from "./types"` line at the top of
`labels.ts`.

- [ ] **Step 3: Add row types + mappers to `src/lib/data/mappers.ts`** (near `mapPurchaseOrder`,
  after line 435)

```typescript
export interface PurchaseBillItemRow {
  id: string;
  description: string;
  material_item_id: string | null;
  qty: number;
  unit: string | null;
  rate: number;
}

export const mapPurchaseBillItem = (r: PurchaseBillItemRow): PurchaseBillItem => ({
  id: r.id,
  description: r.description,
  materialItemId: r.material_item_id,
  qty: Number(r.qty),
  unit: r.unit ?? "",
  rate: Number(r.rate),
});

export interface PurchaseBillRow {
  id: string;
  number: string;
  supplier_id: string | null;
  project_id: string | null;
  source_po_id: string | null;
  date: string;
  due_date: string | null;
  status: PurchaseBill["status"];
  tax_rate: number;
  paid: number;
  purchase_bill_items?: PurchaseBillItemRow[];
}

export const mapPurchaseBill = (r: PurchaseBillRow): PurchaseBill => ({
  id: r.id,
  number: r.number,
  supplierId: r.supplier_id ?? "",
  projectId: r.project_id ?? "",
  sourcePoId: r.source_po_id,
  date: r.date,
  dueDate: r.due_date ?? "",
  status: r.status,
  taxRate: Number(r.tax_rate),
  paid: Number(r.paid),
  items: (r.purchase_bill_items ?? []).map(mapPurchaseBillItem),
});
```

Add `PurchaseBill, PurchaseBillItem` to the existing `import type { ... } from "@/lib/types"` line
at the top of `mappers.ts`.

- [ ] **Step 4: Verify types compile**

Mirror `src` to the build dir and run the build (every task from here on does this the same way —
subsequent tasks just say "build and verify"):

```bash
robocopy "G:\My Drive\Keyvendors\Ad hocs\Construction Management Software\sitehub\src" "C:\Users\dell\sitehub-build\src" /MIR
cd /c/Users/dell/sitehub-build && npm run build
```

Expected: `✓ Compiled successfully` (this task adds no consumers yet, so no new errors).

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/labels.ts src/lib/data/mappers.ts
git commit -m "feat: add PurchaseBill types, status labels, and row mappers"
```

---

### Task 3: `src/lib/purchases/compute.ts` — BillState + computeBill

**Files:**
- Create: `src/lib/purchases/compute.ts`

**Interfaces:**
- Consumes: `getLumpsumMode`, `isLumpsum`, `LumpsumMode` from `@/lib/quotation/compute`;
  `amountInWords` from `@/lib/quotation/amount-in-words`; `PurchaseOrder`, `PoItem`, `Supplier`,
  `Project` from `@/lib/types`.
- Produces: `BillLine`, `BillState`, `ComputedBillLine`, `ComputedBill`, `computeBill(s)`,
  `billLineAmount(l)`, `nextBillNumber()`, `poToBillState(po, supplier, project)` — every later
  task that builds or saves a bill imports from here.

- [ ] **Step 1: Write the module**, a direct mirror of `src/lib/invoice/compute.ts` with
  client/invoice fields renamed to supplier/bill fields, plus the new `poToBillState` converter:

```typescript
import { amountInWords } from "../quotation/amount-in-words";
import { getLumpsumMode, isLumpsum, type LumpsumMode } from "../quotation/compute";
import type { PurchaseOrder, Project, Supplier } from "@/lib/types";

export type { LumpsumMode };

export interface BillLine {
  id: string;
  description: string;
  unit: string;
  qty: number;
  rate: number;
  materialItemId?: string | null;
  specific?: string;
  lumpsumMode?: LumpsumMode;
}

export type TaxMode = "intra" | "inter";

export interface BillState {
  // Supplier
  supplierName: string;
  company: string;
  address: string;
  supplierGstin: string;
  contact: string;
  email: string;
  // Bill details
  number: string;
  date: string;
  dueDate: string;
  projectName: string;
  sourcePoId: string | null;
  // Tax
  taxMode: TaxMode;
  gstRate: number;
  discount: number;
  // Lines
  lines: BillLine[];
  // Notes
  notes: string;
  terms: string;
}

export interface ComputedBillLine extends BillLine {
  amount: number;
}

export interface ComputedBill {
  lines: ComputedBillLine[];
  subtotal: number;
  discount: number;
  finalAmount: number;
  gstRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  payableGst: number;
  grandTotal: number;
  words: string;
}

/** PB-<year>-<base36 tail of the clock>, parallel to INV-/PI-. */
export function nextBillNumber(): string {
  return `PB-${new Date().getFullYear()}-${Date.now().toString(36).slice(-5).toUpperCase()}`;
}

/** Amount = Quantity × Rate, or just Rate for lump-sum lines. */
export function billLineAmount(l: BillLine): number {
  if (isLumpsum(l)) return l.rate || 0;
  return (l.rate || 0) * (l.qty || 0);
}

export { getLumpsumMode, isLumpsum };

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeBill(s: BillState): ComputedBill {
  const lines: ComputedBillLine[] = s.lines.map((l) => ({ ...l, amount: round2(billLineAmount(l)) }));
  const subtotal = round2(lines.reduce((sum, l) => sum + l.amount, 0));
  const discount = round2(Math.min(s.discount || 0, subtotal));
  const payableGst = round2((subtotal * (s.gstRate || 0)) / 100);
  const isIntra = s.taxMode === "intra";
  const finalAmount = round2(Math.max(0, subtotal - discount));
  const grandTotal = round2(finalAmount + payableGst);
  return {
    lines,
    subtotal,
    discount,
    finalAmount,
    gstRate: s.gstRate || 0,
    cgst: round2(isIntra ? payableGst / 2 : 0),
    sgst: round2(isIntra ? payableGst / 2 : 0),
    igst: round2(isIntra ? 0 : payableGst),
    payableGst,
    grandTotal,
    words: grandTotal > 0 ? amountInWords(grandTotal) : "Zero",
  };
}

/**
 * Carries a Purchase Order's supplier/project/items across into a fresh Bill
 * draft — the "Convert to Bill" handoff, same pattern as
 * quoteStateToInvoiceState. Nothing is written to the database here; the
 * caller hands this to the builder as a prefill, same as every other
 * conversion in this app.
 */
export function poToBillState(po: PurchaseOrder, supplier: Supplier | null, project: Project | null): BillState {
  return {
    supplierName: supplier?.name ?? "",
    company: supplier?.company ?? "",
    address: supplier?.address ?? "",
    supplierGstin: supplier?.gst ?? "",
    contact: supplier?.phone ?? "",
    email: supplier?.email ?? "",
    number: nextBillNumber(),
    date: new Date().toISOString().slice(0, 10),
    dueDate: "",
    projectName: project?.name ?? "",
    sourcePoId: po.id,
    taxMode: "intra",
    gstRate: po.taxRate || 18,
    discount: po.discount || 0,
    lines: po.items.map((it) => ({
      id: `b${it.id}`,
      description: it.description,
      unit: it.unit,
      qty: it.qty,
      rate: it.rate,
      materialItemId: it.materialItemId,
      specific: "",
      lumpsumMode: "none" as const,
    })),
    notes: "",
    terms: po.terms || "",
  };
}
```

- [ ] **Step 2: Build and verify**

```bash
robocopy "G:\My Drive\Keyvendors\Ad hocs\Construction Management Software\sitehub\src" "C:\Users\dell\sitehub-build\src" /MIR
cd /c/Users/dell/sitehub-build && npm run build
```

Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/purchases/compute.ts
git commit -m "feat: add BillState/computeBill and PO-to-Bill conversion"
```

---

### Task 4: Server actions — `src/app/purchases/actions.ts`

**Files:**
- Create: `src/app/purchases/actions.ts`

**Interfaces:**
- Consumes: `BillState`, `computeBill` from `@/lib/purchases/compute`; `getAuthContext`,
  `isAdminRole` from `@/lib/auth/*`; `logActivity`; `formatINR` from `@/lib/utils`.
- Produces: `SaveResult`, `savePurchaseBillAction(state, grandTotal, existingId?, sourcePoId?)`,
  `PurchaseBillStatus`, `updatePurchaseBillStatusAction(id, status, settlePaid?)`,
  `deletePurchaseBillAction(id)`, `getPurchaseBillPayloadAction(id)` — the Task 7 builder page and
  Task 6 list component import these exact names.

- [ ] **Step 1: Write the file**, mirroring `src/app/invoices/actions.ts` section by section
  (supplier lookup/creation replaces client lookup; `suppliers` table instead of `clients`;
  `purchase_bills`/`purchase_bill_items` instead of `sales_invoices`/`invoice_items`; `paid`
  instead of `received`):

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { computeBill, isLumpsum, type BillState } from "@/lib/purchases/compute";
import { getAuthContext } from "@/lib/auth/context";
import { isAdminRole } from "@/lib/auth/permissions";
import { logActivity } from "@/lib/activity/log";
import { purchaseBillStatusMeta } from "@/lib/labels";
import { formatINR } from "@/lib/utils";

async function currentOrgId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  return (data?.org_id as string | undefined) ?? null;
}

export interface SaveResult {
  id?: string;
  error?: string;
}

/**
 * Create or update a purchase bill (full builder state in payload + line
 * items). Pass `sourcePoId` only on first save of a bill converted from a PO
 * — never touched on update, like status, so re-saving can't re-link it.
 */
export async function savePurchaseBillAction(
  state: BillState,
  grandTotal: number,
  existingId?: string | null,
  sourcePoId?: string | null
): Promise<SaveResult> {
  const supabase = await createClient();
  const orgId = await currentOrgId(supabase);
  if (!orgId) return { error: "You must be signed in to save." };

  // Find or create the supplier from the bill's company/contact details.
  let supplierId: string | null = null;
  const company = (state.company || state.supplierName || "").trim();
  if (company) {
    const findBy = async (column: "company" | "name") => {
      const { data } = await supabase
        .from("suppliers")
        .select("id")
        .eq("org_id", orgId)
        .ilike(column, company)
        .limit(1)
        .maybeSingle();
      return (data?.id as string | undefined) ?? null;
    };
    const existingSupplierId = (await findBy("company")) ?? (await findBy("name"));
    if (existingSupplierId) supplierId = existingSupplierId;
    else {
      const { data: created } = await supabase
        .from("suppliers")
        .insert({
          org_id: orgId,
          name: state.supplierName || company,
          company: state.company || null,
          email: state.email || null,
          phone: state.contact || null,
          gst: state.supplierGstin || null,
          address: state.address || null,
        })
        .select("id")
        .single();
      supplierId = created?.id ?? null;
    }
  }

  // Best-effort link to a project by name.
  let projectId: string | null = null;
  if (state.projectName?.trim()) {
    const { data: proj } = await supabase
      .from("projects")
      .select("id")
      .eq("org_id", orgId)
      .ilike("name", state.projectName.trim())
      .limit(1)
      .maybeSingle();
    projectId = proj?.id ?? null;
  }

  const c = computeBill(state);
  const base = {
    org_id: orgId,
    number: state.number || "—",
    supplier_id: supplierId,
    project_id: projectId,
    date: state.date,
    due_date: state.dueDate || null,
    tax_rate: state.gstRate || 0,
    payload: { ...state, grandTotal: c.grandTotal },
  };

  let billId: string;
  if (existingId) {
    // status/paid deliberately omitted on update — owned by the list's
    // status control and payment recording, not by re-saving the builder.
    const { error } = await supabase.from("purchase_bills").update(base).eq("id", existingId);
    if (error) return { error: error.message };
    billId = existingId;
    await supabase.from("purchase_bill_items").delete().eq("bill_id", billId);
  } else {
    const { data, error } = await supabase
      .from("purchase_bills")
      .insert({
        ...base,
        status: "draft" as const,
        paid: 0,
        source_po_id: sourcePoId || null,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    billId = data.id as string;
  }

  if (state.lines.length) {
    const items = state.lines.map((l) => ({
      org_id: orgId,
      bill_id: billId,
      description: l.description,
      material_item_id: l.materialItemId || null,
      qty: isLumpsum(l) ? 1 : l.qty || 0,
      unit: l.unit,
      rate: l.rate || 0,
    }));
    const { error: iErr } = await supabase.from("purchase_bill_items").insert(items);
    if (iErr) return { error: iErr.message };
  }

  await logActivity({
    action: existingId ? "updated" : "created",
    entityType: "purchase_bill",
    entityId: billId,
    summary: `${existingId ? "Updated" : "Created"} purchase bill ${state.number || ""} (${formatINR(c.grandTotal)})`.trim(),
  });
  return { id: billId };
}

export type PurchaseBillStatus = "draft" | "sent" | "partial" | "paid";
const BILL_STATUSES: PurchaseBillStatus[] = ["draft", "sent", "partial", "paid"];

/**
 * Update a purchase bill's status. Pass `settlePaid` when marking a bill
 * paid to also record the full outstanding amount as paid — mirrors
 * updateInvoiceStatusAction's settleReceived, same reasoning: a manual
 * "Mark Paid" with no settle would read Paid against ₹0 paid. The total is
 * computed here from the stored line items, not trusted from the client.
 */
export async function updatePurchaseBillStatusAction(
  id: string,
  status: PurchaseBillStatus,
  settlePaid = false
): Promise<SaveResult> {
  if (!BILL_STATUSES.includes(status)) return { error: "Unknown bill status." };
  const supabase = await createClient();

  const update: { status: PurchaseBillStatus; paid?: number } = { status };
  if (settlePaid && status === "paid") {
    const { data: bill } = await supabase
      .from("purchase_bills")
      .select("tax_rate, purchase_bill_items(qty, rate)")
      .eq("id", id)
      .maybeSingle();
    if (bill) {
      const row = bill as unknown as { tax_rate: number | null; purchase_bill_items?: { qty: number; rate: number }[] };
      const sub = (row.purchase_bill_items ?? []).reduce((s, it) => s + Number(it.qty) * Number(it.rate), 0);
      update.paid = Math.round(sub * (1 + Number(row.tax_rate ?? 0) / 100) * 100) / 100;
    }
  }

  const { error } = await supabase.from("purchase_bills").update(update).eq("id", id);
  if (error) return { error: error.message };
  await logActivity({
    action: "updated",
    entityType: "purchase_bill",
    entityId: id,
    summary: `Marked purchase bill ${purchaseBillStatusMeta[status]?.label ?? status}`,
  });
  return { id };
}

/**
 * Super-admin-only: permanently delete a purchase bill. Paid and
 * partially-paid bills are refused — money has moved against them and the
 * row is the record of it.
 */
export async function deletePurchaseBillAction(id: string): Promise<SaveResult> {
  const ctx = await getAuthContext();
  if (!ctx || !isAdminRole(ctx.role)) return { error: "Only a Super Admin can delete a purchase bill." };

  const supabase = await createClient();
  const { data: bill, error: findErr } = await supabase
    .from("purchase_bills")
    .select("id, number, status, paid")
    .eq("id", id)
    .maybeSingle();
  if (findErr) return { error: findErr.message };
  if (!bill) return { error: "That purchase bill no longer exists." };

  if (bill.status === "paid" || bill.status === "partial") {
    return { error: "Paid and partly-paid bills can't be deleted — they're the record of money paid." };
  }
  if (Number(bill.paid) > 0) {
    return { error: "This bill has payments recorded against it and can't be deleted." };
  }

  const { error } = await supabase.from("purchase_bills").delete().eq("id", id);
  if (error) return { error: error.message };

  await logActivity({
    action: "deleted",
    entityType: "purchase_bill",
    entityId: id,
    summary: `Deleted purchase bill ${bill.number}`,
  });
  return { id };
}

/**
 * Load a saved purchase bill's builder state for re-opening / editing.
 * Payload-first, falling back to reconstructing from columns + items for any
 * bill saved before the payload column existed (none should exist yet, but
 * this keeps the same safety net getInvoicePayloadAction already has).
 */
export async function getPurchaseBillPayloadAction(id: string): Promise<BillState | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("purchase_bills")
    .select(
      "payload, number, date, due_date, tax_rate, purchase_bill_items(id, description, qty, unit, rate), suppliers(name, company, email, phone, address, gst), projects(name)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  const payload = data.payload as BillState | undefined;
  if (payload) return payload;

  const row = data as unknown as {
    number: string | null;
    date: string;
    due_date: string | null;
    tax_rate: number | null;
    purchase_bill_items?: { id: string; description: string; qty: number; unit: string | null; rate: number }[];
    suppliers?: { name?: string; company?: string; email?: string; phone?: string; address?: string; gst?: string } | null;
    projects?: { name?: string } | null;
  };

  return {
    supplierName: row.suppliers?.name ?? "",
    company: row.suppliers?.company ?? "",
    address: row.suppliers?.address ?? "",
    supplierGstin: row.suppliers?.gst ?? "",
    contact: row.suppliers?.phone ?? "",
    email: row.suppliers?.email ?? "",
    number: row.number ?? "",
    date: row.date,
    dueDate: row.due_date ?? "",
    projectName: row.projects?.name ?? "",
    sourcePoId: null,
    taxMode: "intra",
    gstRate: Number(row.tax_rate ?? 0),
    discount: 0,
    lines: (row.purchase_bill_items ?? []).map((it) => ({
      id: it.id,
      description: it.description,
      unit: it.unit ?? "NOS",
      qty: Number(it.qty) || 0,
      rate: Number(it.rate) || 0,
      lumpsumMode: "none" as const,
    })),
    notes: "",
    terms: "",
  };
}
```

- [ ] **Step 2: Build and verify**

```bash
robocopy "G:\My Drive\Keyvendors\Ad hocs\Construction Management Software\sitehub\src" "C:\Users\dell\sitehub-build\src" /MIR
cd /c/Users/dell/sitehub-build && npm run build
```

Expected: `✓ Compiled successfully`. (This will fail until the migration from Task 1 is applied
to the *live* DB only when actually *running* the actions — type-check passes regardless, since
Supabase types here are loosely typed strings/`from("purchase_bills")`, not generated types.)

- [ ] **Step 3: Commit**

```bash
git add src/app/purchases/actions.ts
git commit -m "feat: add purchase bill server actions (save/status/delete/payload)"
```

---

### Task 5: Data layer — `src/lib/data/purchases.ts`

**Files:**
- Create: `src/lib/data/purchases.ts`

**Interfaces:**
- Consumes: `PurchaseBill` from `@/lib/types`; `mapPurchaseBill`, `PurchaseBillRow` from
  `./mappers`; `isSupabaseConfigured` from `@/lib/supabase/config`.
- Produces: `getPurchaseBillsBoard()` returning `{ bills: PurchaseBill[] }` — Task 6's list page
  calls this exactly like `src/app/material/page.tsx` calls `getMaterialBoard()`.

- [ ] **Step 1: Write the module**

```typescript
import "server-only";

import type { PurchaseBill } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { mapPurchaseBill, type PurchaseBillRow } from "./mappers";

export interface PurchaseBillsBoard {
  bills: PurchaseBill[];
}

export async function getPurchaseBillsBoard(): Promise<PurchaseBillsBoard> {
  if (!isSupabaseConfigured()) return { bills: [] };
  const supabase = await createSupabase();
  const { data, error } = await supabase
    .from("purchase_bills")
    .select("*, purchase_bill_items(*)")
    .order("date", { ascending: false });
  // Tolerate the migration not being applied yet (42P01/PGRST205) the same
  // way quotations/upload-actions.ts tolerates 0023 not being applied —
  // empty board rather than a hard crash on every page load.
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return { bills: [] };
    throw error;
  }
  return { bills: (data as PurchaseBillRow[]).map(mapPurchaseBill) };
}
```

**Note on the mock-mode branch:** unlike `getMaterialBoard`, there is no existing mock
`purchaseBills` array in `src/lib/mock/data.ts` — returning `{ bills: [] }` for
`!isSupabaseConfigured()` is correct and sufficient (an empty list, not a crash, consistent with
how a brand-new feature with no mock fixture should behave — do not invent mock data here, YAGNI).

- [ ] **Step 2: Build and verify**

```bash
robocopy "G:\My Drive\Keyvendors\Ad hocs\Construction Management Software\sitehub\src" "C:\Users\dell\sitehub-build\src" /MIR
cd /c/Users/dell/sitehub-build && npm run build
```

Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/purchases.ts
git commit -m "feat: add getPurchaseBillsBoard server read"
```

---

### Task 6: Navigation + RBAC

**Files:**
- Modify: `src/lib/auth/permissions.ts`
- Modify: `src/lib/nav.ts`

**Interfaces:**
- Produces: `ModuleKey` includes `"purchases"`; `canAccess(role, "purchases")` works for the
  right roles; a new sidebar entry. Task 7/8's pages rely on `"purchases"` already being a valid
  `ModuleKey` and route-guarded by the middleware (which derives from `pathModule`/`ROLE_MODULES`
  automatically — no middleware.ts edit needed, same as every other module).

- [ ] **Step 1: Read `supabase/migrations/0013_purchase_order_grants.sql` and
  `0014_purchase_orders_project_scoped.sql`** to find the *exact* role list the existing
  `purchase_orders` RLS write policy grants, so Task 1 Step 2's SQL and this task's
  `ROLE_MODULES` entry both match the same roles (don't invent a different list here from the one
  used in Task 1).

- [ ] **Step 2: Add `"purchases"` to `ModuleKey` and `ALL`** in `src/lib/auth/permissions.ts`:

```typescript
export type ModuleKey =
  | "dashboard"
  | "analytics"
  | "projects"
  | "design"
  | "clients"
  | "quotations"
  | "invoices"
  | "purchases"
  | "material"
  // ...rest unchanged
```

Add `"purchases"` into the `ALL` array (used by `super_admin`) and into `ROLE_MODULES.material`'s
list — wait, `material` isn't a role, it's a module; actually add `"purchases"` to the
`ROLE_MODULES` entry for every role that currently lists `"material"`, **plus** `accountant`
(who currently has no `"material"`):

```typescript
export const ROLE_MODULES: Record<Role, ModuleKey[]> = {
  super_admin: ALL,
  pm: [...existing pm list, "purchases"],       // pm already has material-adjacent write access
  accountant: [..."transactions", "purchases", "attendance"],  // NEW: accountant gets purchases, didn't have material
  // every other role unchanged unless it already lists "material" — add "purchases" next to it there too
};
```

Read the *current* `ROLE_MODULES` object in the file before editing (do not guess at its current
contents — it has changed since 0021/0024/the 2026-09-19 PM narrowing; re-read it fresh) and add
`"purchases"` to exactly: `super_admin` (via `ALL`), every role whose list already contains
`"material"`, and `accountant`.

- [ ] **Step 3: Add the route mapping** to `MODULE_ROUTES`:

```typescript
purchases: "/purchases",
```

- [ ] **Step 4: Add the prefix mapping** inside `pathModule`'s `prefixes` array:

```typescript
["/purchases", "purchases"],
```

- [ ] **Step 5: Add the sidebar nav entry** in `src/lib/nav.ts`, Commercial section, after Sales
  Invoices:

```typescript
{ label: "Purchase Order/Bill", href: "/purchases", icon: FileSpreadsheet, module: "purchases" },
```

Add `FileSpreadsheet` to the `lucide-react` import list at the top of the file.

- [ ] **Step 6: Build and verify**

```bash
robocopy "G:\My Drive\Keyvendors\Ad hocs\Construction Management Software\sitehub\src" "C:\Users\dell\sitehub-build\src" /MIR
cd /c/Users/dell/sitehub-build && npm run build
```

Expected: `✓ Compiled successfully` (the nav item will 404 until Task 7 adds the route — that's
expected and fine at this point; TypeScript doesn't know about missing routes).

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth/permissions.ts src/lib/nav.ts
git commit -m "feat: add purchases module to nav + RBAC"
```

---

### Task 7: List page — `/purchases`

**Files:**
- Create: `src/app/purchases/page.tsx`
- Create: `src/components/purchases/purchases-module.tsx`
- Create: `src/components/purchases/purchase-orders-list.tsx`
- Create: `src/components/purchases/purchase-bills-list.tsx`

**Interfaces:**
- Consumes: `getMaterialBoard` (`@/lib/data/material`, for `purchaseOrders`/`suppliers`/
  `projects`), `getPurchaseBillsBoard` (`@/lib/data/purchases`), `poToBillState`
  (`@/lib/purchases/compute`), `updatePurchaseBillStatusAction`/`deletePurchaseBillAction`
  (`@/app/purchases/actions`), `purchaseBillStatusMeta`/`poStatusMeta` (`@/lib/labels`).
- Produces: the `/purchases` route; nothing downstream depends on this task's internals except
  Task 8's builder being reachable from the "Convert to Bill" button and a "New Bill" button.

- [ ] **Step 1: Read `src/app/quotations/page.tsx` and `src/components/quotation/quotations-list.tsx`
  in full** — this task's four files are a direct structural mirror of those two, with a second
  tab added. Read them now so the component you write matches established spacing/search/filter/
  status-dropdown/delete-confirmation UI conventions exactly (card layout, `Select`/`Input`
  components from `@/components/ui/*`, the `StatCard` row pattern if one exists on that page).

- [ ] **Step 2: Write the server page** `src/app/purchases/page.tsx`:

```typescript
import { PurchasesModule } from "@/components/purchases/purchases-module";
import { getMaterialBoard } from "@/lib/data/material";
import { getPurchaseBillsBoard } from "@/lib/data/purchases";

export default async function PurchasesPage() {
  const [materialBoard, billsBoard] = await Promise.all([getMaterialBoard(), getPurchaseBillsBoard()]);
  return (
    <PurchasesModule
      purchaseOrders={materialBoard.purchaseOrders}
      suppliers={materialBoard.suppliers}
      projects={materialBoard.projects}
      bills={billsBoard.bills}
    />
  );
}
```

- [ ] **Step 3: Write `src/components/purchases/purchases-module.tsx`** — a client component
  holding the tab state (`"orders" | "bills"`, default `"orders"`) and rendering
  `<PurchaseOrdersList>` or `<PurchaseBillsList>` depending on which tab is active. Use the same
  tab-toggle visual pattern already in this codebase if one exists (check
  `src/components/payroll/*` or `src/components/invoice/*` for an existing tab component before
  inventing a new one — reuse it if found; if genuinely none exists, two `<Button variant={active
  ? "default" : "outline"}>` side by side is sufficient, matching the simplicity of the rest of
  this app's UI).

- [ ] **Step 4: Write `src/components/purchases/purchase-orders-list.tsx`** — card-per-PO, same
  visual shape as `QuotationsList`: number, supplier name (from the `suppliers` prop, matched by
  `po.supplierId`), project name, status badge (`poStatusMeta[po.status]`), item count, total
  (`po.items.reduce((s, it) => s + it.qty * it.rate, 0)`), and:
  - A **"Convert to Bill"** button, shown when `po.status !== "draft"` (mirrors the Quotation
    card's `q.status === "accepted"` gate — a PO should be at least sent before it becomes a
    bill), which does exactly this:

  ```typescript
  function convertToBill(po: PurchaseOrder, supplier: Supplier | null, project: Project | null) {
    try {
      localStorage.setItem(
        "sitehub:newBillPrefill",
        JSON.stringify({ state: poToBillState(po, supplier, project), sourcePoId: po.id })
      );
    } catch {
      /* ignore (quota/private-browsing) */
    }
    router.push("/purchases/bill/new");
  }
  ```
  - No "New PO" button here — PO creation stays in the Material module; this is a read + convert
    surface only (per the design spec: "no new PO UI").

- [ ] **Step 5: Write `src/components/purchases/purchase-bills-list.tsx`** — card-per-bill, a
  direct mirror of `InvoicesList`'s card (number, supplier, project, status dropdown wired to
  `updatePurchaseBillStatusAction`, grand total from `payload.grandTotal` if present else computed
  from items, paid/outstanding shown the same way `InvoicesList` shows received/outstanding,
  delete button wired to `deletePurchaseBillAction` with the same paid/partial confirmation
  friction `QuotationsList`'s delete dialog uses). Include a **"New Bill"** button at the top that
  routes directly to `/purchases/bill/new` with no prefill (standalone bill creation).

- [ ] **Step 6: Build and verify**

```bash
robocopy "G:\My Drive\Keyvendors\Ad hocs\Construction Management Software\sitehub\src" "C:\Users\dell\sitehub-build\src" /MIR
cd /c/Users/dell/sitehub-build && npm run build
```

Expected: `✓ Compiled successfully` (Task 8 hasn't created `/purchases/bill/new` yet — a link to
it is fine, Next.js doesn't fail the build over a route that will exist once Task 8 lands, but
finish Task 8 before attempting a live click-through).

- [ ] **Step 7: Commit**

```bash
git add src/app/purchases/page.tsx src/components/purchases/
git commit -m "feat: add Purchases list page (Purchase Orders + Purchase Bills tabs)"
```

---

### Task 8: Bill builder — `/purchases/bill/new`

**Files:**
- Create: `src/app/purchases/bill/new/page.tsx`
- Create: `src/components/purchases/purchase-bill-document.tsx`

**Interfaces:**
- Consumes: `BillState`, `computeBill`, `billLineAmount`, `getLumpsumMode`, `nextBillNumber` from
  `@/lib/purchases/compute`; `savePurchaseBillAction`, `getPurchaseBillPayloadAction` from
  `@/app/purchases/actions`; `MATERIAL_ITEMS`-equivalent picker (see Step 1).
- Produces: the `/purchases/bill/new` route, reachable with `?id=<billId>` to re-open a saved
  bill (same `?id=` convention `/quotations/new` and `/invoices/new` use) and consuming the
  `sitehub:newBillPrefill` localStorage prefill Task 7 writes.

- [ ] **Step 1: Read `src/app/invoices/new/page.tsx` in full.** This task's builder is a direct
  structural mirror of it: client→supplier field renames, `InvoiceState`→`BillState`,
  `InvoiceLine`→`BillLine`, `saveInvoiceAction`→`savePurchaseBillAction`,
  `getInvoicePayloadAction`→`getPurchaseBillPayloadAction`, `sitehub:newInvoicePrefill`→
  `sitehub:newBillPrefill`, `invoiceId`→`billId`/`quotationId.current`-equivalent ref. The item
  picker ("+ Add from item master…") should list **Material items** instead of the quotation
  item master — fetch via the same `MaterialItem[]` shape `src/lib/data/material.ts` already
  provides (pass `materialItems` as a prop from a thin server wrapper, or — simpler, matching this
  page's existing client-only pattern — fetch them via a small new read, OR drop the item-master
  picker entirely for v1 and keep only the "+ Custom" blank-line button, since Material items
  aren't the focus of this feature and the Quotation builder's own item master is domain-specific
  to quotation line items, not purchasing). **Decision: drop the item-master dropdown for the
  Bill builder v1 — keep only "+ Custom" (blank line) and "Paste from Excel" if time allows, matching
  the simplest version of this builder that still lets a user enter line items.** This avoids
  inventing a Material-item-picker UI that wasn't asked for (YAGNI) — line items are typed in
  directly, same as any quotation "Custom" row.
- No GST-type toggle complexity beyond what `computeBill` already supports (intra/inter, same as
  invoices) — reuse the same `<Select>` the Invoice builder already has for this.
- No signature upload for v1 (bills aren't typically signed the way outgoing quotations/invoices
  are) — omit that section entirely rather than copying it unused.

- [ ] **Step 2: Write `src/components/purchases/purchase-bill-document.tsx`**, the print/preview
  pane, mirroring `src/components/invoice/invoice-document.tsx` with the title changed to
  "Purchase Bill" and the "BILL TO" block relabeled "SUPPLIER" / "VENDOR", reading from the
  supplier's own fields (`supplierName`, `company`, `address`, `supplierGstin`, `contact`,
  `email`) instead of the client's.

- [ ] **Step 3: Write the page**, following `invoices/new/page.tsx`'s exact state-management
  shape (`useState<BillState>`, `pendingSource` ref pattern not needed here — no file-upload
  extraction for bills in v1 — `billId` ref for the save-then-rewrite-URL pattern, `useEffect` on
  mount that checks `?id=` first, then falls back to reading `sitehub:newBillPrefill` from
  localStorage and clearing it after reading, exactly like `invoices/new/page.tsx` does for its
  own prefill key).

- [ ] **Step 4: Build and verify**

```bash
robocopy "G:\My Drive\Keyvendors\Ad hocs\Construction Management Software\sitehub\src" "C:\Users\dell\sitehub-build\src" /MIR
cd /c/Users/dell/sitehub-build && npm run build
```

Expected: `✓ Compiled successfully`.

- [ ] **Step 5: Commit**

```bash
git add src/app/purchases/bill/ src/components/purchases/purchase-bill-document.tsx
git commit -m "feat: add Purchase Bill builder page"
```

---

### Task 9: Push, deploy, and live-verify

**Files:** none (verification only).

- [ ] **Step 1: Push to `main`**

```bash
cd "/g/My Drive/Keyvendors/Ad hocs/Construction Management Software/sitehub"
gh auth status   # confirm Kevendors is active, switch if not
git push origin main
```

- [ ] **Step 2: Poll the deployment**

```bash
gh api repos/Kevendors/construction-management-software/commits/<last-sha>/status --jq '.state'
```

Repeat every ~15s until `success`.

- [ ] **Step 3: Live-verify end to end** using a fresh throwaway QA account (same pattern used
  throughout this project's earlier QA passes — create via the Supabase Admin API, delete it when
  done), via Chrome DevTools MCP:
  1. Confirm migration 0025 is applied (ask the user, or check via the REST API probe from Task 1
     Step 4) before testing anything that writes to `purchase_bills`.
  2. Log in, open `/purchases` — confirm both tabs render, Purchase Orders tab shows real existing
     POs with correct supplier/project/total.
  3. Click "Convert to Bill" on a real PO — confirm the builder opens prefilled with the PO's
     supplier, project, and line items.
  4. Save it — confirm no error, confirm it now appears in the Purchase Bills tab with status
     Draft.
  5. Change its status to Sent, then Paid (with settle) — confirm `paid` updates to the full
     total and the badge changes.
  6. Click "New Bill" (standalone, no PO) — confirm it opens blank, can be filled in and saved.
  7. Confirm Accountant-role access: either check `ROLE_MODULES.accountant` includes
     `"purchases"` directly, or log in as an accountant-role account if one exists, and confirm
     "Purchase Order/Bill" appears in their sidebar.
  8. Clean up: delete any QA-created bills/POs-turned-bills and the throwaway account, matching
     every prior QA pass in this project.

- [ ] **Step 4: Update `PROJECT-MEMORY.md`** with what was built, the exact role list the RLS
  write policy ended up using (from Task 1 Step 2 / Task 6 Step 1), and confirmation migration
  0025 is applied — following the exact style of every other "built + live" entry already in that
  file.

- [ ] **Step 5: Report results to the user** in plain language (not file paths or jargon) —
  confirm the module is live, explain in one or two sentences how to use "Convert to Bill" and
  "New Bill", and flag the one manual step if migration 0025 turned out not to be pre-applied by
  Claude's own Task 1 verification.

---

## Self-review notes (already applied above, left here for the record)

- **Spec coverage:** all five spec sections (data model, server actions, UI, nav/RBAC, explicitly
  out of scope) map to Task 1–2 / Task 4–5 / Task 7–8 / Task 6 / the "drop item-master picker,
  drop signature, no RA change" decisions respectively.
- **Placeholder scan:** the only two intentionally-open items are (a) the exact RLS role list,
  which must be read from the live migration files rather than guessed — Task 1 Step 2 and
  Task 6 Step 1 both say so explicitly rather than inventing a number; (b) whether an existing
  tab-toggle component exists to reuse in Task 7 Step 3 — told to check rather than guess, not
  left as a bare TODO.
- **Type consistency:** `BillState`/`BillLine`/`ComputedBill` (Task 3) are the only names used by
  Task 4, 7, and 8 — no renaming drift. `PurchaseBill`/`PurchaseBillItem` (Task 2) are the only
  names used by Task 5's `getPurchaseBillsBoard` and Task 7's list props.
