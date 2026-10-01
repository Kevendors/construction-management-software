-- ----------------------------------------------------------------------------
-- 0026 — Accountant can create/edit suppliers
--
-- 0002_rbac.sql's 'crm' group (clients/suppliers/subcontractors/
-- labour_contractors) gives accountant read access but write only to
-- super_admin/pm. savePurchaseBillAction (Purchase Bills, Commercial
-- section) auto-creates a supplier record the same way saveInvoiceAction
-- already auto-creates a client — but accountant, who can write Purchase
-- Bills, could not write the supplier that bill needs, so a bill for a
-- not-yet-registered supplier silently saved with supplier_id = null.
--
-- Widens ONLY the suppliers write policy (not subcontractors/
-- labour_contractors, which stay super_admin/pm-only — accountant's new
-- access is specifically because of Purchase Bills, not a broader CRM
-- write grant). clients already includes accountant via 0002's separate
-- 'commercial' group.
--
-- Safe to re-run. Apply in the Supabase SQL editor.
-- ----------------------------------------------------------------------------

drop policy if exists role_insert on public.suppliers;
create policy role_insert on public.suppliers
  for insert to authenticated
  with check (is_org_member(org_id) and has_role(org_id, array['super_admin', 'pm', 'accountant']));

drop policy if exists role_update on public.suppliers;
create policy role_update on public.suppliers
  for update to authenticated
  using (is_org_member(org_id) and has_role(org_id, array['super_admin', 'pm', 'accountant']))
  with check (is_org_member(org_id) and has_role(org_id, array['super_admin', 'pm', 'accountant']));
