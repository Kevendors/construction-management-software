-- ============================================================================
-- 0012_scope_material_subcon_equipment.sql — extend project scoping (0010)
-- to the material / subcontractor / equipment surface, so a non-super-admin
-- only reads rows tied to a project they're assigned to. Closes the follow-up
-- gap 0010 documented (a supervisor could read every project's purchase
-- orders, PO line items, and equipment via the API). Requires 0009/0010.
--
-- Keeps each table's 0002 read-role gate; adds membership on top. Rows with a
-- null project_id (head-office / unallocated) stay visible to the role group.
-- Shared warehouse inventory (material_items) has no project and stays
-- org-scoped by design. Write policies untouched. Safe to re-run (idempotent).
-- ============================================================================

-- ── tables that carry project_id directly (null-tolerant) ───────────────────
do $$
declare t record;
begin
  for t in
    select * from (values
      ('purchase_orders',    array['super_admin','pm','supervisor']),
      ('material_requests',  array['super_admin','pm','supervisor']),
      ('material_usage',     array['super_admin','pm','supervisor']),
      ('subcon_work_orders', array['super_admin','pm','subcontractor']),
      ('material_issues',    array['super_admin','pm','subcontractor']),
      ('equipment',          array['super_admin','pm','supervisor'])
    ) as v(tbl, rroles)
  loop
    execute format('drop policy if exists role_read on public.%I;', t.tbl);
    execute format(
      'create policy role_read on public.%I for select to authenticated using ('
      || 'public.is_org_member(org_id) and public.has_role(org_id, %L) and ('
      || 'public.has_role(org_id, array[''super_admin'']) or project_id is null '
      || 'or public.is_project_member(project_id)));',
      t.tbl, t.rroles);
  end loop;
end $$;

-- ── child tables: scope through their parent's project_id ───────────────────
-- material group (super_admin,pm,supervisor)
drop policy if exists role_read on public.po_items;
create policy role_read on public.po_items for select to authenticated using (
  public.is_org_member(org_id) and public.has_role(org_id, array['super_admin','pm','supervisor'])
  and (public.has_role(org_id, array['super_admin']) or exists (
    select 1 from public.purchase_orders o
    where o.id = po_items.po_id
      and (o.project_id is null or public.is_project_member(o.project_id))))
);

drop policy if exists role_read on public.material_request_lines;
create policy role_read on public.material_request_lines for select to authenticated using (
  public.is_org_member(org_id) and public.has_role(org_id, array['super_admin','pm','supervisor'])
  and (public.has_role(org_id, array['super_admin']) or exists (
    select 1 from public.material_requests r
    where r.id = material_request_lines.request_id
      and (r.project_id is null or public.is_project_member(r.project_id))))
);

drop policy if exists role_read on public.goods_receipts;
create policy role_read on public.goods_receipts for select to authenticated using (
  public.is_org_member(org_id) and public.has_role(org_id, array['super_admin','pm','supervisor'])
  and (public.has_role(org_id, array['super_admin']) or exists (
    select 1 from public.purchase_orders o
    where o.id = goods_receipts.po_id
      and (o.project_id is null or public.is_project_member(o.project_id))))
);

drop policy if exists role_read on public.goods_receipt_lines;
create policy role_read on public.goods_receipt_lines for select to authenticated using (
  public.is_org_member(org_id) and public.has_role(org_id, array['super_admin','pm','supervisor'])
  and (public.has_role(org_id, array['super_admin']) or exists (
    select 1 from public.goods_receipts gr
    join public.purchase_orders o on o.id = gr.po_id
    where gr.id = goods_receipt_lines.receipt_id
      and (o.project_id is null or public.is_project_member(o.project_id))))
);

drop policy if exists role_read on public.purchase_bookings;
create policy role_read on public.purchase_bookings for select to authenticated using (
  public.is_org_member(org_id) and public.has_role(org_id, array['super_admin','pm','supervisor'])
  and (public.has_role(org_id, array['super_admin']) or exists (
    select 1 from public.purchase_orders o
    where o.id = purchase_bookings.po_id
      and (o.project_id is null or public.is_project_member(o.project_id))))
);

-- subcon group (super_admin,pm,subcontractor)
drop policy if exists role_read on public.wo_items;
create policy role_read on public.wo_items for select to authenticated using (
  public.is_org_member(org_id) and public.has_role(org_id, array['super_admin','pm','subcontractor'])
  and (public.has_role(org_id, array['super_admin']) or exists (
    select 1 from public.subcon_work_orders w
    where w.id = wo_items.work_order_id
      and (w.project_id is null or public.is_project_member(w.project_id))))
);

drop policy if exists role_read on public.subcon_progress;
create policy role_read on public.subcon_progress for select to authenticated using (
  public.is_org_member(org_id) and public.has_role(org_id, array['super_admin','pm','subcontractor'])
  and (public.has_role(org_id, array['super_admin']) or exists (
    select 1 from public.subcon_work_orders w
    where w.id = subcon_progress.work_order_id
      and (w.project_id is null or public.is_project_member(w.project_id))))
);

drop policy if exists role_read on public.ra_bills;
create policy role_read on public.ra_bills for select to authenticated using (
  public.is_org_member(org_id) and public.has_role(org_id, array['super_admin','pm','subcontractor'])
  and (public.has_role(org_id, array['super_admin']) or exists (
    select 1 from public.subcon_work_orders w
    where w.id = ra_bills.work_order_id
      and (w.project_id is null or public.is_project_member(w.project_id))))
);

-- Left org-scoped on purpose: material_items (shared warehouse inventory, no
-- project), notifications, and quotation_items (quotations have no project_id).

-- ----------------------------------------------------------------------------
-- ROLLBACK: re-run the 0002_rbac.sql policy block and the 0006 overrides.
-- ----------------------------------------------------------------------------
