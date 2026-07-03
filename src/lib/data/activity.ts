import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient as createSupabase } from "@/lib/supabase/server";

export interface ActivityEntry {
  id: string;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  createdAt: string;
}

interface ActivityRow {
  id: string;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  created_at: string;
}

const mapEntry = (r: ActivityRow): ActivityEntry => ({
  id: r.id,
  actorName: r.actor_name,
  action: r.action,
  entityType: r.entity_type,
  entityId: r.entity_id,
  summary: r.summary,
  createdAt: r.created_at,
});

export async function getActivityFeed(limit = 100): Promise<ActivityEntry[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createSupabase();
  const { data, error } = await supabase
    .from("activity_log")
    .select("id, actor_name, action, entity_type, entity_id, summary, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data as ActivityRow[]).map(mapEntry);
}
