"use server";

import { getAuthContext } from "@/lib/auth/context";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isWebPushConfigured,
  sendWebPushBatch,
  type PushSubscriptionRecord,
} from "@/lib/notifications/web-push";

export interface SaveSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}

export async function savePushSubscriptionAction(
  input: SaveSubscriptionInput
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: true };
  }

  const ctx = await getAuthContext();
  if (!ctx?.userId || !ctx?.orgId) {
    return { success: false, error: "You must be signed in to enable notifications." };
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("push_subscriptions").upsert(
      {
        user_id: ctx.userId,
        org_id: ctx.orgId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        user_agent: input.userAgent ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );

    if (error) {
      if (error.code === "PGRST205" || error.message.includes("push_subscriptions")) {
        return {
          success: false,
          error: "Push table pending: Run 0033_push_subscriptions.sql in Supabase SQL Editor.",
        };
      }
      console.warn("[push-actions] Failed to save push subscription:", error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.warn("[push-actions] Error saving push subscription:", err);
    return { success: false, error: "Database error" };
  }
}

export async function deletePushSubscriptionAction(
  endpoint: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: true };
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", endpoint);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: "Database error" };
  }
}

/**
 * Send an immediate test notification to the current user's devices.
 */
export async function sendTestPushNotificationAction(): Promise<{
  success: boolean;
  count: number;
  error?: string;
}> {
  if (!isWebPushConfigured()) {
    return { success: false, count: 0, error: "Web Push VAPID keys are not configured on the server." };
  }

  const ctx = await getAuthContext();
  if (!ctx?.userId || !ctx?.orgId) {
    return { success: false, count: 0, error: "Not signed in" };
  }

  try {
    const admin = createAdminClient();
    const { data: subs, error } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", ctx.userId);

    if (error) {
      if (error.code === "PGRST205" || error.message.includes("push_subscriptions")) {
        return {
          success: false,
          count: 0,
          error: "Push table pending: Run 0033_push_subscriptions.sql in Supabase SQL Editor.",
        };
      }
      return { success: false, count: 0, error: error.message };
    }

    if (!subs || subs.length === 0) {
      return {
        success: false,
        count: 0,
        error: "No active device subscriptions found. Please enable browser notifications first.",
      };
    }

    const records: PushSubscriptionRecord[] = subs.map((s) => ({
      id: s.id,
      endpoint: s.endpoint,
      p256dh: s.p256dh,
      auth: s.auth,
    }));

    await sendWebPushBatch(records, {
      title: "SiteHub Alert Test 🔔",
      body: "Desktop and mobile out-of-app notifications are active for your account!",
      href: "/notifications",
    });

    return { success: true, count: records.length };
  } catch (err) {
    return {
      success: false,
      count: 0,
      error: err instanceof Error ? err.message : "Failed to send test push",
    };
  }
}
