"use client";

import { useState } from "react";
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
import { notifications as seed } from "@/lib/mock/data";
import { cn } from "@/lib/utils";
import type { NotificationKind } from "@/lib/types";

const ICON: Record<NotificationKind, { icon: LucideIcon; tint: string }> = {
  approval: { icon: ClipboardCheck, tint: "bg-chart-3/15 text-chart-3" },
  delay: { icon: AlertTriangle, tint: "bg-destructive/15 text-destructive" },
  payment: { icon: ReceiptText, tint: "bg-accent/20 text-amber-700 dark:text-amber-400" },
  stock: { icon: PackageX, tint: "bg-destructive/15 text-destructive" },
  info: { icon: Info, tint: "bg-primary/10 text-primary" },
};

export function Notifications() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(seed);
  const unread = items.filter((n) => !n.read).length;

  const markAllRead = () => setItems((prev) => prev.map((n) => ({ ...n, read: true })));

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md p-2 text-muted-foreground hover:bg-secondary"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <p className="text-sm font-semibold">Notifications</p>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                </button>
              )}
            </div>
            <ul className="max-h-96 divide-y divide-border/60 overflow-y-auto">
              {items.map((n) => {
                const { icon: Icon, tint } = ICON[n.kind];
                const body = (
                  <div className={cn("flex gap-3 px-4 py-3", !n.read && "bg-secondary/40")}>
                    <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", tint)}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-xs text-muted-foreground">{n.body}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {new Date(n.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                      </p>
                    </div>
                    {!n.read && <span className="ml-auto mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" />}
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.href ? (
                      <Link href={n.href} onClick={() => setOpen(false)} className="block hover:bg-secondary/60">
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
