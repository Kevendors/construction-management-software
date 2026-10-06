"use server";

import { getAuthContext } from "@/lib/auth/context";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getNotifications, type NotificationsPayload } from "@/lib/data/notifications";

export async function getNotificationsAction(): Promise<NotificationsPayload> {
  return getNotifications();
}

export async function markNotificationReadAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { success: true };

  const ctx = await getAuthContext();
  if (!ctx?.orgId || !ctx?.userId) return { success: false, error: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", id)
    .eq("org_id", ctx.orgId);

  if (error) {
    console.error("[notifications] mark read error:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function markAllNotificationsReadAction(): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!isSupabaseConfigured()) return { success: true };

  const ctx = await getAuthContext();
  if (!ctx?.orgId || !ctx?.userId) return { success: false, error: "Not signed in" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("org_id", ctx.orgId)
    .or(`user_id.eq.${ctx.userId},user_id.is.null`)
    .eq("read", false);

  if (error) {
    console.error("[notifications] mark all read error:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true };
}
