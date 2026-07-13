-- ============================================================================
-- 0014_purchase_orders_project_scoped.sql — grant AND project membership
-- Refines 0013: a granted user now sees ONLY the purchase orders for projects
-- they are assigned to (project_members), not every org PO. Access becomes:
--   * Super Admin           → all POs
--   * granted + project member → POs for that project only
--   * everyone else         → none
-- Unallocated POs (project_id is null) are visible to Super Admin only, since
-- there is no project to be a member of. Requires 0009/0013. Write policies
-- untouched. Safe to re-run (idempotent).
-- ============================================================================

-- purchase_orders: direct project_id
drop policy if exists role_read on public.purchase_orders;
create policy role_read on public.purchase_orders for select to authenticated using (
  public.is_org_member(org_id) and (
    public.has_role(org_id, array['super_admin'])
    or (public.can_view_pos(org_id) and public.is_project_member(project_id))
  )
);

-- child tables: scope through the parent PO's project_id (grant still required)
drop policy if exists role_read on public.po_items;
create policy role_read on public.po_items for select to authenticated using (
  public.is_org_member(org_id) and (
    public.has_role(org_id, array['super_admin'])
    or (public.can_view_pos(org_id) and exists (
      select 1 from public.purchase_orders o
      where o.id = po_items.po_id and public.is_project_member(o.project_id)))
  )
);

drop policy if exists role_read on public.goods_receipts;
create policy role_read on public.goods_receipts for select to authenticated using (
  public.is_org_member(org_id) and (
    public.has_role(org_id, array['super_admin'])
    or (public.can_view_pos(org_id) and exists (
      select 1 from public.purchase_orders o
      where o.id = goods_receipts.po_id and public.is_project_member(o.project_id)))
  )
);

drop policy if exists role_read on public.goods_receipt_lines;
create policy role_read on public.goods_receipt_lines for select to authenticated using (
  public.is_org_member(org_id) and (
    public.has_role(org_id, array['super_admin'])
    or (public.can_view_pos(org_id) and exists (
      select 1 from public.goods_receipts gr
      join public.purchase_orders o on o.id = gr.po_id
      where gr.id = goods_receipt_lines.receipt_id and public.is_project_member(o.project_id)))
  )
);

drop policy if exists role_read on public.purchase_bookings;
create policy role_read on public.purchase_bookings for select to authenticated using (
  public.is_org_member(org_id) and (
    public.has_role(org_id, array['super_admin'])
    or (public.can_view_pos(org_id) and exists (
      select 1 from public.purchase_orders o
      where o.id = purchase_bookings.po_id and public.is_project_member(o.project_id)))
  )
);

-- ----------------------------------------------------------------------------
-- ROLLBACK: re-run 0013 (grant-only, all POs) or 0002+0012 (role + project).
-- ----------------------------------------------------------------------------
