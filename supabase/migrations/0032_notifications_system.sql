-- ============================================================================
-- 0032_notifications_system.sql — In-app notification center & indexes
--
-- The notifications table was created in 0001_init.sql.
-- This migration ensures proper indexes, updated RLS policies so all org
-- members can read/update their own notifications and org broadcasts,
-- and enables real-time notification alerts across SiteHub.
-- ============================================================================

-- Ensure notification_kind enum values are complete
-- ('approval','delay','payment','stock','info' are the 0001 kinds)

-- ── 1. Hot indexes for fast user notification lookups & unread counts ──────
create index if not exists notifications_org_user_read_idx
  on public.notifications (org_id, user_id, read, created_at desc);

create index if not exists notifications_org_broadcast_idx
  on public.notifications (org_id, created_at desc)
  where user_id is null;

-- ── 2. RLS policies ─────────────────────────────────────────────────────────
alter table public.notifications enable row level security;

-- SELECT: users can see their own targeted notifications OR org-wide broadcasts (user_id is null)
drop policy if exists notif_select on public.notifications;
drop policy if exists role_read on public.notifications;
create policy notif_select on public.notifications for select to authenticated
  using (
    public.is_org_member(org_id)
    and (user_id is null or user_id = auth.uid())
  );

-- UPDATE: users can mark their own notifications as read
drop policy if exists notif_update on public.notifications;
drop policy if exists role_update on public.notifications;
create policy notif_update on public.notifications for update to authenticated
  using (
    public.is_org_member(org_id)
    and (user_id is null or user_id = auth.uid())
  )
  with check (
    public.is_org_member(org_id)
    and (user_id is null or user_id = auth.uid())
  );

-- INSERT: any authenticated org member (or service actions) can generate notifications
drop policy if exists notif_insert on public.notifications;
drop policy if exists role_insert on public.notifications;
create policy notif_insert on public.notifications for insert to authenticated
  with check (
    public.is_org_member(org_id)
  );

-- DELETE: users can delete their own notifications; super_admin can clean up any org notification
drop policy if exists notif_delete on public.notifications;
drop policy if exists role_delete on public.notifications;
create policy notif_delete on public.notifications for delete to authenticated
  using (
    public.is_org_member(org_id)
    and (user_id = auth.uid() or public.has_role(org_id, array['super_admin']))
  );
