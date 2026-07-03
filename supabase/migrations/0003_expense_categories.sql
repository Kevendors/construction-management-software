-- Dynamic expense categories.
-- expenses.category was a fixed enum (expense_category); detach it to plain
-- text so orgs can add their own categories at runtime. The enum type itself
-- stays (transactions.category still uses it).

alter table public.expenses alter column category drop default;
alter table public.expenses alter column category type text using category::text;
alter table public.expenses alter column category set default 'other';

-- Per-org category list: the five built-ins plus any custom ones.
create table if not exists public.expense_categories (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.orgs(id) on delete cascade,
  slug       text not null,
  label      text not null,
  created_at timestamptz not null default now(),
  unique (org_id, slug)
);

alter table public.expense_categories enable row level security;

drop policy if exists exp_cat_read on public.expense_categories;
create policy exp_cat_read on public.expense_categories
  for select using (public.is_org_member(org_id));

drop policy if exists exp_cat_insert on public.expense_categories;
create policy exp_cat_insert on public.expense_categories
  for insert with check (public.has_role(org_id, array['super_admin','pm','accountant']));

drop policy if exists exp_cat_delete on public.expense_categories;
create policy exp_cat_delete on public.expense_categories
  for delete using (public.has_role(org_id, array['super_admin','pm']));

-- Seed the built-in categories for every existing org.
insert into public.expense_categories (org_id, slug, label)
select o.id, v.slug, v.label
from public.orgs o
cross join (values
  ('material','Material'),
  ('salary','Salary'),
  ('site','Site'),
  ('subcon','Subcon'),
  ('other','Other')
) as v(slug, label)
on conflict (org_id, slug) do nothing;
