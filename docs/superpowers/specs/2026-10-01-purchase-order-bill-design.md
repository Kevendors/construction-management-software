# Purchase Order / Bill module (Commercial section)

## Context

The Commercial section (Clients/CRM, Quotations, Sales Invoices, Transactions) covers the
*sales* side of the business — money coming in. There is no equivalent for the *purchase* side —
money going out to material suppliers. A `purchase_orders` table already exists, but it lives
inside the Material module (tied to suppliers, projects, goods receipts) and there is no concept
of a vendor's **bill** (their invoice to us) anywhere — no accounts-payable tracking, no "what do
we owe this supplier, what have we paid."

User decisions, confirmed via brainstorming:
- Reuse the existing `purchase_orders` data — don't fork it. Just also surface it in Commercial.
- **Purchase Bill** = the vendor's own bill/invoice to us. Tracks what we owe and what's been paid
  (accounts payable), the purchase-side mirror of Sales Invoices.
- A Bill can be created **either** by converting a PO (carrying its items/supplier/project across,
  same handoff pattern Quotation → Invoice already uses) **or** standalone, for a purchase that
  never had a formal PO.
- Scope: **material suppliers only**. Subcontractors keep their existing Running Account (RA)
  billing untouched — this is not a replacement for RAs.
- Payment tracking: status (Draft → Sent/Received → Partial → Paid) plus a recorded paid amount,
  mirroring how Sales Invoices already track `received` and partial payment.

## Data model

New table, modeled directly on `sales_invoices` (same shape: normalized columns for querying +
a `payload jsonb` holding the full builder state, the pattern quotations/invoices already use —
not the older plain-columns style `purchase_orders` itself uses):

```sql
create table purchase_bills (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references orgs(id) on delete cascade,
  number         text not null,
  supplier_id    uuid references suppliers(id) on delete set null,
  project_id     uuid references projects(id) on delete set null,
  source_po_id   uuid references purchase_orders(id) on delete set null,
  date           date not null,
  due_date       date,
  tax_rate       numeric not null default 0,
  paid           numeric not null default 0,
  status         purchase_bill_status not null default 'draft', -- draft|sent|partial|paid
  payload        jsonb,
  created_at     timestamptz not null default now()
);

create table purchase_bill_items (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references orgs(id) on delete cascade,
  bill_id         uuid not null references purchase_bills(id) on delete cascade,
  description     text not null,
  material_item_id uuid references material_items(id) on delete set null,
  qty             numeric not null default 0,
  unit            text,
  rate            numeric not null default 0
);
```

RLS mirrors `sales_invoices`'/`purchase_orders`' existing policies: org-member read, write
restricted to the commercial write-role group **plus** whichever roles can already write
`purchase_orders` (material-linked roles) — Accountant is added to both read and write, since this
is now a money/payables document and Accountant doesn't currently have Material-module access.

## Server actions (`src/app/purchases/actions.ts`, new)

Mirrors `src/app/invoices/actions.ts` exactly: `getAuthContext()` → role gate →
`createAdminClient()` write → `logActivity()` → `{ id?, error? }`.

- `savePurchaseBillAction(state, grandTotal, existingId?, sourcePoId?)` — insert/update, same
  duplicate-avoidance pattern as `saveInvoiceAction`/`saveQuotationAction` (update in place when
  `existingId` is passed).
- `updatePurchaseBillStatusAction(id, status, settlePaid?)` — exact mirror of
  `updateInvoiceStatusAction`: `settlePaid` (only meaningful when `status === "paid"`) computes the
  bill's total server-side from its stored `purchase_bill_items` and writes it to `paid`, so
  "Mark Paid" can't leave a bill reading Paid against ₹0 paid (the same bug `updateInvoiceStatusAction`'s
  own doc comment describes fixing for invoices).
- `getPurchaseBillPayloadAction(id)` — loads the builder state, same payload-first /
  reconstruct-from-columns fallback `getInvoicePayloadAction` already uses.
- `deletePurchaseBillAction(id)` — super_admin-only, refuses bills with `paid > 0`, same shape as
  `deleteQuotationAction`/invoice delete.

## UI

`src/app/purchases/` (new route), modeled on `src/app/quotations/`:
- `/purchases` — list page, a toggle between **Purchase Orders** and **Purchase Bills** tabs.
  Both read the *same* underlying data the Material module already uses (`purchase_orders`/
  `po_items`, `getAllPurchaseOrderIds`/`getPurchaseOrderView` from `src/lib/data/material.ts` —
  reused, not forked) — but each tab is its own lightweight card-list component here
  (`PurchaseOrdersList`, `PurchaseBillsList`, styled like `QuotationsList`/`InvoicesList`), not an
  embed of the Material module's own PO view (which is coupled to goods-receipts and other
  Material-specific concerns this list doesn't need). Each PO card gets a new **"Convert to
  Bill"** button (visible once the PO is `sent` or later, mirroring the Quotation card's "Convert
  to Invoice") — new here, since the Material module's own PO view has no such button today.
- `/purchases/bill/new` — the Bill builder, modeled directly on `src/app/invoices/new/page.tsx`
  (supplier/project details, line items with the existing item-master-style picker swapped for
  Material items, GST/discount, terms). Accepts an optional `?poId=` to prefill from a PO via the
  same `localStorage` handoff `sitehub:newInvoicePrefill` already uses (`sitehub:newBillPrefill`).

## Navigation & RBAC

- `ModuleKey` gains `"purchases"`; `ROLE_MODULES` adds it wherever `"material"` already grants PO
  visibility, **plus** `accountant`. `MODULE_ROUTES.purchases = "/purchases"`.
- Sidebar: new "Purchase Order/Bill" entry under COMMERCIAL, after Sales Invoices.

## Explicitly out of scope

- No change to Subcontractor Work Orders / Running Accounts.
- No change to the existing Material-module PO creation UI/flow itself — only added visibility
  from Commercial and the new "Convert to Bill" action.
- No automatic Transaction entry on payment (Sales Invoice payments don't auto-create a
  Transaction row either, per the existing codebase — consistent, not a new gap).
