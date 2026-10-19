-- ============================================================================
-- 0041_role_audit_fixes.sql — fixes from the full role/permissions audit
-- ----------------------------------------------------------------------------
-- Five separate, independent gaps where ROLE_MODULES (UI nav) grants a role
-- a page, but the database's RLS policy for the table(s) behind that page
-- was never updated to match — same bug class as the Staff/Engineer expenses
-- issue fixed in 0040. Each block only touches the exact table(s) named;
-- no other role's existing access changes.
-- ============================================================================

-- 1) projects — accountant/hr/subcontractor/viewer/client get zero rows from
--    any direct `projects` read today, even for projects they're assigned to
--    via project_members. This empties their Dashboard, Analytics,
--    Transactions, Payroll-project-labels, and the whole Projects list page.
--    Fix: add them to the same project-membership-scoped clause pm/supervisor/
--    staff/engineer/architect already use. super_admin is unaffected (still
--    sees everything). Nobody gains a project they aren't a member of —
--    the admin must still assign them via each project's Team tab, exactly
--    as already required for every other non-super-admin role.
drop policy if exists role_read on public.projects;
create policy role_read on public.projects for select to authenticated
  using (
    public.is_org_member(org_id)
    and (
      public.has_role(org_id, array['super_admin'])
      or (
        public.has_role(org_id, array['pm','supervisor','staff','engineer','architect','accountant','hr','subcontractor','viewer','client'])
        and public.is_project_member(id)
      )
    )
  );

-- 2) labour_contractors — hr has the only non-super_admin "payroll" page,
--    but this table was never in the 'payroll' RLS group (it's in 'crm',
--    which never included hr). hr could neither see nor add a contractor.
drop policy if exists role_read on public.labour_contractors;
create policy role_read on public.labour_contractors for select to authenticated
  using (public.is_org_member(org_id) and public.has_role(org_id, array['super_admin','pm','accountant','hr']));

drop policy if exists role_insert on public.labour_contractors;
create policy role_insert on public.labour_contractors for insert to authenticated
  with check (public.is_org_member(org_id) and public.has_role(org_id, array['super_admin','pm','hr']));

drop policy if exists role_update on public.labour_contractors;
create policy role_update on public.labour_contractors for update to authenticated
  using (public.is_org_member(org_id) and public.has_role(org_id, array['super_admin','pm','hr']))
  with check (public.is_org_member(org_id) and public.has_role(org_id, array['super_admin','pm','hr']));

drop policy if exists role_delete on public.labour_contractors;
create policy role_delete on public.labour_contractors for delete to authenticated
  using (public.is_org_member(org_id) and public.has_role(org_id, array['super_admin','pm','hr']));

-- 3) labour_attendance — same shape: it's in the 'site' RLS group (never
--    included hr), so hr could neither see nor mark labour attendance from
--    the Payroll page, even though that's hr's own module.
drop policy if exists role_read on public.labour_attendance;
create policy role_read on public.labour_attendance for select to authenticated
  using (
    public.is_org_member(org_id) and public.has_role(org_id, array['super_admin','pm','supervisor','staff','engineer','architect','hr'])
    and (public.has_role(org_id, array['super_admin']) or project_id is null or public.is_project_member(project_id))
  );

drop policy if exists role_insert on public.labour_attendance;
create policy role_insert on public.labour_attendance for insert to authenticated
  with check (public.is_org_member(org_id) and public.has_role(org_id, array['super_admin','pm','supervisor','hr']));

drop policy if exists role_update on public.labour_attendance;
create policy role_update on public.labour_attendance for update to authenticated
  using (public.is_org_member(org_id) and public.has_role(org_id, array['super_admin','pm','supervisor','hr']))
  with check (public.is_org_member(org_id) and public.has_role(org_id, array['super_admin','pm','supervisor','hr']));

drop policy if exists role_delete on public.labour_attendance;
create policy role_delete on public.labour_attendance for delete to authenticated
  using (public.is_org_member(org_id) and public.has_role(org_id, array['super_admin','pm','supervisor','hr']));

-- 4) clients — accountant has the only non-super_admin "clients" page and the
--    app already lets accountant create/edit a client (createClientAction/
--    updateClientAction have no app-level role check, relying on RLS), but
--    0026 mistakenly believed this table was already covered and only fixed
--    'suppliers'. accountant could not create/edit a client, which also broke
--    the auto-create-new-client step inside Save Quotation / Save Invoice.
drop policy if exists role_insert on public.clients;
create policy role_insert on public.clients for insert to authenticated
  with check (public.is_org_member(org_id) and public.has_role(org_id, array['super_admin','pm','accountant']));

drop policy if exists role_update on public.clients;
create policy role_update on public.clients for update to authenticated
  using (public.is_org_member(org_id) and public.has_role(org_id, array['super_admin','pm','accountant']))
  with check (public.is_org_member(org_id) and public.has_role(org_id, array['super_admin','pm','accountant']));

-- 5) expenses — 0040 (Staff/Engineer fix) accidentally undid two things from
--    earlier migrations while rewriting this table's policies:
--      a) 0010's project-membership scoping on SELECT was dropped, so
--         pm/supervisor/accountant/staff/engineer could suddenly read every
--         project's expenses org-wide instead of only their assigned ones.
--      b) 0006's "only Super Admin may approve/reject/delete" hardening was
--         dropped, so pm/supervisor/accountant could again update or delete
--         ANY expense (not just their own pending one) — the app layer
--         (setExpenseStatus/deleteExpenseAction) still only allows this for
--         super_admin, so RLS had quietly become looser than the app.
--    This restores both, while keeping 0040's real fix: any signed-in member
--    can still edit/withdraw their OWN still-pending expense (by_id =
--    auth.uid()), matching updateOwnExpenseAction/withdrawOwnExpenseAction
--    exactly — generalized from "staff/engineer only" to "whoever logged it",
--    since the app action itself already works that way for every role.
drop policy if exists role_read on public.expenses;
create policy role_read on public.expenses for select to authenticated
using (
  public.is_org_member(org_id)
  and public.has_role(org_id, array['super_admin','pm','supervisor','accountant','staff','engineer'])
  and (public.has_role(org_id, array['super_admin']) or project_id is null or public.is_project_member(project_id))
);

drop policy if exists role_update on public.expenses;
create policy role_update on public.expenses for update to authenticated
using (
  public.is_org_member(org_id) and (
    public.has_role(org_id, array['super_admin'])
    or (by_id = auth.uid() and status::text = 'pending')
  )
)
with check (
  public.is_org_member(org_id) and (
    public.has_role(org_id, array['super_admin'])
    or by_id = auth.uid()
  )
);

drop policy if exists role_delete on public.expenses;
create policy role_delete on public.expenses for delete to authenticated
using (
  public.is_org_member(org_id) and (
    public.has_role(org_id, array['super_admin'])
    or (by_id = auth.uid() and status::text = 'pending')
  )
);

-- ----------------------------------------------------------------------------
-- ROLLBACK: re-run 0010 (projects read + expenses read), 0002 block for
-- labour_contractors/labour_attendance/clients, 0006 (expenses update/delete),
-- and 0040 (expenses update/delete with staff/engineer clause) in that order.
-- ----------------------------------------------------------------------------
