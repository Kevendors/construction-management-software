-- ============================================================================
-- SiteHub — ONE-SHOT setup for a fresh Supabase project.
-- Paste this whole file into the Supabase SQL editor and Run (single session,
-- so the seed's pg_temp helper works). Order: schema -> realtime/activity ->
-- demo seed. Safe on a brand-new project.
-- ============================================================================

-- >>>>>>>>>>>>>>>>>>>>>>>>>> migrations\0001_init.sql >>>>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================================================
-- SiteHub â€” initial schema (Phases 1â€“4)
-- Mirrors src/lib/types.ts and PLAN.md Â§C.3. Single org to start, multi-tenant
-- ready: every domain table carries org_id and is guarded by RLS scoped to the
-- caller's org membership. Dashboards stay derived (views), never stored totals.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type role            as enum ('admin','pm','architect','engineer','accountant','subcontractor','client');
create type project_status  as enum ('planning','ongoing','on_hold','completed');
create type task_status     as enum ('not_started','ongoing','delayed','completed');
create type progress_unit   as enum ('meter','numbers','sqft','lumpsum','percent');
create type cost_code       as enum ('material','machinery','diesel','labour','other');
create type txn_direction   as enum ('in','out');
create type expense_category as enum ('material','salary','site','subcon','other');
create type approval_status as enum ('pending','approved','rejected');
create type file_kind       as enum ('photo','pdf','dwg','doc');
create type drawing_discipline as enum ('architectural','structural','mep','interior');
create type drawing_status  as enum ('draft','for_review','approved','superseded');
create type quotation_status as enum ('draft','sent','accepted','rejected');
create type invoice_status  as enum ('draft','sent','partial','paid','overdue');
create type po_status       as enum ('draft','sent','received','closed');
create type wo_status       as enum ('draft','issued','in_progress','completed');
create type ra_status       as enum ('draft','submitted','certified','paid');
create type material_category as enum ('cement','steel','aggregate','blocks','electrical','plumbing','finishes','consumables');
create type trade           as enum ('rcc','mep','plumbing','electrical','facade','finishes','waterproofing');
create type booking_status  as enum ('booked','paid');
create type department      as enum ('engineering','design','site','accounts','admin');
create type salary_slip_status as enum ('draft','finalised','paid');
create type shift           as enum ('general','first','second');
create type advance_party   as enum ('employee','contractor');
create type advance_status  as enum ('open','settling','cleared');
create type equipment_kind  as enum ('machinery','tool','asset');
create type equipment_status as enum ('in_use','idle','maintenance');
create type ownership       as enum ('owned','rented');
create type ledger_direction as enum ('received','paid');
create type notification_kind as enum ('approval','delay','payment','stock','info');

-- ----------------------------------------------------------------------------
-- Identity & tenancy
-- ----------------------------------------------------------------------------
create table orgs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  gstin      text,
  created_at timestamptz not null default now()
);

-- one row per auth user (mirrors auth.users)
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  name         text not null default '',
  avatar_color text not null default '#1e3a5f',
  initials     text not null default '',
  created_at   timestamptz not null default now()
);

create table memberships (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  role       role not null default 'engineer',
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

-- security-definer helper: is the current user a member of this org?
-- definer rights bypass RLS on memberships, so policies that call this do not recurse.
create or replace function public.is_org_member(p_org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.org_id = p_org and m.user_id = auth.uid()
  );
$$;

-- insert a profile row automatically on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, initials)
  values (new.id, coalesce(new.raw_user_meta_data->>'name',''), '')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- CRM / parties
-- ----------------------------------------------------------------------------
create table clients (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id) on delete cascade,
  name       text not null,
  company    text,
  email      text,
  phone      text,
  address    text,
  gst        text,
  created_at timestamptz not null default now()
);

create table suppliers (
  id      uuid primary key default gen_random_uuid(),
  org_id  uuid not null references orgs(id) on delete cascade,
  name    text not null,
  company text,
  contact text,
  phone   text,
  email   text,
  gst     text,
  address text
);

create table subcontractors (
  id      uuid primary key default gen_random_uuid(),
  org_id  uuid not null references orgs(id) on delete cascade,
  name    text not null,
  company text,
  trade   trade not null,
  contact text,
  phone   text,
  gst     text
);

create table labour_contractors (
  id        uuid primary key default gen_random_uuid(),
  org_id    uuid not null references orgs(id) on delete cascade,
  name      text not null,
  company   text,
  trade     trade not null,
  phone     text,
  headcount int not null default 0,
  day_rate  numeric not null default 0
);

create table employees (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  profile_id  uuid references profiles(id) on delete set null,
  name        text not null,
  designation text,
  department  department not null default 'site',
  monthly_ctc numeric not null default 0,
  join_date   date,
  phone       text,
  initials    text,
  avatar_color text
);

-- ----------------------------------------------------------------------------
-- Projects, tasks & field
-- ----------------------------------------------------------------------------
create table projects (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references orgs(id) on delete cascade,
  code             text not null,
  name             text not null,
  client_id        uuid references clients(id) on delete set null,
  value            numeric not null default 0,
  status           project_status not null default 'planning',
  start_date       date,
  end_date         date,
  percent_complete numeric not null default 0,
  location         text,
  pm_id            uuid references profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  unique (org_id, code)
);

create table tasks (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references orgs(id) on delete cascade,
  project_id      uuid not null references projects(id) on delete cascade,
  parent_id       uuid references tasks(id) on delete cascade,
  name            text not null,
  assignee_id     uuid references profiles(id) on delete set null,
  start_date      date,
  end_date        date,
  status          task_status not null default 'not_started',
  progress_value  numeric not null default 0,
  progress_target numeric not null default 0,
  unit            progress_unit not null default 'percent',
  delay_days      int not null default 0
);

create table dprs (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs(id) on delete cascade,
  project_id   uuid not null references projects(id) on delete cascade,
  date         date not null,
  author_id    uuid references profiles(id) on delete set null,
  weather      text,
  work_done    text,
  labour_count int not null default 0,
  photos       int not null default 0
);

create table site_instructions (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  date       date not null,
  by_id      uuid references profiles(id) on delete set null,
  text       text not null,
  priority   text not null default 'medium'
);

create table project_files (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references orgs(id) on delete cascade,
  project_id     uuid not null references projects(id) on delete cascade,
  name           text not null,
  kind           file_kind not null,
  size_kb        int not null default 0,
  storage_path   text,
  uploaded_at    timestamptz not null default now(),
  uploaded_by_id uuid references profiles(id) on delete set null
);

-- ----------------------------------------------------------------------------
-- Design / drawings
-- ----------------------------------------------------------------------------
create table drawings (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  project_id  uuid not null references projects(id) on delete cascade,
  title       text not null,
  discipline  drawing_discipline not null,
  current_rev text,
  status      drawing_status not null default 'draft'
);

create table drawing_versions (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs(id) on delete cascade,
  drawing_id   uuid not null references drawings(id) on delete cascade,
  rev          text not null,
  date         date not null,
  by_id        uuid references profiles(id) on delete set null,
  notes        text,
  file_kb      int not null default 0,
  storage_path text
);

-- ----------------------------------------------------------------------------
-- Commercial: quotations, BOQ, invoices
-- ----------------------------------------------------------------------------
create table quotations (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs(id) on delete cascade,
  number       text not null,
  client_id    uuid references clients(id) on delete set null,
  project_name text,
  date         date not null,
  valid_until  date,
  status       quotation_status not null default 'draft',
  tax_rate     numeric not null default 0
);

create table quotation_items (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs(id) on delete cascade,
  quotation_id uuid not null references quotations(id) on delete cascade,
  description  text not null,
  cost_code    cost_code,
  qty          numeric not null default 0,
  unit         text,
  rate         numeric not null default 0
);

create table boqs (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  unique (project_id)
);

create table boq_items (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  boq_id      uuid not null references boqs(id) on delete cascade,
  description text not null,
  cost_code   cost_code not null default 'other',
  qty         numeric not null default 0,
  unit        text,
  rate        numeric not null default 0
);

create table sales_invoices (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id) on delete cascade,
  number     text not null,
  project_id uuid references projects(id) on delete set null,
  client_id  uuid references clients(id) on delete set null,
  date       date not null,
  due_date   date,
  tax_rate   numeric not null default 0,
  received   numeric not null default 0,
  status     invoice_status not null default 'draft'
);

create table invoice_items (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  invoice_id  uuid not null references sales_invoices(id) on delete cascade,
  description text not null,
  qty         numeric not null default 0,
  unit        text,
  rate        numeric not null default 0
);

-- ----------------------------------------------------------------------------
-- Ledger / expenses (feeds all financial charts)
-- ----------------------------------------------------------------------------
create table transactions (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  party_id   uuid,
  date       date not null,
  direction  txn_direction not null,
  amount     numeric not null default 0,
  cost_code  cost_code not null default 'other',
  category   expense_category not null default 'other',
  note       text
);

create table expenses (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  date       date not null,
  category   expense_category not null default 'other',
  cost_code  cost_code not null default 'other',
  amount     numeric not null default 0,
  note       text,
  status     approval_status not null default 'pending',
  by_id      uuid references profiles(id) on delete set null,
  approver_id uuid references profiles(id) on delete set null
);

create table supervisor_ledger (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  supervisor_id uuid references profiles(id) on delete set null,
  project_id    uuid references projects(id) on delete set null,
  date          date not null,
  direction     ledger_direction not null,
  amount        numeric not null default 0,
  note          text
);

-- ----------------------------------------------------------------------------
-- Material management
-- ----------------------------------------------------------------------------
create table material_items (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  name          text not null,
  category      material_category not null,
  unit          text not null,
  stock_qty     numeric not null default 0,
  reorder_level numeric not null default 0,
  rate          numeric not null default 0
);

create table material_requests (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id) on delete cascade,
  number     text not null,
  project_id uuid references projects(id) on delete set null,
  by_id      uuid references profiles(id) on delete set null,
  date       date not null,
  status     approval_status not null default 'pending',
  note       text
);

create table material_request_lines (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references orgs(id) on delete cascade,
  request_id       uuid not null references material_requests(id) on delete cascade,
  material_item_id uuid references material_items(id) on delete set null,
  qty              numeric not null default 0
);

create table purchase_orders (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  number        text not null,
  supplier_id   uuid references suppliers(id) on delete set null,
  project_id    uuid references projects(id) on delete set null,
  date          date not null,
  status        po_status not null default 'draft',
  tax_rate      numeric not null default 0,
  discount      numeric not null default 0,
  terms         text,
  payment_terms text
);

create table po_items (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references orgs(id) on delete cascade,
  po_id            uuid not null references purchase_orders(id) on delete cascade,
  description      text not null,
  material_item_id uuid references material_items(id) on delete set null,
  qty              numeric not null default 0,
  unit             text,
  rate             numeric not null default 0
);

create table goods_receipts (
  id     uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  number text not null,
  po_id  uuid not null references purchase_orders(id) on delete cascade,
  date   date not null,
  by_id  uuid references profiles(id) on delete set null
);

create table goods_receipt_lines (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs(id) on delete cascade,
  receipt_id   uuid not null references goods_receipts(id) on delete cascade,
  po_item_id   uuid references po_items(id) on delete set null,
  qty_received numeric not null default 0
);

create table purchase_bookings (
  id      uuid primary key default gen_random_uuid(),
  org_id  uuid not null references orgs(id) on delete cascade,
  po_id   uuid not null references purchase_orders(id) on delete cascade,
  bill_no text,
  date    date not null,
  amount  numeric not null default 0,
  status  booking_status not null default 'booked'
);

create table material_usage (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references orgs(id) on delete cascade,
  project_id       uuid references projects(id) on delete set null,
  material_item_id uuid references material_items(id) on delete set null,
  qty              numeric not null default 0,
  date             date not null,
  ref              text
);

-- ----------------------------------------------------------------------------
-- Subcontractor
-- ----------------------------------------------------------------------------
create table subcon_work_orders (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references orgs(id) on delete cascade,
  number           text not null,
  subcontractor_id uuid references subcontractors(id) on delete set null,
  project_id       uuid references projects(id) on delete set null,
  date             date not null,
  status           wo_status not null default 'draft',
  tax_rate         numeric not null default 0,
  signatory        text
);

create table wo_items (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  work_order_id uuid not null references subcon_work_orders(id) on delete cascade,
  description   text not null,
  qty           numeric not null default 0,
  unit          text,
  rate          numeric not null default 0
);

create table subcon_progress (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  work_order_id uuid not null references subcon_work_orders(id) on delete cascade,
  date          date not null,
  percent       numeric not null default 0,
  note          text
);

create table material_issues (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references orgs(id) on delete cascade,
  subcontractor_id uuid references subcontractors(id) on delete set null,
  project_id       uuid references projects(id) on delete set null,
  material_item_id uuid references material_items(id) on delete set null,
  qty              numeric not null default 0,
  date             date not null
);

create table ra_bills (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references orgs(id) on delete cascade,
  number           text not null,
  work_order_id    uuid not null references subcon_work_orders(id) on delete cascade,
  date             date not null,
  percent_complete numeric not null default 0,
  gross_amount     numeric not null default 0,
  deductions       numeric not null default 0,
  net_amount       numeric not null default 0,
  status           ra_status not null default 'draft'
);

-- ----------------------------------------------------------------------------
-- Payroll, attendance, advances
-- ----------------------------------------------------------------------------
create table salary_slips (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references orgs(id) on delete cascade,
  employee_id       uuid not null references employees(id) on delete cascade,
  month             text not null, -- 'YYYY-MM'
  paid_days         int not null default 0,
  month_days        int not null default 30,
  basic             numeric not null default 0,
  hra               numeric not null default 0,
  allowances        numeric not null default 0,
  pf                numeric not null default 0,
  esi               numeric not null default 0,
  advance_deduction numeric not null default 0,
  status            salary_slip_status not null default 'draft'
);

create table labour_attendance (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  contractor_id uuid references labour_contractors(id) on delete set null,
  project_id    uuid references projects(id) on delete set null,
  date          date not null,
  shift         shift not null default 'general',
  present       int not null default 0,
  absent        int not null default 0,
  gps           text
);

create table advances (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id) on delete cascade,
  party_type advance_party not null,
  party_id   uuid not null,
  date       date not null,
  amount     numeric not null default 0,
  recovered  numeric not null default 0,
  status     advance_status not null default 'open',
  note       text
);

-- ----------------------------------------------------------------------------
-- Equipment & assets
-- ----------------------------------------------------------------------------
create table equipment (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  code          text not null,
  name          text not null,
  kind          equipment_kind not null,
  ownership     ownership not null default 'owned',
  status        equipment_status not null default 'idle',
  project_id    uuid references projects(id) on delete set null,
  monthly_rate  numeric not null default 0,
  acquired_date date
);

-- ----------------------------------------------------------------------------
-- Notifications
-- ----------------------------------------------------------------------------
create table notifications (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id) on delete cascade,
  user_id    uuid references profiles(id) on delete cascade,
  kind       notification_kind not null default 'info',
  title      text not null,
  body       text,
  href       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Indexes on hot foreign keys
-- ----------------------------------------------------------------------------
create index on tasks (project_id);
create index on tasks (parent_id);
create index on dprs (project_id);
create index on site_instructions (project_id);
create index on project_files (project_id);
create index on drawings (project_id);
create index on drawing_versions (drawing_id);
create index on quotation_items (quotation_id);
create index on boq_items (boq_id);
create index on invoice_items (invoice_id);
create index on transactions (project_id);
create index on expenses (project_id);
create index on supervisor_ledger (supervisor_id);
create index on material_request_lines (request_id);
create index on po_items (po_id);
create index on goods_receipt_lines (receipt_id);
create index on wo_items (work_order_id);
create index on subcon_progress (work_order_id);
create index on ra_bills (work_order_id);
create index on salary_slips (employee_id);
create index on labour_attendance (date);
create index on memberships (user_id);

-- ----------------------------------------------------------------------------
-- Row-Level Security
-- Every table with an org_id gets a single member-scoped read/write policy.
-- Role-level restrictions (e.g. engineers may not read payroll) layer on top
-- in a later migration; this baseline keeps the org boundary airtight.
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

-- orgs: members can read their own org
alter table orgs enable row level security;
drop policy if exists org_self_read on orgs;
create policy org_self_read on orgs for select to authenticated using (public.is_org_member(id));

-- profiles: a user reads/writes their own row, and can read co-members' rows
alter table profiles enable row level security;
drop policy if exists profile_self_write on profiles;
create policy profile_self_write on profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists profile_comember_read on profiles;
create policy profile_comember_read on profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from memberships m1
      join memberships m2 on m1.org_id = m2.org_id
      where m1.user_id = auth.uid() and m2.user_id = profiles.id
    )
  );


-- >>>>>>>>>>>>>>>>>>>>>>>>>> migrations\0002_realtime_activity.sql >>>>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================================================
-- SiteHub â€” migration 0002: live multi-device sync
-- Adds the two tables the client store needs (activity_log, categories),
-- widens transactions/expenses category columns to text (dynamic categories),
-- adds dpr.photo_urls, and turns on Supabase Realtime for every table the
-- client store reads/writes so changes on one device stream to all others.
-- Idempotent where practical; safe to run once after 0001_init.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Activity log â€” mirrors ActivityLogEntry (src/lib/types.ts). Was in-memory
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
-- 2. Categories â€” backs category-store.tsx (was localStorage only). One row per
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
-- 4. DPR photos â€” client uploads compressed data-URL photos; add a column so
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


-- >>>>>>>>>>>>>>>>>>>>>>>>>> seed.sql >>>>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================================================
-- SiteHub â€” demo seed
-- Populates the tables the data-access layer (src/lib/data/) currently reads,
-- so every migrated page (dashboard, analytics, clients, projects, design,
-- quotations, invoices) shows real data the moment you point .env.local at this
-- database. Mirrors src/lib/mock/data.ts. Remaining modules (material, subcon,
-- payroll, equipment, â€¦) get seeded as those read paths are migrated.
--
-- Apply AFTER 0001_init.sql, e.g.  supabase db reset  (runs migration + seed),
-- or paste this whole file into the SQL editor.
--
-- Person-linked columns (pm_id, assignee_id, author_id, â€¦) are left NULL because
-- profiles reference auth.users; backfill them once your team has signed up.
--
-- Stable UUIDs: pg_temp.sid('kind:code') = md5(...)::uuid, recomputable for FKs.
-- ============================================================================

create function pg_temp.sid(text) returns uuid language sql immutable as $$
  select md5($1)::uuid
$$;

-- one org; every row hangs off it
insert into orgs (id, name, gstin) values
  (pg_temp.sid('org:charu'), 'Charu Construction & Design', '09AAACH0000A1Z5');

-- ---------- clients ----------
insert into clients (id, org_id, name, company, email, phone, address, gst, created_at) values
  (pg_temp.sid('client:c1'), pg_temp.sid('org:charu'), 'Rakesh Agarwal', 'Agarwal Estates Pvt Ltd', 'rakesh@agarwalestates.in', '+91 98100 11223', 'Sector 62, Noida, UP', '09AABCA1234L1ZP', '2025-09-12'),
  (pg_temp.sid('client:c2'), pg_temp.sid('org:charu'), 'Meera Sharma', 'Sharma Residency', 'meera.sharma@gmail.com', '+91 99710 44556', 'Vasant Kunj, New Delhi', '07ABXPS5678K1Z2', '2025-10-03'),
  (pg_temp.sid('client:c3'), pg_temp.sid('org:charu'), 'Imtiaz Khan', 'Crescent Hospitality', 'imtiaz@crescenthotels.com', '+91 90045 78901', 'MG Road, Gurugram, HR', '06AADCC9012M1Z8', '2025-11-20'),
  (pg_temp.sid('client:c4'), pg_temp.sid('org:charu'), 'Lakshmi Iyer', 'Iyer Family Trust', 'lakshmi.iyer@outlook.com', '+91 98860 23344', 'Indiranagar, Bengaluru, KA', '29AAATI3456N1Z1', '2026-01-08');

-- ---------- projects ----------
insert into projects (id, org_id, code, name, client_id, value, status, start_date, end_date, percent_complete, location) values
  (pg_temp.sid('project:p1'), pg_temp.sid('org:charu'), 'SH-001', 'Agarwal Corporate Tower', pg_temp.sid('client:c1'), 48500000, 'ongoing', '2025-10-01', '2026-09-30', 62, 'Sector 62, Noida'),
  (pg_temp.sid('project:p2'), pg_temp.sid('org:charu'), 'SH-002', 'Sharma Villa Renovation', pg_temp.sid('client:c2'), 9800000, 'ongoing', '2025-11-15', '2026-07-31', 81, 'Vasant Kunj, Delhi'),
  (pg_temp.sid('project:p3'), pg_temp.sid('org:charu'), 'SH-003', 'Crescent Boutique Hotel', pg_temp.sid('client:c3'), 73200000, 'ongoing', '2026-01-10', '2027-03-31', 28, 'MG Road, Gurugram'),
  (pg_temp.sid('project:p4'), pg_temp.sid('org:charu'), 'SH-004', 'Iyer Residence', pg_temp.sid('client:c4'), 14200000, 'planning', '2026-03-01', '2026-12-15', 8, 'Indiranagar, Bengaluru');

-- ---------- tasks ----------
insert into tasks (id, org_id, project_id, parent_id, name, start_date, end_date, status, progress_value, progress_target, unit, delay_days) values
  (pg_temp.sid('task:t1'),  pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), null, 'Site mobilisation & excavation', '2025-10-01', '2025-11-15', 'completed', 100, 100, 'percent', 0),
  (pg_temp.sid('task:t2'),  pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), null, 'Foundation & raft', '2025-11-16', '2026-01-20', 'completed', 100, 100, 'percent', 0),
  (pg_temp.sid('task:t3'),  pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), null, 'RCC superstructure', '2026-01-21', '2026-06-30', 'ongoing', 8, 14, 'numbers', 0),
  (pg_temp.sid('task:t3a'), pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), pg_temp.sid('task:t3'), 'Columns & beams (floors 1-8)', '2026-01-21', '2026-04-30', 'completed', 8, 8, 'numbers', 0),
  (pg_temp.sid('task:t3b'), pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), pg_temp.sid('task:t3'), 'Slab casting (floors 9-14)', '2026-05-01', '2026-06-30', 'ongoing', 0, 6, 'numbers', 0),
  (pg_temp.sid('task:t4'),  pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), null, 'Block work & plastering', '2026-04-01', '2026-07-15', 'ongoing', 3429.5, 6000, 'meter', 0),
  (pg_temp.sid('task:t5'),  pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), null, 'MEP rough-in', '2026-05-15', '2026-08-15', 'delayed', 12, 40, 'percent', 6),
  (pg_temp.sid('task:t6'),  pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), null, 'Facade glazing', '2026-07-01', '2026-09-15', 'not_started', 0, 100, 'percent', 0),
  (pg_temp.sid('task:t7'),  pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), null, 'Interior fit-out & handover', '2026-08-01', '2026-09-30', 'not_started', 0, 100, 'percent', 0),
  (pg_temp.sid('task:t10'), pg_temp.sid('org:charu'), pg_temp.sid('project:p2'), null, 'Demolition & structural strengthening', '2025-11-15', '2026-01-10', 'completed', 100, 100, 'percent', 0),
  (pg_temp.sid('task:t11'), pg_temp.sid('org:charu'), pg_temp.sid('project:p2'), null, 'Flooring & joinery', '2026-01-11', '2026-04-30', 'completed', 100, 100, 'percent', 0),
  (pg_temp.sid('task:t12'), pg_temp.sid('org:charu'), pg_temp.sid('project:p2'), null, 'Painting & finishes', '2026-05-01', '2026-06-30', 'ongoing', 47, 50, 'numbers', 0),
  (pg_temp.sid('task:t13'), pg_temp.sid('org:charu'), pg_temp.sid('project:p2'), null, 'Landscaping & handover', '2026-07-01', '2026-07-31', 'not_started', 0, 100, 'percent', 0),
  (pg_temp.sid('task:t20'), pg_temp.sid('org:charu'), pg_temp.sid('project:p3'), null, 'Piling & foundation', '2026-01-10', '2026-05-30', 'ongoing', 60, 100, 'percent', 0),
  (pg_temp.sid('task:t21'), pg_temp.sid('org:charu'), pg_temp.sid('project:p3'), null, 'Structural frame', '2026-06-01', '2026-11-30', 'delayed', 5, 20, 'percent', 12),
  (pg_temp.sid('task:t22'), pg_temp.sid('org:charu'), pg_temp.sid('project:p3'), null, 'Envelope & MEP', '2026-10-01', '2027-01-31', 'not_started', 0, 100, 'percent', 0),
  (pg_temp.sid('task:t30'), pg_temp.sid('org:charu'), pg_temp.sid('project:p4'), null, 'Design development & approvals', '2026-03-01', '2026-05-15', 'ongoing', 35, 100, 'percent', 0),
  (pg_temp.sid('task:t31'), pg_temp.sid('org:charu'), pg_temp.sid('project:p4'), null, 'Site preparation', '2026-05-16', '2026-06-30', 'not_started', 0, 100, 'percent', 0);

-- ---------- transactions (ledger) ----------
insert into transactions (org_id, project_id, party_id, date, direction, amount, cost_code, category, note) values
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), null, '2026-01-15', 'out', 4200000, 'material', 'material', 'RMC supply Jan'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), null, '2026-02-12', 'out', 3800000, 'material', 'material', 'Steel & block'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), null, '2026-03-10', 'out', 1500000, 'labour', 'salary', 'Labour wages Mar'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), null, '2026-04-08', 'out', 1650000, 'labour', 'salary', 'Labour wages Apr'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), null, '2026-04-22', 'out', 220000, 'machinery', 'site', 'Crane rental'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), null, '2026-05-05', 'out', 95000, 'diesel', 'site', 'DG diesel'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), null, '2026-05-20', 'out', 2900000, 'material', 'material', 'Block & cement'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), null, '2026-06-02', 'out', 1700000, 'labour', 'salary', 'Labour wages Jun'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), null, '2026-06-10', 'out', 480000, 'other', 'subcon', 'MEP subcon RA1'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), pg_temp.sid('client:c1'), '2026-04-06', 'in', 8260000, 'other', 'other', 'INV-2026-031'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), pg_temp.sid('client:c1'), '2026-06-01', 'in', 3000000, 'other', 'other', 'INV-2026-038 part'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p2'), null, '2026-02-10', 'out', 1100000, 'material', 'material', 'Flooring material'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p2'), null, '2026-04-15', 'out', 900000, 'labour', 'salary', 'Labour'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p2'), null, '2026-05-20', 'out', 700000, 'other', 'other', 'Finishes'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p3'), null, '2026-02-28', 'out', 5200000, 'material', 'material', 'Piling material'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p3'), null, '2026-04-30', 'out', 2100000, 'labour', 'salary', 'Labour'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p3'), pg_temp.sid('client:c3'), '2026-03-21', 'in', 11800000, 'other', 'other', 'INV-2026-029');

-- ---------- sales invoices + items ----------
insert into sales_invoices (id, org_id, number, project_id, client_id, date, due_date, tax_rate, received, status) values
  (pg_temp.sid('inv:inv1'), pg_temp.sid('org:charu'), 'INV-2026-031', pg_temp.sid('project:p1'), pg_temp.sid('client:c1'), '2026-04-05', '2026-05-05', 18, 8260000, 'paid'),
  (pg_temp.sid('inv:inv2'), pg_temp.sid('org:charu'), 'INV-2026-038', pg_temp.sid('project:p1'), pg_temp.sid('client:c1'), '2026-05-28', '2026-06-27', 18, 3000000, 'partial'),
  (pg_temp.sid('inv:inv3'), pg_temp.sid('org:charu'), 'INV-2026-040', pg_temp.sid('project:p2'), pg_temp.sid('client:c2'), '2026-06-01', '2026-07-01', 18, 0, 'sent'),
  (pg_temp.sid('inv:inv4'), pg_temp.sid('org:charu'), 'INV-2026-029', pg_temp.sid('project:p3'), pg_temp.sid('client:c3'), '2026-03-20', '2026-04-20', 18, 11800000, 'paid');

insert into invoice_items (org_id, invoice_id, description, qty, unit, rate) values
  (pg_temp.sid('org:charu'), pg_temp.sid('inv:inv1'), 'RA Bill #3 â€” superstructure milestone', 1, 'lot', 7000000),
  (pg_temp.sid('org:charu'), pg_temp.sid('inv:inv2'), 'RA Bill #4 â€” block work milestone', 1, 'lot', 5500000),
  (pg_temp.sid('org:charu'), pg_temp.sid('inv:inv3'), 'Finishing stage milestone', 1, 'lot', 2200000),
  (pg_temp.sid('org:charu'), pg_temp.sid('inv:inv4'), 'Mobilisation advance + RA Bill #1', 1, 'lot', 10000000);

-- ---------- BOQ + items ----------
insert into boqs (id, org_id, project_id) values
  (pg_temp.sid('boq:b1'), pg_temp.sid('org:charu'), pg_temp.sid('project:p1')),
  (pg_temp.sid('boq:b2'), pg_temp.sid('org:charu'), pg_temp.sid('project:p2'));

insert into boq_items (org_id, boq_id, description, cost_code, qty, unit, rate) values
  (pg_temp.sid('org:charu'), pg_temp.sid('boq:b1'), 'RCC works (M30) incl. steel & formwork', 'material', 2800, 'cum', 8200),
  (pg_temp.sid('org:charu'), pg_temp.sid('boq:b1'), 'Block work & plaster', 'material', 6000, 'sqm', 850),
  (pg_temp.sid('org:charu'), pg_temp.sid('boq:b1'), 'Structural steel â€” facade support', 'material', 42, 'MT', 78000),
  (pg_temp.sid('org:charu'), pg_temp.sid('boq:b1'), 'Skilled & unskilled labour', 'labour', 1, 'lot', 6800000),
  (pg_temp.sid('org:charu'), pg_temp.sid('boq:b1'), 'Tower crane & hoist', 'machinery', 11, 'month', 220000),
  (pg_temp.sid('org:charu'), pg_temp.sid('boq:b1'), 'DG & site power (diesel)', 'diesel', 11, 'month', 95000),
  (pg_temp.sid('org:charu'), pg_temp.sid('boq:b1'), 'MEP & finishes', 'other', 1, 'lot', 7400000),
  (pg_temp.sid('org:charu'), pg_temp.sid('boq:b2'), 'Structural strengthening', 'material', 1, 'lot', 1200000),
  (pg_temp.sid('org:charu'), pg_temp.sid('boq:b2'), 'Flooring & joinery', 'material', 1, 'lot', 2400000),
  (pg_temp.sid('org:charu'), pg_temp.sid('boq:b2'), 'Labour', 'labour', 1, 'lot', 1900000),
  (pg_temp.sid('org:charu'), pg_temp.sid('boq:b2'), 'Finishes & landscaping', 'other', 1, 'lot', 1600000);

-- ---------- quotations + items ----------
insert into quotations (id, org_id, number, client_id, project_name, date, valid_until, status, tax_rate) values
  (pg_temp.sid('qtn:q1'), pg_temp.sid('org:charu'), 'QTN-2026-014', pg_temp.sid('client:c4'), 'Iyer Residence', '2026-02-02', '2026-03-04', 'accepted', 18),
  (pg_temp.sid('qtn:q2'), pg_temp.sid('org:charu'), 'QTN-2026-021', pg_temp.sid('client:c3'), 'Crescent â€” Phase 2 spa wing', '2026-05-18', '2026-06-18', 'sent', 18);

insert into quotation_items (org_id, quotation_id, description, qty, unit, rate) values
  (pg_temp.sid('org:charu'), pg_temp.sid('qtn:q1'), 'Architectural design & drawings', 1, 'lot', 950000),
  (pg_temp.sid('org:charu'), pg_temp.sid('qtn:q1'), 'Civil construction (built-up)', 4200, 'sqft', 2200),
  (pg_temp.sid('org:charu'), pg_temp.sid('qtn:q1'), 'Interior fit-out', 1, 'lot', 2800000),
  (pg_temp.sid('org:charu'), pg_temp.sid('qtn:q2'), 'Spa & wellness wing construction', 1, 'lot', 8200000),
  (pg_temp.sid('org:charu'), pg_temp.sid('qtn:q2'), 'Specialised MEP', 1, 'lot', 1900000);

-- ---------- drawings + versions ----------
insert into drawings (id, org_id, project_id, title, discipline, current_rev, status) values
  (pg_temp.sid('dwg:dr1'), pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), 'General Arrangement Plan', 'architectural', 'C', 'approved'),
  (pg_temp.sid('dwg:dr2'), pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), 'Structural Framing â€” Typical Floor', 'structural', 'B', 'for_review'),
  (pg_temp.sid('dwg:dr3'), pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), 'MEP Services Layout', 'mep', 'A', 'draft'),
  (pg_temp.sid('dwg:dr4'), pg_temp.sid('org:charu'), pg_temp.sid('project:p2'), 'Interior Layout â€” Ground Floor', 'interior', 'D', 'approved');

insert into drawing_versions (org_id, drawing_id, rev, date, notes, file_kb) values
  (pg_temp.sid('org:charu'), pg_temp.sid('dwg:dr1'), 'A', '2025-09-20', 'Initial issue for client review', 4800),
  (pg_temp.sid('org:charu'), pg_temp.sid('dwg:dr1'), 'B', '2025-10-30', 'Core relocated per structural input', 4950),
  (pg_temp.sid('org:charu'), pg_temp.sid('dwg:dr1'), 'C', '2026-06-08', 'Lift lobby revised; approved for construction', 5120),
  (pg_temp.sid('org:charu'), pg_temp.sid('dwg:dr2'), 'A', '2025-11-02', 'First structural issue', 3600),
  (pg_temp.sid('org:charu'), pg_temp.sid('dwg:dr2'), 'B', '2026-06-05', 'M30 grade note added (SR-12)', 3720),
  (pg_temp.sid('org:charu'), pg_temp.sid('dwg:dr3'), 'A', '2026-05-20', 'Draft coordination model export', 6200),
  (pg_temp.sid('org:charu'), pg_temp.sid('dwg:dr4'), 'A', '2025-11-20', 'Concept', 2800),
  (pg_temp.sid('org:charu'), pg_temp.sid('dwg:dr4'), 'B', '2025-12-15', 'Client revisions r1', 2900),
  (pg_temp.sid('org:charu'), pg_temp.sid('dwg:dr4'), 'C', '2026-02-10', 'Matte door finish', 3000),
  (pg_temp.sid('org:charu'), pg_temp.sid('dwg:dr4'), 'D', '2026-05-01', 'Final for execution', 3050);

-- ---------- suppliers ----------
insert into suppliers (id, org_id, name, company, contact, phone, email, gst, address) values
  (pg_temp.sid('supplier:s1'), pg_temp.sid('org:charu'), 'Sunil Verma', 'UltraBuild Materials Pvt Ltd', 'Sunil Verma', '+91 98110 22001', 'sales@ultrabuild.in', '09AAACU1234F1ZV', 'Industrial Area, Sahibabad, UP'),
  (pg_temp.sid('supplier:s2'), pg_temp.sid('org:charu'), 'Farah Sheikh', 'SteelLine Traders', 'Farah Sheikh', '+91 99100 55002', 'orders@steelline.co.in', '07AAFCS5678G1Z3', 'Wazirpur, New Delhi'),
  (pg_temp.sid('supplier:s3'), pg_temp.sid('org:charu'), 'Mahesh Pillai', 'Crescent Electricals & Plumbing', 'Mahesh Pillai', '+91 90080 33003', 'info@crescentep.com', '06AAGCC9012H1Z9', 'Sector 18, Gurugram, HR');

-- ---------- material items (warehouse) ----------
insert into material_items (id, org_id, name, category, unit, stock_qty, reorder_level, rate) values
  (pg_temp.sid('mat:m1'), pg_temp.sid('org:charu'), 'OPC 53 Grade Cement', 'cement', 'bag', 180, 200, 410),
  (pg_temp.sid('mat:m2'), pg_temp.sid('org:charu'), 'TMT Steel Bar 16mm', 'steel', 'MT', 8.5, 6, 71500),
  (pg_temp.sid('mat:m3'), pg_temp.sid('org:charu'), 'TMT Steel Bar 12mm', 'steel', 'MT', 3.2, 5, 72000),
  (pg_temp.sid('mat:m4'), pg_temp.sid('org:charu'), 'Coarse Aggregate 20mm', 'aggregate', 'cum', 240, 150, 1450),
  (pg_temp.sid('mat:m5'), pg_temp.sid('org:charu'), 'River Sand', 'aggregate', 'cum', 95, 120, 2100),
  (pg_temp.sid('mat:m6'), pg_temp.sid('org:charu'), 'AAC Block 600x200x200', 'blocks', 'no', 4200, 3000, 62),
  (pg_temp.sid('mat:m7'), pg_temp.sid('org:charu'), 'PVC Conduit 25mm', 'electrical', 'm', 380, 500, 38),
  (pg_temp.sid('mat:m8'), pg_temp.sid('org:charu'), 'CPVC Pipe 1in', 'plumbing', 'm', 620, 400, 145);

-- ---------- material requests + lines (by_id null until users exist) ----------
insert into material_requests (id, org_id, number, project_id, date, status, note) values
  (pg_temp.sid('mr:mr1'), pg_temp.sid('org:charu'), 'MR-2026-051', pg_temp.sid('project:p1'), '2026-06-16', 'approved', 'Floor 9 slab pour'),
  (pg_temp.sid('mr:mr2'), pg_temp.sid('org:charu'), 'MR-2026-054', pg_temp.sid('project:p1'), '2026-06-18', 'pending', 'MEP rough-in floor 4'),
  (pg_temp.sid('mr:mr3'), pg_temp.sid('org:charu'), 'MR-2026-055', pg_temp.sid('project:p3'), '2026-06-17', 'pending', 'Piling reinforcement');

insert into material_request_lines (org_id, request_id, material_item_id, qty) values
  (pg_temp.sid('org:charu'), pg_temp.sid('mr:mr1'), pg_temp.sid('mat:m1'), 220),
  (pg_temp.sid('org:charu'), pg_temp.sid('mr:mr1'), pg_temp.sid('mat:m2'), 4),
  (pg_temp.sid('org:charu'), pg_temp.sid('mr:mr2'), pg_temp.sid('mat:m7'), 300),
  (pg_temp.sid('org:charu'), pg_temp.sid('mr:mr2'), pg_temp.sid('mat:m8'), 120),
  (pg_temp.sid('org:charu'), pg_temp.sid('mr:mr3'), pg_temp.sid('mat:m3'), 6);

-- ---------- purchase orders + items ----------
insert into purchase_orders (id, org_id, number, supplier_id, project_id, date, status, tax_rate, discount, terms, payment_terms) values
  (pg_temp.sid('po:po1'), pg_temp.sid('org:charu'), 'PO-2026-088', pg_temp.sid('supplier:s1'), pg_temp.sid('project:p1'), '2026-06-10', 'received', 28, 12000, 'Delivery within 3 days at site. Material to conform to IS standards. Rejected material to be lifted by supplier.', '50% advance, balance within 30 days of delivery.'),
  (pg_temp.sid('po:po2'), pg_temp.sid('org:charu'), 'PO-2026-092', pg_temp.sid('supplier:s2'), pg_temp.sid('project:p1'), '2026-06-15', 'sent', 18, 0, 'Material to be delivered in single lot. Test certificates required.', 'Net 45 days from delivery.');

insert into po_items (id, org_id, po_id, description, material_item_id, qty, unit, rate) values
  (pg_temp.sid('poitem:poi1'), pg_temp.sid('org:charu'), pg_temp.sid('po:po1'), 'OPC 53 Grade Cement', pg_temp.sid('mat:m1'), 400, 'bag', 410),
  (pg_temp.sid('poitem:poi2'), pg_temp.sid('org:charu'), pg_temp.sid('po:po1'), 'Coarse Aggregate 20mm', pg_temp.sid('mat:m4'), 120, 'cum', 1450),
  (pg_temp.sid('poitem:poi3'), pg_temp.sid('org:charu'), pg_temp.sid('po:po2'), 'TMT Steel Bar 16mm', pg_temp.sid('mat:m2'), 6, 'MT', 71500),
  (pg_temp.sid('poitem:poi4'), pg_temp.sid('org:charu'), pg_temp.sid('po:po2'), 'TMT Steel Bar 12mm', pg_temp.sid('mat:m3'), 4, 'MT', 72000);

-- ---------- goods receipts + lines, booking ----------
insert into goods_receipts (id, org_id, number, po_id, date) values
  (pg_temp.sid('grn:gr1'), pg_temp.sid('org:charu'), 'GRN-2026-061', pg_temp.sid('po:po1'), '2026-06-13');

insert into goods_receipt_lines (org_id, receipt_id, po_item_id, qty_received) values
  (pg_temp.sid('org:charu'), pg_temp.sid('grn:gr1'), pg_temp.sid('poitem:poi1'), 400),
  (pg_temp.sid('org:charu'), pg_temp.sid('grn:gr1'), pg_temp.sid('poitem:poi2'), 120);

insert into purchase_bookings (org_id, po_id, bill_no, date, amount, status) values
  (pg_temp.sid('org:charu'), pg_temp.sid('po:po1'), 'UB/2026/2231', '2026-06-14', 384000, 'booked');

-- ---------- material usage ----------
insert into material_usage (org_id, project_id, material_item_id, qty, date, ref) values
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), pg_temp.sid('mat:m1'), 220, '2026-06-17', 'Floor 9 slab'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), pg_temp.sid('mat:m4'), 80, '2026-06-17', 'Floor 9 slab'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), pg_temp.sid('mat:m6'), 1800, '2026-06-12', 'Block work floor 6'),
  (pg_temp.sid('org:charu'), pg_temp.sid('project:p1'), pg_temp.sid('mat:m2'), 3.5, '2026-06-16', 'Column reinforcement');

-- ---------- subcontractors ----------
insert into subcontractors (id, org_id, name, company, trade, contact, phone, gst) values
  (pg_temp.sid('sub:sc1'), pg_temp.sid('org:charu'), 'Ravi Yadav', 'Yadav RCC Works', 'rcc', 'Ravi Yadav', '+91 98730 11221', '09ADFPY1122A1ZK'),
  (pg_temp.sid('sub:sc2'), pg_temp.sid('org:charu'), 'Anil Kumar', 'PowerFlow MEP Services', 'mep', 'Anil Kumar', '+91 99580 44556', '07AEKPK3344B1Z2'),
  (pg_temp.sid('sub:sc3'), pg_temp.sid('org:charu'), 'Deepak Shah', 'ClearView Facade Systems', 'facade', 'Deepak Shah', '+91 90250 77889', '06AFLPS5566C1Z7');

-- ---------- subcon work orders + items ----------
insert into subcon_work_orders (id, org_id, number, subcontractor_id, project_id, date, status, tax_rate, signatory) values
  (pg_temp.sid('wo:wo1'), pg_temp.sid('org:charu'), 'WO-2026-017', pg_temp.sid('sub:sc1'), pg_temp.sid('project:p1'), '2026-02-01', 'in_progress', 18, 'Priya Nair (Project Manager)'),
  (pg_temp.sid('wo:wo2'), pg_temp.sid('org:charu'), 'WO-2026-024', pg_temp.sid('sub:sc2'), pg_temp.sid('project:p1'), '2026-05-10', 'issued', 18, 'Priya Nair (Project Manager)');

insert into wo_items (org_id, work_order_id, description, qty, unit, rate) values
  (pg_temp.sid('org:charu'), pg_temp.sid('wo:wo1'), 'RCC superstructure â€” labour & shuttering (per cum)', 2800, 'cum', 1850),
  (pg_temp.sid('org:charu'), pg_temp.sid('wo:wo1'), 'Steel cutting, bending & tying (per MT)', 320, 'MT', 6500),
  (pg_temp.sid('org:charu'), pg_temp.sid('wo:wo2'), 'MEP rough-in â€” electrical & plumbing (lumpsum)', 1, 'lot', 2400000);

-- ---------- subcon progress ----------
insert into subcon_progress (org_id, work_order_id, date, percent, note) values
  (pg_temp.sid('org:charu'), pg_temp.sid('wo:wo1'), '2026-04-30', 45, 'Columns & beams floors 1-8 complete'),
  (pg_temp.sid('org:charu'), pg_temp.sid('wo:wo1'), '2026-06-15', 58, 'Slab casting floors 9-11 in progress'),
  (pg_temp.sid('org:charu'), pg_temp.sid('wo:wo2'), '2026-06-12', 12, 'Conduiting floor 4 started');

-- ---------- material issues to subcontractors ----------
insert into material_issues (org_id, subcontractor_id, project_id, material_item_id, qty, date) values
  (pg_temp.sid('org:charu'), pg_temp.sid('sub:sc1'), pg_temp.sid('project:p1'), pg_temp.sid('mat:m2'), 3.5, '2026-06-16'),
  (pg_temp.sid('org:charu'), pg_temp.sid('sub:sc2'), pg_temp.sid('project:p1'), pg_temp.sid('mat:m7'), 150, '2026-06-18');

-- ---------- RA bills (gross âˆ’ deductions = net) ----------
insert into ra_bills (org_id, number, work_order_id, date, percent_complete, gross_amount, deductions, net_amount, status) values
  (pg_temp.sid('org:charu'), 'RA-WO017-03', pg_temp.sid('wo:wo1'), '2026-05-05', 45, 4660000, 233000, 4427000, 'paid'),
  (pg_temp.sid('org:charu'), 'RA-WO017-04', pg_temp.sid('wo:wo1'), '2026-06-16', 58, 1346000, 67300, 1278700, 'submitted');

-- ---------- equipment & assets ----------
insert into equipment (org_id, code, name, kind, ownership, status, project_id, monthly_rate, acquired_date) values
  (pg_temp.sid('org:charu'), 'TC-01', 'Potain Tower Crane MCi 85', 'machinery', 'rented', 'in_use', pg_temp.sid('project:p1'), 220000, '2025-11-01'),
  (pg_temp.sid('org:charu'), 'PH-02', 'Material Hoist 2T', 'machinery', 'owned', 'in_use', pg_temp.sid('project:p1'), 35000, '2021-05-10'),
  (pg_temp.sid('org:charu'), 'EX-03', 'JCB 3DX Backhoe Loader', 'machinery', 'rented', 'idle', pg_temp.sid('project:p3'), 165000, '2026-01-12'),
  (pg_temp.sid('org:charu'), 'DG-04', 'Kirloskar 125 kVA DG Set', 'machinery', 'owned', 'in_use', pg_temp.sid('project:p1'), 28000, '2020-08-20'),
  (pg_temp.sid('org:charu'), 'CM-05', 'Concrete Mixer 10/7', 'machinery', 'owned', 'maintenance', pg_temp.sid('project:p2'), 12000, '2019-03-15'),
  (pg_temp.sid('org:charu'), 'VB-06', 'Needle Vibrator Set (x4)', 'tool', 'owned', 'in_use', pg_temp.sid('project:p1'), 4000, '2023-06-01'),
  (pg_temp.sid('org:charu'), 'WT-07', 'Total Station Leica TS07', 'tool', 'owned', 'idle', null, 9000, '2022-10-05'),
  (pg_temp.sid('org:charu'), 'SC-08', 'Cup-lock Scaffolding (5T set)', 'asset', 'owned', 'in_use', pg_temp.sid('project:p1'), 45000, '2021-01-20'),
  (pg_temp.sid('org:charu'), 'PP-09', 'Diesel Pump 3in', 'tool', 'rented', 'idle', pg_temp.sid('project:p3'), 6000, '2026-02-01'),
  (pg_temp.sid('org:charu'), 'LV-10', 'Site Vehicle â€” Bolero Pickup', 'asset', 'owned', 'in_use', pg_temp.sid('project:p1'), 22000, '2022-04-18');

-- ----------------------------------------------------------------------------
-- After signup, link yourself to the org so RLS lets you read the above:
--   insert into memberships (org_id, user_id, role)
--   values (md5('org:charu')::uuid, auth.uid(), 'admin');
-- (run while authenticated, or substitute your profiles.id for auth.uid()).
-- ----------------------------------------------------------------------------


