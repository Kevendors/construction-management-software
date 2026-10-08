"use client";

import { useEffect, useState, useTransition } from "react";
import {
  AlertCircle,
  BellRing,
  Laptop,
  Loader2,
  Send,
  Share2,
  Smartphone,
} from "lucide-react";
import {
  getVapidPublicKeyAction,
  savePushSubscriptionAction,
  sendTestPushNotificationAction,
} from "@/app/notifications/push-actions";

const DEFAULT_VAPID_PUBLIC_KEY =
  "BFaDSDfZ41GG4LuXI4Z-YgfWrJvfiVQSqjV35qxq_TlhP1JCi8DmJ6bM5k0_aY2kM6Zmm7wTaO3FQtbjYGZOjP8";

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

interface PushBannerProps {
  variant?: "dropdown" | "standalone";
}

export function PushBanner({ variant = "dropdown" }: PushBannerProps) {
  const [supported, setSupported] = useState(false);
  const [isIosNonPwa, setIsIosNonPwa] = useState(false);
  const [isInsecure, setIsInsecure] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!window.isSecureContext && window.location.hostname !== "localhost") {
      setIsInsecure(true);
    }

    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isIOS && !isStandalone) {
      setIsIosNonPwa(true);
    }

    const hasPush =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setSupported(hasPush);

    if (hasPush && "Notification" in window) {
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

  async function handleEnablePush() {
    startTransition(async () => {
      try {
        setStatusMsg(null);

        // Resilient public key resolution (Env -> Server action -> hardcoded default)
        let vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) {
          try {
            vapidPublicKey = await getVapidPublicKeyAction();
          } catch {
            vapidPublicKey = DEFAULT_VAPID_PUBLIC_KEY;
          }
        }
        if (!vapidPublicKey) {
          vapidPublicKey = DEFAULT_VAPID_PUBLIC_KEY;
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
            applicationServerKey: urlBase64ToUint8Array(
              vapidPublicKey
            ) as unknown as BufferSource,
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
          setStatusMsg("Device alerts activated! Click 'Test Alert' below.");
          setTimeout(() => setStatusMsg(null), 4000);
        } else {
          setStatusMsg(res.error || "Save error");
        }
      } catch (err) {
        console.error("Enable push error:", err);
        setStatusMsg(
          err instanceof Error ? err.message : "Failed to enable device alerts"
        );
      }
    });
  }

  async function handleSendTest() {
    startTransition(async () => {
      setStatusMsg("Sending test alert…");
      const res = await sendTestPushNotificationAction();
      if (res.success) {
        setStatusMsg("Alert sent! Check your screen popup.");
        setTimeout(() => setStatusMsg(null), 4000);
      } else {
        setStatusMsg(res.error || "Test failed");
      }
    });
  }

  // 1. Insecure HTTP Context
  if (isInsecure) {
    return (
      <div className="border-t border-border/80 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-snug">
            <strong>HTTPS required:</strong> Out-of-app device push alerts require a secure connection (HTTPS).
          </p>
        </div>
      </div>
    );
  }

  // 2. iOS Safari (Non-PWA) guidance
  if (isIosNonPwa) {
    return (
      <div className="border-t border-border/80 bg-accent/5 p-3 text-xs">
        <div className="flex items-start gap-2.5">
          <Smartphone className="h-4 w-4 shrink-0 text-accent mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-foreground">
              Mobile Alerts on iPhone / iPad
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              Apple requires SiteHub to be added to your Home Screen to deliver lock-screen push notifications.
            </p>
            <div className="mt-2 flex items-center gap-1.5 rounded-md bg-card border border-border/80 px-2.5 py-1.5 text-[11px] text-foreground">
              <Share2 className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span>Tap <strong>Share (⎋)</strong> in Safari &rarr; select <strong>Add to Home Screen</strong></span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Browser does not support Web Push
  if (!supported) {
    return (
      <div className="border-t border-border/80 bg-muted/30 p-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Laptop className="h-4 w-4 shrink-0" />
          <p className="text-[11px]">
            Device push notifications are not supported by this browser.
          </p>
        </div>
      </div>
    );
  }

  // 4. Notifications blocked in browser
  if (permission === "denied") {
    return (
      <div className="border-t border-border/80 bg-amber-500/10 p-3 text-xs">
        <div className="flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-foreground">
              Notifications Blocked in Browser
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              Notifications were blocked for this site. Click the lock/tune icon in your browser address bar and switch Notifications to &quot;Allow&quot;.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 5. Permission not yet granted or not subscribed
  if (permission !== "granted" || !isSubscribed) {
    return (
      <div className="border-t border-border/80 bg-accent/5 p-3 text-xs">
        <div className="flex items-start gap-2.5">
          <Laptop className="h-4 w-4 shrink-0 text-accent mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground">
              Out-of-App Device Notifications
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              Get instant pop-up alerts on your desktop or phone even when SiteHub is closed or in the background.
            </p>
            {statusMsg && (
              <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400 mt-1">
                {statusMsg}
              </p>
            )}
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={handleEnablePush}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[11px] font-semibold text-accent-foreground shadow-xs hover:bg-accent/90 disabled:opacity-50 cursor-pointer transition-colors"
              >
                {isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <BellRing className="h-3.5 w-3.5" />
                )}
                Enable Device Alerts
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 6. Active push subscription with test capability
  return (
    <div className="border-t border-border/80 bg-muted/40 px-3 py-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
          <span className="text-[11px] font-medium text-foreground/80 truncate">
            {statusMsg || "Device alerts active on this device"}
          </span>
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={handleSendTest}
          className="inline-flex items-center gap-1 shrink-0 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-secondary disabled:opacity-50 cursor-pointer transition-colors shadow-2xs"
          title="Send a test notification to verify out-of-app popups"
        >
          {isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Send className="h-3 w-3 text-muted-foreground" />
          )}
          Test Alert
        </button>
      </div>
    </div>
  );
}
