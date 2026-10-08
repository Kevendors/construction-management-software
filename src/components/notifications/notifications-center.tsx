"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bell,
  CheckCheck,
  ClipboardCheck,
  AlertTriangle,
  ReceiptText,
  PackageX,
  Info,
  type LucideIcon,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppNotification, NotificationKind } from "@/lib/types";
import {
  getNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/notifications/actions";
import { PushBanner } from "./push-banner";

const ICON: Record<NotificationKind, { icon: LucideIcon; tint: string; label: string }> = {
  approval: { icon: ClipboardCheck, tint: "bg-chart-3/15 text-chart-3", label: "Approval" },
  delay: { icon: AlertTriangle, tint: "bg-destructive/15 text-destructive", label: "Delay" },
  payment: { icon: ReceiptText, tint: "bg-amber-500/15 text-amber-600 dark:text-amber-400", label: "Payment" },
  stock: { icon: PackageX, tint: "bg-destructive/15 text-destructive", label: "Stock" },
  info: { icon: Info, tint: "bg-primary/10 text-primary", label: "Info" },
};

function formatFullTime(isoString: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

interface NotificationsCenterProps {
  initialNotifications: AppNotification[];
}

export function NotificationsCenter({ initialNotifications }: NotificationsCenterProps) {
  const [items, setItems] = React.useState<AppNotification[]>(initialNotifications);
  const [filter, setFilter] = React.useState<"all" | "unread" | NotificationKind>("all");
  const [loading, setLoading] = React.useState(false);

  const unreadCount = items.filter((n) => !n.read).length;

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await getNotificationsAction();
      setItems(res.notifications);
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleMarkAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    await markAllNotificationsReadAction();
  }

  async function handleItemClick(n: AppNotification) {
    if (!n.read) {
      setItems((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
      );
      await markNotificationReadAction(n.id);
    }
  }

  const displayed = items.filter((n) => {
    if (filter === "all") return true;
    if (filter === "unread") return !n.read;
    return n.kind === filter;
  });

  return (
    <div className="space-y-6">
      {/* Device Notifications Settings Card */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="border-b border-border/80 px-4 py-3 bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Device & Pop-up Notifications</h2>
          </div>
          <span className="text-[11px] text-muted-foreground">Desktop & Mobile</span>
        </div>
        <PushBanner />
      </div>

      {/* Notifications Controls & List */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 px-4 py-3 bg-muted/20">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={() => setFilter("all")}
              className={cn(
                "rounded-md px-3 py-1 font-medium transition-colors cursor-pointer",
                filter === "all"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground"
              )}
            >
              All ({items.length})
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={cn(
                "rounded-md px-3 py-1 font-medium transition-colors cursor-pointer",
                filter === "unread"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground"
              )}
            >
              Unread ({unreadCount})
            </button>
            <button
              onClick={() => setFilter("approval")}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer",
                filter === "approval"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground"
              )}
            >
              Approvals
            </button>
            <button
              onClick={() => setFilter("payment")}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer",
                filter === "payment"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground"
              )}
            >
              Payments
            </button>
            <button
              onClick={() => setFilter("delay")}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer",
                filter === "delay"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground"
              )}
            >
              Delays
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              Refresh
            </button>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary/80 cursor-pointer"
              >
                <CheckCheck className="h-3.5 w-3.5 text-primary" />
                Mark all read
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <ul className="divide-y divide-border/60">
          {displayed.length === 0 ? (
            <li className="py-16 text-center">
              <Bell className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                No notifications found in this view.
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                You&apos;re completely up to date!
              </p>
            </li>
          ) : (
            displayed.map((n) => {
              const info = ICON[n.kind] ?? ICON.info;
              const Icon = info.icon;

              const content = (
                <div
                  className={cn(
                    "flex items-start gap-4 p-4 transition-colors hover:bg-secondary/40",
                    !n.read && "bg-secondary/20"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                      info.tint
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {n.title}
                        </span>
                        {!n.read && (
                          <span className="h-2 w-2 rounded-full bg-accent" />
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {formatFullTime(n.date)}
                      </span>
                    </div>

                    {n.body && (
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        {n.body}
                      </p>
                    )}

                    <div className="mt-2 flex items-center gap-2">
                      <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {info.label}
                      </span>
                      {n.href && (
                        <span className="text-[11px] font-medium text-primary hover:underline">
                          View details &rarr;
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );

              return (
                <li key={n.id}>
                  {n.href ? (
                    <Link
                      href={n.href}
                      onClick={() => handleItemClick(n)}
                      className="block focus-visible:outline-none focus-visible:bg-secondary/60"
                    >
                      {content}
                    </Link>
                  ) : (
                    <div
                      onClick={() => handleItemClick(n)}
                      className="cursor-pointer"
                      role="button"
                      tabIndex={0}
                    >
                      {content}
                    </div>
                  )}
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
