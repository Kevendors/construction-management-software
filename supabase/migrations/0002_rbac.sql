-- ============================================================================
-- 0002_rbac.sql — Role-aware Row-Level Security (SiteHub Phase 1b)
-- Replaces the blanket per-table `org_rw` policy with per-role read/write
-- policies. super_admin & admin keep FULL access everywhere. Denied SELECTs
-- return zero rows (no error), so pages degrade gracefully.
-- Safe to re-run (idempotent). Requires 0001_init + Migration A first.
-- ============================================================================

-- Does the caller hold one of the given roles in this org (and is active)?
-- security definer → bypasses RLS on memberships (no recursion).
create or replace function public.has_role(p_org uuid, p_roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.org_id = p_org
      and m.user_id = auth.uid()
      and coalesce(m.is_active, true)
      and m.role::text = any(p_roles)
  );
$$;

-- Per-group read/write role sets.
do $$
declare
  g record;
  tbl text;
begin
  for g in
    select * from (values
      ('site',       array['projects','tasks','dprs','site_instructions','labour_attendance','project_files','drawings','drawing_versions','boqs','boq_items'],
                     array['super_admin','admin','pm','supervisor','staff','engineer','architect'],
                     array['super_admin','admin','pm','supervisor']),
      ('expenses',   array['expenses','supervisor_ledger'],
                     array['super_admin','admin','pm','supervisor','accountant'],
                     array['super_admin','admin','pm','supervisor','accountant']),
      ('crm',        array['clients','suppliers','subcontractors','labour_contractors'],
                     array['super_admin','admin','pm','accountant'],
                     array['super_admin','admin','pm']),
      ('commercial', array['quotations','quotation_items','sales_invoices','invoice_items','transactions'],
                     array['super_admin','admin','pm','accountant'],
                     array['super_admin','admin','accountant']),
      ('material',   array['material_items','material_requests','material_request_lines','purchase_orders','po_items','goods_receipts','goods_receipt_lines','purchase_bookings','material_usage'],
                     array['super_admin','admin','pm','supervisor'],
                     array['super_admin','admin','pm']),
      ('subcon',     array['subcon_work_orders','wo_items','subcon_progress','material_issues','ra_bills'],
                     array['super_admin','admin','pm','subcontractor'],
                     array['super_admin','admin','pm']),
      ('payroll',    array['employees','salary_slips','advances'],
                     array['super_admin','admin','hr','accountant'],
                     array['super_admin','admin','hr']),
      ('equipment',  array['equipment'],
                     array['super_admin','admin','pm','supervisor'],
                     array['super_admin','admin','pm']),
      ('notif',      array['notifications'],
                     array['super_admin','admin','pm','supervisor','accountant','hr','staff'],
                     array['super_admin','admin','pm','supervisor','accountant','hr','staff'])
    ) as v(grp, tables, rroles, wroles)
  loop
    foreach tbl in array g.tables loop
      execute format('alter table public.%I enable row level security;', tbl);
      execute format('drop policy if exists org_rw on public.%I;', tbl);
      execute format('drop policy if exists role_read on public.%I;', tbl);
      execute format('drop policy if exists role_insert on public.%I;', tbl);
      execute format('drop policy if exists role_update on public.%I;', tbl);
      execute format('drop policy if exists role_delete on public.%I;', tbl);
      execute format(
        'create policy role_read on public.%I for select to authenticated using (public.is_org_member(org_id) and public.has_role(org_id, %L));',
        tbl, g.rroles);
      execute format(
        'create policy role_insert on public.%I for insert to authenticated with check (public.is_org_member(org_id) and public.has_role(org_id, %L));',
        tbl, g.wroles);
      execute format(
        'create policy role_update on public.%I for update to authenticated using (public.is_org_member(org_id) and public.has_role(org_id, %L)) with check (public.is_org_member(org_id) and public.has_role(org_id, %L));',
        tbl, g.wroles, g.wroles);
      execute format(
        'create policy role_delete on public.%I for delete to authenticated using (public.is_org_member(org_id) and public.has_role(org_id, %L));',
        tbl, g.wroles);
    end loop;
  end loop;
end $$;

-- memberships: any org member may READ (needed to resolve their own role);
-- only super_admin / admin may INSERT/UPDATE/DELETE (blocks role escalation).
drop policy if exists org_rw on memberships;
drop policy if exists mem_read on memberships;
drop policy if exists mem_write on memberships;
create policy mem_read on memberships for select to authenticated
  using (public.is_org_member(org_id));
create policy mem_write on memberships for all to authenticated
  using (public.has_role(org_id, array['super_admin','admin']))
  with check (public.has_role(org_id, array['super_admin','admin']));

-- ----------------------------------------------------------------------------
-- ROLLBACK (if needed): restore the open per-member policy on every org table
-- ----------------------------------------------------------------------------
-- do $$ declare t record; begin
--   for t in select c.table_name from information_schema.columns c
--     join information_schema.tables tb on tb.table_schema=c.table_schema and tb.table_name=c.table_name
--     where c.table_schema='public' and c.column_name='org_id' and tb.table_type='BASE TABLE'
--   loop
--     execute format('drop policy if exists role_read on public.%I;', t.table_name);
--     execute format('drop policy if exists role_insert on public.%I;', t.table_name);
--     execute format('drop policy if exists role_update on public.%I;', t.table_name);
--     execute format('drop policy if exists role_delete on public.%I;', t.table_name);
--     execute format('drop policy if exists mem_read on public.%I;', t.table_name);
--     execute format('drop policy if exists mem_write on public.%I;', t.table_name);
--     execute format('drop policy if exists org_rw on public.%I;', t.table_name);
--     execute format('create policy org_rw on public.%I for all to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));', t.table_name);
--   end loop;
-- end $$;
