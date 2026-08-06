-- ----------------------------------------------------------------------------
-- 0022 — Restrict DELETE on sales_invoices to super_admin
--
-- Same reasoning as 0018 did for quotations: 0002 generated role_delete for the
-- whole 'commercial' group from its write roles (super_admin + accountant), and
-- deleting an invoice is irreversible — invoice_items cascade away with it.
-- INSERT/UPDATE (ordinary billing work) stay with accountants.
--
-- The action layer additionally refuses paid/partly-paid invoices; this policy
-- is the second gate, not the whole rule.
--
-- Safe to re-run. Apply in the Supabase SQL editor.
-- ----------------------------------------------------------------------------

drop policy if exists role_delete on public.sales_invoices;

create policy role_delete on public.sales_invoices
  for delete to authenticated
  using (
    public.is_org_member(org_id)
    and public.has_role(org_id, array['super_admin'])
  );
