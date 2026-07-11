-- ============================================================================
-- SiteHub — migration 0002: live multi-device sync
-- Adds the two tables the client store needs (activity_log, categories),
-- widens transactions/expenses category columns to text (dynamic categories),
-- adds dpr.photo_urls, and turns on Supabase Realtime for every table the
-- client store reads/writes so changes on one device stream to all others.
-- Idempotent where practical; safe to run once after 0001_init.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Activity log — mirrors ActivityLogEntry (src/lib/types.ts). Was in-memory
--    only; now a real, org-scoped table so the feed syncs across devices.
--    Note: column is `logged_at` (not `timestamp`) to avoid the SQL keyword.
-- ----------------------------------------------------------------------------
create table if not exists activity_log (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  action     text not null,
  entity     text not null,
  entity_id  text,
  logged_at  timestamptz not null default now(),
  user_id    uuid references profiles(id) on delete set null,
  details    text
);
create index if not exists activity_log_project_idx on activity_log (project_id);
create index if not exists activity_log_org_time_idx on activity_log (org_id, logged_at desc);

-- ----------------------------------------------------------------------------
-- 2. Categories — backs category-store.tsx (was localStorage only). One row per
--    custom label; kind partitions expense / cost-code / material vocabularies.
-- ----------------------------------------------------------------------------
create table if not exists categories (
  id      uuid primary key default gen_random_uuid(),
  org_id  uuid not null references orgs(id) on delete cascade,
  kind    text not null check (kind in ('expense','cost_code','material')),
  key     text not null,
  label   text not null,
  unique (org_id, kind, key)
);

-- ----------------------------------------------------------------------------
-- 3. Dynamic categories on the ledger: the domain types widened
--    Transaction.costCode/category and Expense.costCode/category to `string`,
--    but 0001 defined them as enums. Convert to text so custom categories
--    inserted from the UI don't violate the enum. (Existing values survive the
--    cast; the enum types remain for any other columns.)
-- ----------------------------------------------------------------------------
do $$
begin
  -- transactions.cost_code
  alter table transactions alter column cost_code drop default;
  alter table transactions alter column cost_code type text using cost_code::text;
  alter table transactions alter column cost_code set default 'other';
  -- transactions.category
  alter table transactions alter column category drop default;
  alter table transactions alter column category type text using category::text;
  alter table transactions alter column category set default 'other';
  -- expenses.cost_code
  alter table expenses alter column cost_code drop default;
  alter table expenses alter column cost_code type text using cost_code::text;
  alter table expenses alter column cost_code set default 'other';
  -- expenses.category
  alter table expenses alter column category drop default;
  alter table expenses alter column category type text using category::text;
  alter table expenses alter column category set default 'other';
exception
  when others then
    raise notice 'ledger column widening skipped/partial: %', sqlerrm;
end $$;

-- ----------------------------------------------------------------------------
-- 4. DPR photos — client uploads compressed data-URL photos; add a column so
--    they persist and sync (jsonb array of strings). Optional per row.
-- ----------------------------------------------------------------------------
alter table dprs add column if not exists photo_urls jsonb not null default '[]'::jsonb;

-- ----------------------------------------------------------------------------
-- 5. Row-Level Security for the new tables. Re-run the same member-scoped
--    policy loop from 0001 so activity_log + categories (and any other org_id
--    table) get the org_rw policy. Idempotent: drops+recreates the policy.
-- ----------------------------------------------------------------------------
do $$
declare t record;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'org_id'
      and tb.table_type = 'BASE TABLE'
  loop
    execute format('alter table public.%I enable row level security;', t.table_name);
    execute format('drop policy if exists org_rw on public.%I;', t.table_name);
    execute format(
      'create policy org_rw on public.%I for all to authenticated '
      || 'using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));',
      t.table_name
    );
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 6. Realtime. Add every table the client store subscribes to into the
--    supabase_realtime publication, and set REPLICA IDENTITY FULL so UPDATE and
--    DELETE change payloads include org_id/project_id (needed for the client's
--    org filter). Guarded per-table so re-running doesn't error.
-- ----------------------------------------------------------------------------
do $$
declare
  tbl text;
  live_tables text[] := array[
    'projects','tasks','dprs','site_instructions','transactions',
    'sales_invoices','invoice_items','expenses','labour_attendance',
    'employees','activity_log','categories'
  ];
begin
  foreach tbl in array live_tables loop
    execute format('alter table public.%I replica identity full;', tbl);
    begin
      execute format('alter publication supabase_realtime add table public.%I;', tbl);
    exception
      when duplicate_object then null;   -- already in the publication
      when others then raise notice 'realtime add skipped for %: %', tbl, sqlerrm;
    end;
  end loop;
end $$;
