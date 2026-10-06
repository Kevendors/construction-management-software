import "server-only";

import { getAuthContext } from "@/lib/auth/context";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { notifications as mockNotifications } from "@/lib/mock/data";
import type { AppNotification, NotificationKind } from "@/lib/types";

export interface NotificationsPayload {
  notifications: AppNotification[];
  unreadCount: number;
}

export async function getNotifications(limit = 40): Promise<NotificationsPayload> {
  if (!isSupabaseConfigured()) {
    const unread = mockNotifications.filter((n) => !n.read).length;
    return {
      notifications: mockNotifications,
      unreadCount: unread,
    };
  }

  const ctx = await getAuthContext();
  if (!ctx?.orgId || !ctx?.userId) {
    return { notifications: [], unreadCount: 0 };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, title, body, href, read, created_at")
    .eq("org_id", ctx.orgId)
    .or(`user_id.eq.${ctx.userId},user_id.is.null`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[notifications] fetch error:", error.message);
    return { notifications: [], unreadCount: 0 };
  }

  const notifications: AppNotification[] = (data ?? []).map((row) => ({
    id: row.id,
    kind: (row.kind as NotificationKind) || "info",
    title: row.title,
    body: row.body || "",
    date: row.created_at,
    read: Boolean(row.read),
    href: row.href || undefined,
  }));

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount };
}
