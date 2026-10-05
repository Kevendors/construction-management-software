-- ----------------------------------------------------------------------------
-- 0028 — Work Order (by Client), attached to a Quotation
--
-- Pure record-keeping: proof that a client formally authorized work against a
-- quotation. Does not drive any status change or automation (explicit user
-- decision) — a quotation can have any number of attached work orders.
-- Reuses the existing quotation-files storage bucket and signed-URL pattern
-- (src/app/quotations/upload-actions.ts), just like the quotation's own
-- source file.
--
-- Treated as a Commercial-domain table — read/write roles copy
-- 0002_rbac.sql's 'commercial' group (quotations/sales_invoices/...)
-- verbatim.
--
-- Safe to re-run. Apply in the Supabase SQL editor.
-- ----------------------------------------------------------------------------

create table if not exists public.quotation_work_orders (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.orgs(id) on delete cascade,
  quotation_id      uuid not null references public.quotations(id) on delete cascade,
  file_path         text not null,
  file_name         text not null,
  reference_number  text,
  date              date,
  note              text,
  created_at        timestamptz not null default now()
);

alter table public.quotation_work_orders enable row level security;

drop policy if exists quotation_work_orders_read on public.quotation_work_orders;
create policy quotation_work_orders_read on public.quotation_work_orders
  for select using (is_org_member(org_id) and has_role(org_id, array['super_admin', 'pm', 'accountant']));

drop policy if exists quotation_work_orders_write on public.quotation_work_orders;
create policy quotation_work_orders_write on public.quotation_work_orders
  for all using (
    is_org_member(org_id) and has_role(org_id, array['super_admin', 'accountant'])
  ) with check (
    is_org_member(org_id) and has_role(org_id, array['super_admin', 'accountant'])
  );

create index if not exists quotation_work_orders_quotation_idx on public.quotation_work_orders (quotation_id);
create index if not exists quotation_work_orders_org_idx on public.quotation_work_orders (org_id);
