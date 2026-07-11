import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth/context";

/**
 * The single visibility seam for server data modules: which project ids may
 * the current user see? `null` = unrestricted (super admin, or mock/demo mode
 * where the mock currentUser is a super admin). RLS (0010) enforces the same
 * rule at the DB; this keeps app behavior correct before 0010 is applied and
 * lets pages branch without re-querying.
 */
export async function getVisibleProjectIds(): Promise<string[] | null> {
  if (!isSupabaseConfigured()) return null;

  const ctx = await getAuthContext();
  if (!ctx) return []; // signed out: middleware redirects, but never leak here
  if (ctx.role === "super_admin") return null;

  const supabase = await createSupabase();
  const { data, error } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", ctx.userId);
  if (error) {
    // Table not migrated yet (0009 pending) — keep today's org-wide visibility
    // rather than locking everyone out; RLS remains the hard gate once applied.
    console.error("[team] project_members unavailable, visibility unrestricted", error.message);
    return null;
  }
  return (data as { project_id: string }[]).map((r) => r.project_id);
}

/** Applies the visibility seam to any project-keyed list. */
export function filterByProjectIds<T>(
  rows: T[],
  visibleIds: string[] | null,
  projectIdOf: (row: T) => string | null | undefined
): T[] {
  if (visibleIds === null) return rows;
  const allowed = new Set(visibleIds);
  return rows.filter((row) => {
    const pid = projectIdOf(row);
    return pid ? allowed.has(pid) : true; // unallocated rows stay visible
  });
}
