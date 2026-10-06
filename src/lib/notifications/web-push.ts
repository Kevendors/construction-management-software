import "server-only";

import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || "mailto:support@keyvendors.com";

let isConfigured = false;

if (publicKey && privateKey) {
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    isConfigured = true;
  } catch (err) {
    console.error("[web-push] Failed to set VAPID details:", err);
  }
}

export function isWebPushConfigured(): boolean {
  return isConfigured;
}

export interface PushSubscriptionRecord {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface WebPushPayload {
  title: string;
  body?: string;
  href?: string;
  tag?: string;
}

/**
 * Dispatch web push notifications to multiple subscriptions in parallel.
 * Automatically purges subscriptions that have expired (HTTP 404 or 410).
 * Never throws: best-effort delivery.
 */
export async function sendWebPushBatch(
  subscriptions: PushSubscriptionRecord[],
  payload: WebPushPayload
): Promise<void> {
  if (!isConfigured || subscriptions.length === 0) return;

  const bodyJson = JSON.stringify({
    title: payload.title,
    body: payload.body || "",
    href: payload.href || "/",
    tag: payload.tag || "sitehub-" + Date.now(),
  });

  const expiredIds: string[] = [];

  const sendPromises = subscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        bodyJson,
        {
          urgency: "high",
          TTL: 60 * 60 * 24, // 24 hours
        }
      );
    } catch (err: unknown) {
      const errorWithStatus = err as { statusCode?: number };
      if (errorWithStatus?.statusCode === 404 || errorWithStatus?.statusCode === 410) {
        expiredIds.push(sub.id);
      } else {
        console.warn("[web-push] Failed to deliver to endpoint:", sub.endpoint, err);
      }
    }
  });

  await Promise.allSettled(sendPromises);

  // Clean up stale or expired subscriptions if any
  if (expiredIds.length > 0) {
    try {
      const admin = createAdminClient();
      await admin.from("push_subscriptions").delete().in("id", expiredIds);
    } catch (err) {
      console.warn("[web-push] Failed to delete expired subscriptions:", err);
    }
  }
}
