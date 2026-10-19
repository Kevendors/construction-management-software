-- ============================================================================
-- 0040_expenses_staff_engineer.sql — RLS on expenses never matched the app
-- ----------------------------------------------------------------------------
-- ROLE_MODULES (src/lib/auth/permissions.ts) gives 'staff' and 'engineer'
-- nav/page access to Petty Expenses, and the app's Log/Edit Expense actions
-- let any signed-in member log or withdraw their OWN pending expense. But the
-- 0002_rbac.sql write policy on `expenses` only ever allowed
-- super_admin/pm/supervisor/accountant to insert/update/delete -- so a
-- staff/engineer member logging an expense hit "new row violates row-level
-- security policy for table expenses" every time, even though the UI let
-- them get there.
--
-- Fixes it at the real boundary (RLS), matching what the app already
-- enforces at the action layer:
--   - staff/engineer can INSERT only a row addressed to themselves
--     (by_id = auth.uid()) -- can't log on someone else's behalf.
--   - staff/engineer can UPDATE/DELETE only their own row, and only while
--     it's still pending -- matches updateOwnExpenseAction /
--     withdrawOwnExpenseAction's existing app-layer check.
--   - super_admin/pm/supervisor/accountant keep full read/write on every
--     row, exactly as before (0002) -- unchanged.
--   - SELECT is extended to staff/engineer so they can see the shared
--     expense ledger (same org-wide visibility every other allowed role
--     already has on this page) -- not just their own rows.
-- ============================================================================

drop policy if exists role_read on public.expenses;
create policy role_read on public.expenses for select to authenticated
using (
  public.is_org_member(org_id)
  and public.has_role(org_id, array['super_admin','pm','supervisor','accountant','staff','engineer'])
);

drop policy if exists role_insert on public.expenses;
create policy role_insert on public.expenses for insert to authenticated
with check (
  public.is_org_member(org_id) and (
    public.has_role(org_id, array['super_admin','pm','supervisor','accountant'])
    or (public.has_role(org_id, array['staff','engineer']) and by_id = auth.uid())
  )
);

drop policy if exists role_update on public.expenses;
create policy role_update on public.expenses for update to authenticated
using (
  public.is_org_member(org_id) and (
    public.has_role(org_id, array['super_admin','pm','supervisor','accountant'])
    or (public.has_role(org_id, array['staff','engineer']) and by_id = auth.uid() and status::text = 'pending')
  )
)
with check (
  public.is_org_member(org_id) and (
    public.has_role(org_id, array['super_admin','pm','supervisor','accountant'])
    or (public.has_role(org_id, array['staff','engineer']) and by_id = auth.uid())
  )
);

drop policy if exists role_delete on public.expenses;
create policy role_delete on public.expenses for delete to authenticated
using (
  public.is_org_member(org_id) and (
    public.has_role(org_id, array['super_admin','pm','supervisor','accountant'])
    or (public.has_role(org_id, array['staff','engineer']) and by_id = auth.uid() and status::text = 'pending')
  )
);

-- ----------------------------------------------------------------------------
-- ROLLBACK: re-run the 'expenses' block of 0002_rbac.sql to restore the
-- original super_admin/pm/supervisor/accountant-only policies.
-- ----------------------------------------------------------------------------
