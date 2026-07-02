-- ============================================================================
-- SiteHub — initial schema (Phases 1–4)
-- Mirrors src/lib/types.ts and PLAN.md §C.3. Single org to start, multi-tenant
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
