"use server";

import { createClient } from "@/lib/supabase/server";

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
