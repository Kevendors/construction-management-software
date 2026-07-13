-- ============================================================================
-- 0013_purchase_order_grants.sql — Purchase Orders are opt-in per user
-- POs (and their receipts/bookings/line items) are NOT tied to project
-- membership or role. They are visible only to:
--   * Super Admin (always), and
--   * any user the Super Admin explicitly grants via memberships.can_view_
--     purchase_orders (toggled on the Team page).
-- Everyone else — regardless of role or project — sees NO purchase orders,
-- including unallocated ones. Default is no access. Requires 0009.
-- Write policies untouched. Safe to re-run (idempotent).
-- ============================================================================

alter table memberships
  add column if not exists can_view_purchase_orders boolean not null default false;

-- security-definer helper: has the caller been granted PO access in this org?
-- definer rights bypass RLS on memberships (no recursion), same pattern as
-- is_org_member / has_role.
create or replace function public.can_view_pos(p_org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.org_id = p_org
      and m.user_id = auth.uid()
      and coalesce(m.is_active, true)
      and coalesce(m.can_view_purchase_orders, false)
  );
$$;

-- The PO family: replace the role/project read policy with the explicit grant.
do $$
declare tbl text;
begin
  foreach tbl in array array[
    'purchase_orders','po_items','goods_receipts','goods_receipt_lines','purchase_bookings'
  ]
  loop
    execute format('drop policy if exists role_read on public.%I;', tbl);
    execute format(
      'create policy role_read on public.%I for select to authenticated using ('
      || 'public.is_org_member(org_id) and ('
      || 'public.has_role(org_id, array[''super_admin'']) or public.can_view_pos(org_id)));',
      tbl);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- ROLLBACK: re-run 0002_rbac.sql (restores the material-group role_read on the
-- PO family) then 0012 (re-adds project scoping); optionally drop the column
-- and can_view_pos().
-- ----------------------------------------------------------------------------
