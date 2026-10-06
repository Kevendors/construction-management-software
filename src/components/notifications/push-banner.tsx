"use client";

import { useEffect, useState, useTransition } from "react";
import { BellRing, Check, Laptop, Loader2, Send } from "lucide-react";
import {
  savePushSubscriptionAction,
  sendTestPushNotificationAction,
} from "@/app/notifications/push-actions";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushBanner() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    ) {
      setSupported(true);
      setPermission(Notification.permission);

      // Check existing subscription
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => {
          if (sub) setIsSubscribed(true);
        })
        .catch(() => {});
    }
  }, []);

  if (!supported) return null;

  async function handleEnablePush() {
    startTransition(async () => {
      try {
        setStatusMsg(null);
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) {
          setStatusMsg("Push key missing");
          return;
        }

        const perm = await Notification.requestPermission();
        setPermission(perm);
        if (perm !== "granted") {
          setStatusMsg("Permission denied in browser");
          return;
        }

        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource,
          });
        }

        const json = sub.toJSON();
        if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
          setStatusMsg("Failed to generate device key");
          return;
        }

        const res = await savePushSubscriptionAction({
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          userAgent: navigator.userAgent,
        });

        if (res.success) {
          setIsSubscribed(true);
          setStatusMsg("Desktop alerts activated!");
          setTimeout(() => setStatusMsg(null), 3500);
        } else {
          setStatusMsg(res.error || "Save error");
        }
      } catch (err) {
        console.error("Enable push error:", err);
        setStatusMsg("Failed to enable push");
      }
    });
  }

  async function handleSendTest() {
    startTransition(async () => {
      setStatusMsg("Sending test alert…");
      const res = await sendTestPushNotificationAction();
      if (res.success) {
        setStatusMsg("Alert sent! Check your screen.");
        setTimeout(() => setStatusMsg(null), 4000);
      } else {
        setStatusMsg(res.error || "Test failed");
      }
    });
  }

  // State 1: Permission not yet granted
  if (permission !== "granted" || !isSubscribed) {
    return (
      <div className="border-t border-border/80 bg-accent/5 p-3 text-xs">
        <div className="flex items-start gap-2.5">
          <Laptop className="h-4 w-4 shrink-0 text-accent mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-foreground">
              Out-of-App Device Notifications
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              Get pop-up alerts on your desktop or phone even when SiteHub is minimized or closed.
            </p>
            {statusMsg && (
              <p className="text-[11px] font-medium text-amber-500 mt-1">{statusMsg}</p>
            )}
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={handleEnablePush}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-foreground shadow-xs hover:bg-accent/90 disabled:opacity-50 cursor-pointer"
              >
                {isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <BellRing className="h-3 w-3" />
                )}
                Enable Device Alerts
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // State 2: Active push subscription with test capability
  return (
    <div className="border-t border-border/80 bg-muted/40 px-3 py-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
          <span className="text-[11px] font-medium text-muted-foreground truncate">
            {statusMsg || "Device alerts active on this browser"}
          </span>
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={handleSendTest}
          className="inline-flex items-center gap-1 shrink-0 rounded border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-secondary disabled:opacity-50 cursor-pointer"
          title="Send a test notification to test out-of-app popups"
        >
          {isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Send className="h-2.5 w-2.5 text-muted-foreground" />
          )}
          Test Alert
        </button>
      </div>
    </div>
  );
}
