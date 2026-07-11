-- ============================================================================
-- 0009_project_members.sql — per-project team assignment
-- Super admin assigns users (any role) to projects; 0010 then scopes
-- non-admin visibility to assigned projects. Requires 0008 (enum values).
-- Safe to re-run (idempotent).
-- ============================================================================

create table if not exists public.project_members (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  role       role not null default 'engineer',
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create index if not exists project_members_user_idx on public.project_members (user_id);
create index if not exists project_members_org_idx on public.project_members (org_id);
-- (project_id lookups are covered by the unique(project_id, user_id) index)

-- security-definer helper: is the current user assigned to this project?
-- definer rights bypass RLS on project_members, so policies that call this
-- do not recurse (same pattern as is_org_member / has_role).
create or replace function public.is_project_member(p_project uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from project_members pm
    where pm.project_id = p_project and pm.user_id = auth.uid()
  );
$$;

alter table public.project_members enable row level security;

-- read: any org member (the Team tab shows the roster; users must be able to
-- resolve their own assignments). write: super_admin only (mirrors mem_write).
drop policy if exists pmem_read on public.project_members;
create policy pmem_read on public.project_members for select to authenticated
  using (public.is_org_member(org_id));

drop policy if exists pmem_write on public.project_members;
create policy pmem_write on public.project_members for all to authenticated
  using (public.has_role(org_id, array['super_admin']))
  with check (public.has_role(org_id, array['super_admin']));

-- Auto-enrol on project creation (security definer bypasses pmem_write, which
-- is super_admin-only): the assigned PM and the creator become members, so a
-- PM who creates a project can still see it once 0010 scopes visibility.
create or replace function public.handle_project_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.pm_id is not null then
    insert into project_members (org_id, project_id, user_id, role)
    values (new.org_id, new.id, new.pm_id, 'pm')
    on conflict (project_id, user_id) do nothing;
  end if;
  if auth.uid() is not null and auth.uid() is distinct from new.pm_id then
    insert into project_members (org_id, project_id, user_id, role)
    select new.org_id, new.id, auth.uid(), m.role
    from memberships m
    where m.org_id = new.org_id and m.user_id = auth.uid()
    on conflict (project_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_project_created on public.projects;
create trigger on_project_created
  after insert on public.projects
  for each row execute function public.handle_project_created();

-- Backfill: every existing project's PM becomes a project member, so nobody
-- who runs projects today loses visibility when 0010 flips enforcement on.
insert into public.project_members (org_id, project_id, user_id, role)
select p.org_id, p.id, p.pm_id, 'pm'::role
from public.projects p
where p.pm_id is not null
  and exists (select 1 from public.profiles pr where pr.id = p.pm_id)
on conflict (project_id, user_id) do nothing;
