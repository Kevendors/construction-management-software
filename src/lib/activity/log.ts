import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface LogActivityInput {
  action: string; // 'created' | 'updated' | 'deleted' | ...
  entityType: string; // 'expense' | 'invoice' | 'employee' | ...
  entityId?: string | null;
  summary: string; // human-readable one-liner
  meta?: Record<string, unknown>;
}

/**
 * Append an entry to the org activity feed. Best-effort: never throws, so a
 * logging failure can't break the primary action that called it.
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: m } = await supabase
      .from("memberships")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    const orgId = (m?.org_id as string | undefined) ?? null;
    if (!orgId) return;

    const actorName =
      (user.user_metadata?.name as string | undefined) ||
      (user.user_metadata?.full_name as string | undefined) ||
      user.email ||
      null;

    await supabase.from("activity_log").insert({
      org_id: orgId,
      actor_id: user.id,
      actor_name: actorName,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      summary: input.summary,
      meta: input.meta ?? null,
    });
  } catch (e) {
    console.error("[activity] log failed", e instanceof Error ? e.message : e);
  }
}
