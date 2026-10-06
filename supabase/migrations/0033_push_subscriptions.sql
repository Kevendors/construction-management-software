-- ============================================================================
-- 0033_push_subscriptions.sql — Browser Web Push Subscriptions
-- Stores browser push endpoints, p256dh, and auth tokens per user/org for
-- system-level out-of-app OS notifications.
-- ============================================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for resolving push targets by user and org
create index if not exists push_subs_user_idx on public.push_subscriptions(user_id);
create index if not exists push_subs_org_idx on public.push_subscriptions(org_id);

-- RLS
alter table public.push_subscriptions enable row level security;

-- Users can read their own subscriptions
drop policy if exists push_subs_select on public.push_subscriptions;
create policy push_subs_select on public.push_subscriptions for select to authenticated
  using (user_id = auth.uid());

-- Users can insert their own subscriptions
drop policy if exists push_subs_insert on public.push_subscriptions;
create policy push_subs_insert on public.push_subscriptions for insert to authenticated
  with check (user_id = auth.uid() and public.is_org_member(org_id));

-- Users can update/delete their own subscriptions
drop policy if exists push_subs_update on public.push_subscriptions;
create policy push_subs_update on public.push_subscriptions for update to authenticated
  using (user_id = auth.uid());

drop policy if exists push_subs_delete on public.push_subscriptions;
create policy push_subs_delete on public.push_subscriptions for delete to authenticated
  using (user_id = auth.uid());
