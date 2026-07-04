-- Replies / comments on daily progress reports (project updates).
create table if not exists public.dpr_comments (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs(id) on delete cascade,
  project_id  uuid references public.projects(id) on delete cascade,
  dpr_id      uuid not null references public.dprs(id) on delete cascade,
  author_id   uuid references auth.users(id) on delete set null,
  author_name text,
  body        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists dpr_comments_dpr_idx on public.dpr_comments (dpr_id, created_at);
create index if not exists dpr_comments_project_idx on public.dpr_comments (project_id);

alter table public.dpr_comments enable row level security;

drop policy if exists dpr_comments_read on public.dpr_comments;
create policy dpr_comments_read on public.dpr_comments
  for select using (public.is_org_member(org_id));

drop policy if exists dpr_comments_insert on public.dpr_comments;
create policy dpr_comments_insert on public.dpr_comments
  for insert with check (public.is_org_member(org_id));

-- A member may delete their own comment; admins can delete any.
drop policy if exists dpr_comments_delete on public.dpr_comments;
create policy dpr_comments_delete on public.dpr_comments
  for delete using (author_id = auth.uid() or public.has_role(org_id, array['super_admin']));
