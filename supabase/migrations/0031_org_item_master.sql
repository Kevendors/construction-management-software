-- ----------------------------------------------------------------------------
-- 0031 — Org-specific additions to the Item/Service Master
--
-- The built-in item master (src/lib/quotation/item-master.ts) is a fixed,
-- hardcoded list shipped with the app. This table lets each org's own custom
-- item/service descriptions (typed via "Custom" in the Quotation/Invoice
-- builder) persist and become reusable — exactly like the built-in list, just
-- org-specific and growable. A unique index on (org_id, lower(name)) is the
-- de-dupe guard, so re-saving a document with the same custom description
-- twice doesn't create two master entries.
--
-- Treated as a Commercial-domain table — read/write roles copy
-- 0002_rbac.sql's own 'commercial' group (quotations/sales_invoices/...)
-- verbatim.
--
-- Safe to re-run. Apply in the Supabase SQL editor.
-- ----------------------------------------------------------------------------

create table if not exists public.org_item_master (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs(id) on delete cascade,
  name        text not null,
  category    text not null,
  unit        text not null,
  uses_sqft   boolean not null default false,
  created_at  timestamptz not null default now()
);

create unique index if not exists org_item_master_org_name_idx
  on public.org_item_master (org_id, lower(name));

alter table public.org_item_master enable row level security;

drop policy if exists org_item_master_read on public.org_item_master;
create policy org_item_master_read on public.org_item_master
  for select using (is_org_member(org_id) and has_role(org_id, array['super_admin', 'pm', 'accountant']));

drop policy if exists org_item_master_write on public.org_item_master;
create policy org_item_master_write on public.org_item_master
  for all using (
    is_org_member(org_id) and has_role(org_id, array['super_admin', 'accountant'])
  ) with check (
    is_org_member(org_id) and has_role(org_id, array['super_admin', 'accountant'])
  );
