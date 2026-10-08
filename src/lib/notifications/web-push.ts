import "server-only";

import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

export const DEFAULT_VAPID_PUBLIC_KEY =
  "BFaDSDfZ41GG4LuXI4Z-YgfWrJvfiVQSqjV35qxq_TlhP1JCi8DmJ6bM5k0_aY2kM6Zmm7wTaO3FQtbjYGZOjP8";
export const DEFAULT_VAPID_PRIVATE_KEY =
  "gjSaH1arwhPXU9b9P4nYYGbXBWzLC7AzAXT6m0HeVUg";
export const DEFAULT_VAPID_SUBJECT = "mailto:support@keyvendors.com";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY || DEFAULT_VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || DEFAULT_VAPID_SUBJECT;

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
