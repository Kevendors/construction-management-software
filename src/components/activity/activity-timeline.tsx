import {
  Wallet,
  ReceiptText,
  Users,
  HardHat,
  CalendarCheck,
  HandCoins,
  FileBadge,
  ShieldCheck,
  Activity as ActivityIcon,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ActivityEntry } from "@/lib/data/activity";

const ICONS: Record<string, LucideIcon> = {
  expense: Wallet,
  invoice: ReceiptText,
  employee: Users,
  contractor: HardHat,
  attendance: CalendarCheck,
  advance: HandCoins,
  salary_slip: FileBadge,
  member: ShieldCheck,
};

function initials(name: string | null) {
  if (!name) return "?";
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
}

function groupByDay(entries: ActivityEntry[]) {
  const groups: { day: string; label: string; entries: ActivityEntry[] }[] = [];
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  for (const e of entries) {
    const d = new Date(e.createdAt);
    const day = d.toDateString();
    const label =
      day === today ? "Today" : day === yesterday ? "Yesterday" : d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
    let g = groups.find((x) => x.day === day);
    if (!g) {
      g = { day, label, entries: [] };
      groups.push(g);
    }
    g.entries.push(e);
  }
  return groups;
}

export function ActivityTimeline({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <ActivityIcon className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No activity yet</p>
          <p className="text-sm text-muted-foreground">Actions across the workspace — expenses, invoices, payroll and more — will appear here.</p>
        </CardContent>
      </Card>
    );
  }

  const groups = groupByDay(entries);

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.day}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</p>
          <Card>
            <CardContent className="divide-y divide-border p-0">
              {g.entries.map((e) => {
                const Icon = ICONS[e.entityType] ?? ActivityIcon;
                const time = new Date(e.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
                return (
                  <div key={e.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm">{e.summary}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {e.actorName ? `${e.actorName} · ` : ""}{time}
                      </p>
                    </div>
                    {e.actorName && (
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                        {initials(e.actorName)}
                      </span>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}
