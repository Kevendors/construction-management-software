-- ============================================================================
-- 0010_project_scoped_visibility.sql — membership-scoped project reads
-- Non-super-admins can only SELECT rows for projects they are assigned to
-- (project_members, 0009). Role-based module gating from 0002 still applies
-- on top. Write policies are untouched.
--
-- APPLY LAST: run 0008 + 0009 first, deploy the app, let the super admin
-- populate each project's Team tab (including PMs — nobody is enrolled
-- automatically), and only then apply this file — otherwise unassigned
-- users lose access abruptly. Safe to re-run (idempotent).
-- ============================================================================

-- ── projects: super_admin sees all; others need site-read role AND membership
drop policy if exists role_read on public.projects;
create policy role_read on public.projects for select to authenticated
  using (
    public.is_org_member(org_id)
    and (
      public.has_role(org_id, array['super_admin'])
      or (
        public.has_role(org_id, array['pm','supervisor','staff','engineer','architect'])
        and public.is_project_member(id)
      )
    )
  );

-- ── project-surface tables: keep each group's 0002 read roles, add membership.
--    project_id is NOT NULL on the first block, nullable on the second
--    (null = head-office/unallocated rows, still visible to the role group).
do $$
declare
  t record;
begin
  for t in
    select * from (values
      -- table            read roles (from 0002/0006)                                null-tolerant
      ('tasks',             array['super_admin','pm','supervisor','staff','engineer','architect'], false),
      ('dprs',              array['super_admin','pm','supervisor','staff','engineer','architect'], false),
      ('site_instructions', array['super_admin','pm','supervisor','staff','engineer','architect'], false),
      ('project_files',     array['super_admin','pm','supervisor','staff','engineer','architect'], false),
      ('drawings',          array['super_admin','pm','supervisor','staff','engineer','architect'], false),
      ('boqs',              array['super_admin','pm','supervisor','staff','engineer','architect'], false),
      ('labour_attendance', array['super_admin','pm','supervisor','staff','engineer','architect'], true),
      ('expenses',          array['super_admin','pm','supervisor','accountant'],                   true),
      ('supervisor_ledger', array['super_admin','pm','supervisor','accountant'],                   true),
      ('transactions',      array['super_admin','pm','accountant'],                                true),
      ('sales_invoices',    array['super_admin','pm','accountant'],                                true)
    ) as v(tbl, rroles, nullable)
  loop
    execute format('drop policy if exists role_read on public.%I;', t.tbl);
    if t.nullable then
      execute format(
        'create policy role_read on public.%I for select to authenticated using ('
        || 'public.is_org_member(org_id) and public.has_role(org_id, %L) and ('
        || 'public.has_role(org_id, array[''super_admin'']) or project_id is null or public.is_project_member(project_id)));',
        t.tbl, t.rroles);
    else
      execute format(
        'create policy role_read on public.%I for select to authenticated using ('
        || 'public.is_org_member(org_id) and public.has_role(org_id, %L) and ('
        || 'public.has_role(org_id, array[''super_admin'']) or public.is_project_member(project_id)));',
        t.tbl, t.rroles);
    end if;
  end loop;
end $$;

-- Follow-up (not yet scoped, still org-wide by role — only reachable by
-- super_admin/pm/supervisor per 0002): material_*, purchase_*, subcon_*,
-- equipment, notifications, and item child tables without project_id
-- (boq_items, invoice_items, quotation_items, drawing_versions, ...).

-- ── list_org_projects(): SECURITY DEFINER, so it bypasses the table policy
--    above and MUST filter by membership itself (keeps the 0006 value-masking).
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
  )
  and (
    public.has_role(p.org_id, array['super_admin'])
    or public.is_project_member(p.id)
  );
$$;

grant execute on function public.list_org_projects() to authenticated;

-- ----------------------------------------------------------------------------
-- ROLLBACK: re-run the 0002_rbac.sql policy block (and the 0006 hardening
-- overrides), then restore the 0006 version of list_org_projects().
-- ----------------------------------------------------------------------------
