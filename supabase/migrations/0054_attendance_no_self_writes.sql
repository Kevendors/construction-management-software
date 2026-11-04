-- ============================================================================
-- 0054_attendance_no_self_writes.sql — employees can no longer write their own
-- attendance rows through the API. Punch in/out stays available: those server
-- actions set the time themselves and write with the service-role client. Only
-- super_admin/hr keep direct write access (eatt_admin_*, 0017). Read policies
-- and existing records are untouched.
--
-- ORDER MATTERS: apply only after the app version that writes punches with the
-- service-role client is live, or every punch in/out fails. Idempotent.
-- ============================================================================

drop policy if exists eatt_self_insert on public.employee_attendance;
drop policy if exists eatt_self_update on public.employee_attendance;

-- ----------------------------------------------------------------------------
-- ROLLBACK (restores the 0016 policies):
--   create policy eatt_self_insert on public.employee_attendance for insert to authenticated
--     with check (user_id = auth.uid() and public.is_org_member(org_id));
--   create policy eatt_self_update on public.employee_attendance for update to authenticated
--     using (user_id = auth.uid())
--     with check (user_id = auth.uid());
-- ----------------------------------------------------------------------------
