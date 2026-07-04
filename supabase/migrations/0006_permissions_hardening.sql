-- Tighten specific tables beyond the generic RBAC policies in 0002_rbac.sql.
-- (Generic policies are named role_read/role_insert/role_update/role_delete;
--  we drop + recreate the ones that need stricter role arrays.)

-- ── expenses: only Super Admin may approve (update) or delete; insert stays broad
drop policy if exists role_update on public.expenses;
create policy role_update on public.expenses for update to authenticated
  using (public.is_org_member(org_id) and public.has_role(org_id, array['super_admin']))
  with check (public.is_org_member(org_id) and public.has_role(org_id, array['super_admin']));

drop policy if exists role_delete on public.expenses;
create policy role_delete on public.expenses for delete to authenticated
  using (public.is_org_member(org_id) and public.has_role(org_id, array['super_admin']));

-- ── projects: supervisors cannot create projects
drop policy if exists role_insert on public.projects;
create policy role_insert on public.projects for insert to authenticated
  with check (public.is_org_member(org_id) and public.has_role(org_id, array['super_admin','pm']));

-- ── project_files: only Super Admin / PM may delete uploaded files
drop policy if exists role_delete on public.project_files;
create policy role_delete on public.project_files for delete to authenticated
  using (public.is_org_member(org_id) and public.has_role(org_id, array['super_admin','pm']));

-- ── supervisor_ledger: only Super Admin may allocate / change balance entries
drop policy if exists role_insert on public.supervisor_ledger;
create policy role_insert on public.supervisor_ledger for insert to authenticated
  with check (public.is_org_member(org_id) and public.has_role(org_id, array['super_admin']));
drop policy if exists role_update on public.supervisor_ledger;
create policy role_update on public.supervisor_ledger for update to authenticated
  using (public.is_org_member(org_id) and public.has_role(org_id, array['super_admin']))
  with check (public.is_org_member(org_id) and public.has_role(org_id, array['super_admin']));
drop policy if exists role_delete on public.supervisor_ledger;
create policy role_delete on public.supervisor_ledger for delete to authenticated
  using (public.is_org_member(org_id) and public.has_role(org_id, array['super_admin']));

-- ── Project value privacy: server-enforced. Non-super-admins get value = 0.
-- The project store reads projects through this function (rpc) instead of a
-- direct table select, so the real value never reaches non-admin clients.
create or replace function public.list_org_projects()
returns setof public.projects
language sql
stable
security definer
set search_path = public
as $$
  select (jsonb_populate_record(
            null::public.projects,
            to_jsonb(p) || case
              when public.has_role(p.org_id, array['super_admin']) then '{}'::jsonb
              else jsonb_build_object('value', 0)
            end
          )).*
  from public.projects p
  where p.org_id in (
    select m.org_id from public.memberships m where m.user_id = auth.uid()
  );
$$;

grant execute on function public.list_org_projects() to authenticated;
