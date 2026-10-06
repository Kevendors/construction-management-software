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
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppNotification, NotificationKind } from "@/lib/types";
import {
  getNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/notifications/actions";

const ICON: Record<NotificationKind, { icon: LucideIcon; tint: string }> = {
  approval: { icon: ClipboardCheck, tint: "bg-chart-3/15 text-chart-3" },
  delay: { icon: AlertTriangle, tint: "bg-destructive/15 text-destructive" },
  payment: { icon: ReceiptText, tint: "bg-accent/20 text-amber-700 dark:text-amber-400" },
  stock: { icon: PackageX, tint: "bg-destructive/15 text-destructive" },
  info: { icon: Info, tint: "bg-primary/10 text-primary" },
};

function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  if (diffMs < 0) return "Just now";
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(
    new Date(isoString)
  );
}

export function Notifications() {
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<AppNotification[]>([]);
  const [filter, setFilter] = React.useState<"all" | "unread">("all");
  const [loading, setLoading] = React.useState(true);
  const ref = React.useRef<HTMLDivElement>(null);

  const unreadCount = items.filter((n) => !n.read).length;

  const refreshNotifications = React.useCallback(async () => {
    try {
      const res = await getNotificationsAction();
      setItems(res.notifications);
    } catch (e) {
      console.error("[notifications] refresh failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  React.useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  // Periodic polling every 30s when tab is visible
  React.useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshNotifications();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [refreshNotifications]);

  // Close dropdown on outside click
  React.useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", onMouseDown);
      return () => document.removeEventListener("mousedown", onMouseDown);
    }
  }, [open]);

  async function handleMarkAllRead() {
    // Optimistic update
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    await markAllNotificationsReadAction();
  }

  async function handleItemClick(n: AppNotification) {
    if (!n.read) {
      // Optimistic update
      setItems((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
      );
      markNotificationReadAction(n.id);
    }
    setOpen(false);
  }

  const displayed = filter === "unread" ? items.filter((n) => !n.read) : items;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md p-2 text-muted-foreground hover:bg-secondary focus-visible:outline-none"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white animate-in zoom-in-50">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-84 sm:w-96 overflow-hidden rounded-xl border border-border bg-popover shadow-xl animate-in fade-in-50 zoom-in-95">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-card/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex border-b border-border/60 bg-muted/30 px-3 py-1.5 gap-1.5 text-xs">
            <button
              onClick={() => setFilter("all")}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors",
                filter === "all"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              All ({items.length})
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors",
                filter === "unread"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Notifications List */}
          <ul className="max-h-[26rem] divide-y divide-border/50 overflow-y-auto">
            {displayed.length === 0 ? (
              <li className="py-10 text-center">
                <Bell className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm font-medium text-muted-foreground">
                  {loading
                    ? "Loading notifications…"
                    : filter === "unread"
                    ? "No unread notifications"
                    : "No notifications yet"}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">
                  You&apos;re completely up to date!
                </p>
              </li>
            ) : (
              displayed.map((n) => {
                const { icon: Icon, tint } = ICON[n.kind] ?? ICON.info;
                const content = (
                  <div
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 transition-colors hover:bg-secondary/60",
                      !n.read && "bg-secondary/30"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        tint
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn("text-sm", !n.read ? "font-semibold text-foreground" : "font-medium text-foreground/90")}>
                          {n.title}
                        </p>
                        {!n.read && (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" />
                        )}
                      </div>
                      {n.body && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                          {n.body}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-muted-foreground/80">
                        {formatRelativeTime(n.date)}
                      </p>
                    </div>
                  </div>
                );

                return (
                  <li key={n.id}>
                    {n.href ? (
                      <Link
                        href={n.href}
                        onClick={() => handleItemClick(n)}
                        className="block focus-visible:outline-none focus-visible:bg-secondary"
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
      )}
    </div>
  );
}
