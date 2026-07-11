import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolves the signed-in user's active org + user id from the Supabase session
 * and their membership. The client store needs org_id for insert payloads and
 * to scope its Realtime subscription. Returns null when not signed in or not a
 * member of any org (the store then stays empty rather than throwing).
 *
 * If a user belongs to multiple orgs we take the earliest membership; a future
 * org-switcher can pass an explicit org id instead.
 */
export interface ActiveOrg {
  orgId: string;
  userId: string;
}

export async function getActiveOrg(
  supabase: SupabaseClient
): Promise<ActiveOrg | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("memberships")
    .select("org_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return { orgId: data.org_id as string, userId: user.id };
}
