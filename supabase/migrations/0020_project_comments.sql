-- ----------------------------------------------------------------------------
-- 0020 — Project discussion thread
--
-- 0005 added dpr_comments: replies attached to a specific daily progress
-- report. This is the project-level equivalent — a running conversation for
-- the project as a whole, not tied to any one DPR.
--
-- Visibility follows the 0010 model rather than 0005's: a comment is readable
-- by super_admins and by people actually assigned to the project (Team tab),
-- not by the whole org. Posting requires the same, plus authoring as yourself.
-- Deleting is limited to your own comment, or any comment for a super_admin —
-- so the history can't be quietly rewritten by others.
--
-- Safe to re-run. Apply in the Supabase SQL editor.
-- ----------------------------------------------------------------------------

create table if not exists public.project_comments (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs(id) on delete cascade,
  project_id  uuid not null references public.projects(id) on delete cascade,
  author_id   uuid references auth.users(id) on delete set null,
  author_name text,
  body        text not null,
  created_at  timestamptz not null default now()
);

-- Threads are always read oldest-first for one project.
create index if not exists project_comments_project_idx
  on public.project_comments (project_id, created_at);

alter table public.project_comments enable row level security;

drop policy if exists project_comments_read on public.project_comments;
create policy project_comments_read on public.project_comments
  for select to authenticated
  using (
    public.is_org_member(org_id)
    and (
      public.has_role(org_id, array['super_admin'])
      or public.is_project_member(project_id)
    )
  );

drop policy if exists project_comments_insert on public.project_comments;
create policy project_comments_insert on public.project_comments
  for insert to authenticated
  with check (
    public.is_org_member(org_id)
    and author_id = auth.uid()
    and (
      public.has_role(org_id, array['super_admin'])
      or public.is_project_member(project_id)
    )
  );

-- Authors may remove their own; super_admin may remove any. No UPDATE policy
-- at all — comments are a record of what was said, so they aren't editable.
drop policy if exists project_comments_delete on public.project_comments;
create policy project_comments_delete on public.project_comments
  for delete to authenticated
  using (
    author_id = auth.uid()
    or public.has_role(org_id, array['super_admin'])
  );
