-- Dynamic Category + Cost Code for Projects > Add Expense (transactions).
-- Detach the shared enums from the transactions table only (other tables keep
-- them), mirroring 0003's treatment of expenses.category.

alter table public.transactions alter column category drop default;
alter table public.transactions alter column category type text using category::text;
alter table public.transactions alter column category set default 'other';

alter table public.transactions alter column cost_code drop default;
alter table public.transactions alter column cost_code type text using cost_code::text;
alter table public.transactions alter column cost_code set default 'other';

-- Per-org cost-code master (mirrors expense_categories).
create table if not exists public.cost_codes (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.orgs(id) on delete cascade,
  slug       text not null,
  label      text not null,
  created_at timestamptz not null default now(),
  unique (org_id, slug)
);

alter table public.cost_codes enable row level security;

drop policy if exists cost_codes_read on public.cost_codes;
create policy cost_codes_read on public.cost_codes
  for select using (public.is_org_member(org_id));

-- Any org member (incl. supervisors) may add a cost code.
drop policy if exists cost_codes_insert on public.cost_codes;
create policy cost_codes_insert on public.cost_codes
  for insert with check (public.is_org_member(org_id));

drop policy if exists cost_codes_delete on public.cost_codes;
create policy cost_codes_delete on public.cost_codes
  for delete using (public.has_role(org_id, array['super_admin','pm']));

insert into public.cost_codes (org_id, slug, label)
select o.id, v.slug, v.label
from public.orgs o
cross join (values
  ('material','Material'),
  ('machinery','Machinery'),
  ('diesel','Diesel'),
  ('labour','Labour'),
  ('other','Other')
) as v(slug, label)
on conflict (org_id, slug) do nothing;

-- Let any org member add expense categories too (was super_admin/pm/accountant).
drop policy if exists exp_cat_insert on public.expense_categories;
create policy exp_cat_insert on public.expense_categories
  for insert with check (public.is_org_member(org_id));
