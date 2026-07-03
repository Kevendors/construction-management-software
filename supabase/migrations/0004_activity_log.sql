-- Activity / audit log: a lightweight append-only feed of who did what.
create table if not exists public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs(id) on delete cascade,
  actor_id    uuid references auth.users(id) on delete set null,
  actor_name  text,
  action      text not null,        -- e.g. 'created', 'updated', 'deleted'
  entity_type text not null,        -- e.g. 'expense', 'invoice', 'employee'
  entity_id   uuid,
  summary     text not null,        -- human-readable one-liner
  meta        jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists activity_log_org_created_idx
  on public.activity_log (org_id, created_at desc);

alter table public.activity_log enable row level security;

drop policy if exists activity_read on public.activity_log;
create policy activity_read on public.activity_log
  for select using (public.is_org_member(org_id));

-- Any org member may append their own activity entries.
drop policy if exists activity_insert on public.activity_log;
create policy activity_insert on public.activity_log
  for insert with check (public.is_org_member(org_id));

drop policy if exists activity_delete on public.activity_log;
create policy activity_delete on public.activity_log
  for delete using (public.has_role(org_id, array['super_admin']));
