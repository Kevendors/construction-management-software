-- ============================================================================
-- 0038_org_units.sql — Org-wide custom unit list
--
-- Quotation/Invoice/Purchase Bill line items offer a fixed Unit dropdown
-- (SQFT, SQM, ... LS). This lets any org member add a unit that isn't in
-- that list, so it's remembered and offered again next time instead of
-- being retyped as free text every time.
-- ============================================================================

create table if not exists public.org_units (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  unit text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists org_units_org_unit_upper_idx
  on public.org_units (org_id, upper(unit));

alter table public.org_units enable row level security;

drop policy if exists org_units_read on public.org_units;
create policy org_units_read on public.org_units for select to authenticated
  using (public.is_org_member(org_id));

-- Any org member can contribute a unit while building a document — this is
-- a low-stakes shared convenience list, not sensitive data.
drop policy if exists org_units_insert on public.org_units;
create policy org_units_insert on public.org_units for insert to authenticated
  with check (public.is_org_member(org_id));
