import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { sendWebPushBatch } from "@/lib/notifications/web-push";
import type { NotificationKind, Role } from "@/lib/types";

export interface DispatchNotificationInput {
  orgId?: string | null;
  /** Specific user IDs to receive this notification. */
  userIds?: string[];
  /** Roles to receive this notification (e.g. ['super_admin', 'accountant']). */
  roles?: Role[];
  /** If provided, exclude this user (e.g. don't notify the actor who triggered the event). */
  excludeUserId?: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  href?: string;
}

/**
 * Dispatch an in-app notification to specific users, specific roles, or org-wide.
 * Always best-effort: never throws so notification failure never breaks the
 * calling action or transaction.
 */
export async function dispatchNotification(
  input: DispatchNotificationInput
): Promise<void> {
  if (!input.orgId || !isSupabaseConfigured()) return;
  const orgId = input.orgId;

  try {
    const admin = createAdminClient();
    const recipientIds = new Set<string>();

    if (input.userIds?.length) {
      for (const id of input.userIds) {
        if (id && id !== input.excludeUserId) recipientIds.add(id);
      }
    }

    if (input.roles?.length) {
      const { data: members, error } = await admin
        .from("memberships")
        .select("user_id")
        .eq("org_id", orgId)
        .in("role", input.roles)
        .eq("is_active", true);

      if (!error && members) {
        for (const m of members) {
          if (m.user_id && m.user_id !== input.excludeUserId) {
            recipientIds.add(m.user_id);
          }
        }
      }
    }

    // If recipients were targeted, insert one row per recipient
    if (recipientIds.size > 0) {
      const recipientList = Array.from(recipientIds);
      const rows = recipientList.map((userId) => ({
        org_id: orgId,
        user_id: userId,
        kind: input.kind,
        title: input.title,
        body: input.body ?? null,
        href: input.href ?? null,
        read: false,
      }));

      const { error: insError } = await admin.from("notifications").insert(rows);
      if (insError) {
        console.error("[notifications] dispatch insert failed", insError.message);
      }

      // Also dispatch out-of-app Web Push to active device subscriptions
      try {
        const { data: subs } = await admin
          .from("push_subscriptions")
          .select("id, endpoint, p256dh, auth")
          .eq("org_id", orgId)
          .in("user_id", recipientList);

        if (subs && subs.length > 0) {
          sendWebPushBatch(subs, {
            title: input.title,
            body: input.body,
            href: input.href,
            tag: `${input.kind}-${Date.now()}`,
          }).catch((e) => console.warn("[notifications] web push delivery error:", e));
        }
      } catch (pushErr) {
        console.warn("[notifications] web push lookup error:", pushErr);
      }

      return;
    }

    // If neither userIds nor roles were provided, insert an org broadcast (user_id = null)
    if (!input.userIds && !input.roles) {
      const { error: insError } = await admin.from("notifications").insert({
        org_id: orgId,
        user_id: null,
        kind: input.kind,
        title: input.title,
        body: input.body ?? null,
        href: input.href ?? null,
        read: false,
      });
      if (insError) {
        console.error("[notifications] broadcast insert failed", insError.message);
      }

      // Dispatch Web Push to all org devices
      try {
        const { data: subs } = await admin
          .from("push_subscriptions")
          .select("id, endpoint, p256dh, auth, user_id")
          .eq("org_id", orgId);

        if (subs && subs.length > 0) {
          const targets = input.excludeUserId
            ? subs.filter((s: { user_id: string }) => s.user_id !== input.excludeUserId)
            : subs;

          if (targets.length > 0) {
            sendWebPushBatch(targets, {
              title: input.title,
              body: input.body,
              href: input.href,
              tag: `${input.kind}-${Date.now()}`,
            }).catch((e) => console.warn("[notifications] web push delivery error:", e));
          }
        }
      } catch (pushErr) {
        console.warn("[notifications] web push lookup error:", pushErr);
      }
    }
  } catch (err) {
    console.error(
      "[notifications] dispatch failed",
      err instanceof Error ? err.message : err
    );
  }
}
