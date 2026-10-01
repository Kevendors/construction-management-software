-- ----------------------------------------------------------------------------
-- 0025 — Purchase Bills (accounts payable for material suppliers)
--
-- The purchase-side mirror of sales_invoices: a vendor's own bill to us,
-- tracking what we owe and what's been paid. Reuses the existing
-- purchase_orders/suppliers/projects tables; source_po_id is an optional
-- link back to the PO a bill was converted from (null for a standalone
-- bill that never had a formal PO).
--
-- Treated as a Commercial-domain table (an AP document), not a Material-
-- domain one — read/write roles below copy 0002_rbac.sql's own 'commercial'
-- group (quotations/sales_invoices/transactions) verbatim, NOT
-- purchase_orders' own per-user-grant/project-scoped model (0013/0014),
-- which exists specifically to mask PO pricing from broad visibility — a
-- different, stricter concern than a payable-tracking bill.
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

drop policy if exists purchase_bills_read on public.purchase_bills;
create policy purchase_bills_read on public.purchase_bills
  for select using (is_org_member(org_id) and has_role(org_id, array['super_admin', 'pm', 'accountant']));

drop policy if exists purchase_bill_items_read on public.purchase_bill_items;
create policy purchase_bill_items_read on public.purchase_bill_items
  for select using (is_org_member(org_id) and has_role(org_id, array['super_admin', 'pm', 'accountant']));

drop policy if exists purchase_bills_write on public.purchase_bills;
create policy purchase_bills_write on public.purchase_bills
  for all using (
    is_org_member(org_id) and has_role(org_id, array['super_admin', 'accountant'])
  ) with check (
    is_org_member(org_id) and has_role(org_id, array['super_admin', 'accountant'])
  );

drop policy if exists purchase_bill_items_write on public.purchase_bill_items;
create policy purchase_bill_items_write on public.purchase_bill_items
  for all using (
    is_org_member(org_id) and has_role(org_id, array['super_admin', 'accountant'])
  ) with check (
    is_org_member(org_id) and has_role(org_id, array['super_admin', 'accountant'])
  );

create index if not exists purchase_bills_org_idx on public.purchase_bills (org_id);
create index if not exists purchase_bills_source_po_idx on public.purchase_bills (source_po_id);
create index if not exists purchase_bill_items_bill_idx on public.purchase_bill_items (bill_id);
