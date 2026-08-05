-- ----------------------------------------------------------------------------
-- 0018 — Restrict DELETE on quotations to super_admin
--
-- 0002 generated role_delete for the whole 'commercial' group from its write
-- roles (super_admin + accountant). Deleting a quotation is destructive and
-- irreversible — quotation_items cascade away with it — so narrow DELETE to
-- super_admin while leaving INSERT/UPDATE (ordinary editing) with accountants.
--
-- Safe to re-run. Apply in the Supabase SQL editor.
-- ----------------------------------------------------------------------------

drop policy if exists role_delete on public.quotations;

create policy role_delete on public.quotations
  for delete to authenticated
  using (
    public.is_org_member(org_id)
    and public.has_role(org_id, array['super_admin'])
  );

-- quotation_items are removed by the FK cascade on quotations(id), which runs
-- as a system operation and is not subject to RLS — so no matching change is
-- needed there. Its own role_delete still allows accountants to remove
-- individual lines while editing, which is intended.
