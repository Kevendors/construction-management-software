import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

/** Next sequential Employee ID (KV001, KV002, …) after the highest existing one. */
export function nextEmployeeId(existing: (string | null)[]): string {
  const max = existing.reduce((m, id) => {
    const x = /^KV(\d+)$/.exec(id ?? "");
    return x ? Math.max(m, Number(x[1])) : m;
  }, 0);
  return `KV${String(max + 1).padStart(3, "0")}`;
}

/**
 * Fetch the org's employee IDs and compute the next one. Returns null when the
 * employee_id column doesn't exist yet (migration 0015 not applied) so member
 * creation keeps working pre-migration.
 */
export async function computeNextEmployeeId(admin: Admin, orgId: string): Promise<string | null> {
  const { data, error } = await admin.from("memberships").select("employee_id").eq("org_id", orgId);
  if (error) return null;
  return nextEmployeeId((data ?? []).map((r) => (r as { employee_id: string | null }).employee_id));
}

/**
 * Give a member the next Employee ID if they don't have one yet (best-effort:
 * never throws, never overwrites an existing ID). Retries once if another
 * member grabbed the same number at the same moment (unique index).
 */
export async function assignEmployeeIdIfMissing(admin: Admin, orgId: string, userId: string): Promise<void> {
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const { data: row } = await admin
        .from("memberships")
        .select("employee_id")
        .eq("org_id", orgId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!row || (row as { employee_id: string | null }).employee_id) return;
      const next = await computeNextEmployeeId(admin, orgId);
      if (!next) return;
      const { error } = await admin
        .from("memberships")
        .update({ employee_id: next })
        .eq("org_id", orgId)
        .eq("user_id", userId)
        .is("employee_id", null);
      if (!error || error.code !== "23505") return;
    }
  } catch (err) {
    console.error("[employee-id] assign failed", err instanceof Error ? err.message : err);
  }
}
