"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface DprComment {
  id: string;
  dprId: string;
  authorName: string | null;
  body: string;
  createdAt: string;
}

interface CommentRow {
  id: string;
  dpr_id: string;
  author_name: string | null;
  body: string;
  created_at: string;
}

async function currentContext(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { orgId: null, user: null };
  const { data } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  return { orgId: (data?.org_id as string | undefined) ?? null, user };
}

const map = (r: CommentRow): DprComment => ({
  id: r.id,
  dprId: r.dpr_id,
  authorName: r.author_name,
  body: r.body,
  createdAt: r.created_at,
});

/** All replies across a project's DPRs, oldest-first. */
export async function listProjectCommentsAction(projectId: string): Promise<DprComment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dpr_comments")
    .select("id, dpr_id, author_name, body, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as CommentRow[]).map(map);
}

/** Add a reply to a DPR. */
export async function addDprCommentAction(
  dprId: string,
  projectId: string,
  body: string
): Promise<{ comment?: DprComment; error?: string }> {
  const text = body.trim();
  if (!text) return { error: "Reply can't be empty." };

  const supabase = await createClient();
  const { orgId, user } = await currentContext(supabase);
  if (!orgId || !user) return { error: "You must be signed in." };

  const authorName =
    (user.user_metadata?.name as string | undefined) ||
    (user.user_metadata?.full_name as string | undefined) ||
    user.email ||
    null;

  const { data, error } = await supabase
    .from("dpr_comments")
    .insert({
      org_id: orgId,
      project_id: projectId,
      dpr_id: dprId,
      author_id: user.id,
      author_name: authorName,
      body: text,
    })
    .select("id, dpr_id, author_name, body, created_at")
    .single();
  if (error) return { error: error.message };
  return { comment: map(data as CommentRow) };
}

// ---------------------------------------------------------------------------
// Project-level discussion (0020) — a thread for the project as a whole,
// separate from the per-DPR replies above.
// ---------------------------------------------------------------------------

export interface ProjectComment {
  id: string;
  projectId: string;
  authorId: string | null;
  authorName: string | null;
  body: string;
  createdAt: string;
}

interface ProjectCommentRow {
  id: string;
  project_id: string;
  author_id: string | null;
  author_name: string | null;
  body: string;
  created_at: string;
}

const PROJECT_COMMENT_COLS = "id, project_id, author_id, author_name, body, created_at";

const mapProjectComment = (r: ProjectCommentRow): ProjectComment => ({
  id: r.id,
  projectId: r.project_id,
  authorId: r.author_id,
  authorName: r.author_name,
  body: r.body,
  createdAt: r.created_at,
});

/** A project's whole conversation, oldest-first. Empty in mock/demo mode. */
export async function listProjectDiscussionAction(projectId: string): Promise<ProjectComment[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_comments")
    .select(PROJECT_COMMENT_COLS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as ProjectCommentRow[]).map(mapProjectComment);
}

/** Post to a project's discussion. RLS decides whether you're on the project. */
export async function addProjectCommentAction(
  projectId: string,
  body: string
): Promise<{ comment?: ProjectComment; error?: string }> {
  const text = body.trim();
  if (!text) return { error: "Comment can't be empty." };
  if (!isSupabaseConfigured()) return { error: "Comments need a live database." };

  const supabase = await createClient();
  const { orgId, user } = await currentContext(supabase);
  if (!orgId || !user) return { error: "You must be signed in." };

  const authorName =
    (user.user_metadata?.name as string | undefined) ||
    (user.user_metadata?.full_name as string | undefined) ||
    user.email ||
    null;

  const { data, error } = await supabase
    .from("project_comments")
    .insert({
      org_id: orgId,
      project_id: projectId,
      author_id: user.id,
      author_name: authorName,
      body: text,
    })
    .select(PROJECT_COMMENT_COLS)
    .single();
  // The insert policy requires membership of this project, so a denial here
  // is nearly always "you're not on this project's team".
  if (error) return { error: error.message };
  return { comment: mapProjectComment(data as ProjectCommentRow) };
}

/**
 * Remove a comment. The delete policy allows only your own, or any for a
 * super_admin — no row comes back when RLS refuses, which is how we tell.
 */
export async function deleteProjectCommentAction(
  id: string
): Promise<{ id?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { error: "Comments need a live database." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_comments")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "You can only delete your own comments." };
  return { id };
}
