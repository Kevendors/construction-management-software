-- ----------------------------------------------------------------------------
-- 0030 — Challan (Delivery/Dispatch, by KeyVendors)
--
-- GST-compliant goods-movement record for material sent to a project site
-- that is NOT a sale — deliberately no rate/amount/GST on line items, unlike
-- every other commercial document in this app. Lives in the Operations nav
-- group (alongside Material/Subcontractor/Equipment), not Commercial.
--
-- Treated as a Material-domain table — read/write roles copy 0002_rbac.sql's
-- own 'material' group verbatim.
--
-- Safe to re-run. Apply in the Supabase SQL editor.
-- ----------------------------------------------------------------------------

create table if not exists public.challans (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.orgs(id) on delete cascade,
  number            text not null,
  project_id        uuid references public.projects(id) on delete set null,
  date              date not null,
  vehicle_number    text,
  transporter_name  text,
  purpose_note      text,
  payload           jsonb,
  created_at        timestamptz not null default now()
);

create table if not exists public.challan_items (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.orgs(id) on delete cascade,
  challan_id         uuid not null references public.challans(id) on delete cascade,
  material_item_id   uuid references public.material_items(id) on delete set null,
  description        text not null,
  qty                numeric not null default 0,
  unit               text
);

alter table public.challans enable row level security;
alter table public.challan_items enable row level security;

drop policy if exists challans_read on public.challans;
create policy challans_read on public.challans
  for select using (is_org_member(org_id) and has_role(org_id, array['super_admin', 'pm', 'supervisor']));

drop policy if exists challan_items_read on public.challan_items;
create policy challan_items_read on public.challan_items
  for select using (is_org_member(org_id) and has_role(org_id, array['super_admin', 'pm', 'supervisor']));

drop policy if exists challans_write on public.challans;
create policy challans_write on public.challans
  for all using (
    is_org_member(org_id) and has_role(org_id, array['super_admin', 'pm'])
  ) with check (
    is_org_member(org_id) and has_role(org_id, array['super_admin', 'pm'])
  );

drop policy if exists challan_items_write on public.challan_items;
create policy challan_items_write on public.challan_items
  for all using (
    is_org_member(org_id) and has_role(org_id, array['super_admin', 'pm'])
  ) with check (
    is_org_member(org_id) and has_role(org_id, array['super_admin', 'pm'])
  );

create index if not exists challans_org_idx on public.challans (org_id);
create index if not exists challans_project_idx on public.challans (project_id);
create index if not exists challan_items_challan_idx on public.challan_items (challan_id);
