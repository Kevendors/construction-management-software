-- ============================================================================
-- 0009_project_members.sql — per-project team assignment
-- Super admin assigns users (any role) to projects; 0010 then scopes
-- non-admin visibility to assigned projects. Requires 0008 (enum values).
-- Safe to re-run (idempotent).
--
-- Assignment is ALWAYS manual and super_admin-only (pmem_write). No triggers,
-- no backfills: creating a project or setting its pm_id does NOT put anyone on
-- the roster. (An earlier revision auto-enrolled the PM/creator; 0011 removes
-- that from DBs that ran it.)
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

