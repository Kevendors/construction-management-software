"use client";

import {
  CheckSquare,
  FileText,
  ClipboardList,
  Receipt,
  AlertTriangle,
  Users,
  CreditCard,
  Activity,
  type LucideIcon,
} from "lucide-react";
import type { ActivityLogEntry } from "@/lib/types";

const ENTITY_ICON: Record<ActivityLogEntry["entity"], LucideIcon> = {
  task: CheckSquare,
  expense: Receipt,
  invoice: FileText,
  dpr: ClipboardList,
  instruction: AlertTriangle,
  transaction: CreditCard,
  attendance: Users,
  payment: CreditCard,
  project: Activity,
};

const ENTITY_COLOR: Record<ActivityLogEntry["entity"], string> = {
  task: "text-blue-500",
  expense: "text-amber-500",
  invoice: "text-emerald-500",
  dpr: "text-indigo-500",
  instruction: "text-red-500",
  transaction: "text-violet-500",
  attendance: "text-cyan-500",
  payment: "text-green-500",
  project: "text-primary",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function ActivityTimeline({ entries }: { entries: ActivityLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No activity yet. Actions like adding tasks, expenses, and DPRs will appear here.
      </p>
    );
  }

  return (
    <div className="relative space-y-0">
      <div className="absolute left-3.5 top-2 bottom-2 w-px bg-border" />
      {entries.map((entry) => {
        const Icon = ENTITY_ICON[entry.entity];
        const color = ENTITY_COLOR[entry.entity];
        return (
          <div key={entry.id} className="relative flex gap-3 py-2">
            <div className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card ${color}`}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm">{entry.details}</p>
              <p className="text-xs text-muted-foreground">{timeAgo(entry.timestamp)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
