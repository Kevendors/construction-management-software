-- ============================================================================
-- 0015_member_employee_id.sql — auto-generated Employee IDs (KV001, KV002, …)
-- Adds memberships.employee_id and backfills existing members per org in
-- account-creation order. New members get the next number app-side in
-- createMemberAction (src/app/team/actions.ts); the unique index below is the
-- collision guard for concurrent creates. Safe to re-run (idempotent — the
-- backfill only touches rows where employee_id is null).
-- ============================================================================

alter table public.memberships add column if not exists employee_id text;

-- Backfill members without an ID in account-creation order, per org,
-- continuing after the org's highest existing KV number (0 on first run)
with base as (
  select org_id,
         coalesce(max((substring(employee_id from '^KV(\d+)$'))::int), 0) as maxn
  from public.memberships
  group by org_id
),
numbered as (
  select id, org_id,
         row_number() over (partition by org_id order by created_at, id) as rn
  from public.memberships
  where employee_id is null
)
update public.memberships m
set employee_id = 'KV' || lpad((b.maxn + n.rn)::text, 3, '0')
from numbered n
join base b on b.org_id = n.org_id
where m.id = n.id;

-- Collision guard (per org)
create unique index if not exists memberships_org_employee_id_key
  on public.memberships (org_id, employee_id);

-- ----------------------------------------------------------------------------
-- ROLLBACK:
--   drop index if exists memberships_org_employee_id_key;
--   alter table public.memberships drop column if exists employee_id;
-- ----------------------------------------------------------------------------
