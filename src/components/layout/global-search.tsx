"use client";

import * as React from "react";
import Link from "next/link";
import { Search, FolderKanban, Users, PencilRuler } from "lucide-react";
import { clients, drawings, projects as seedProjects } from "@/lib/mock/data";
import type { Project } from "@/lib/types";

const LS_KEY = "sitehub:store:v1";

function readAddedProjects(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { projects?: Project[] };
    return parsed.projects ?? [];
  } catch {
    return [];
  }
}

interface Result {
  id: string;
  label: string;
  sub: string;
  href: string;
  group: "Projects" | "Clients" | "Drawings";
}

const groupIcon = {
  Projects: FolderKanban,
  Clients: Users,
  Drawings: PencilRuler,
} as const;

const PER_GROUP = 5;

export function GlobalSearch() {
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [added, setAdded] = React.useState<Project[]>([]);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Refresh user-created projects from storage whenever the box is focused.
  function refreshAdded() {
    setAdded(readAddedProjects());
  }

  const results = React.useMemo<Result[]>(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const out: Result[] = [];

    const allProjects = [...seedProjects, ...added];
    const seen = new Set<string>();
    for (const p of allProjects) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      if ([p.name, p.code, p.location].some((s) => s.toLowerCase().includes(term))) {
        out.push({
          id: p.id,
          label: p.name,
          sub: `${p.code} · ${p.location}`,
          href: `/projects/${p.id}`,
          group: "Projects",
        });
      }
    }

    for (const c of clients) {
      if ([c.name, c.company, c.email].some((s) => s.toLowerCase().includes(term))) {
        out.push({
          id: c.id,
          label: c.company,
          sub: c.name,
          href: `/clients/${c.id}`,
          group: "Clients",
        });
      }
    }

    for (const d of drawings) {
      if ([d.title, d.discipline, d.currentRev].some((s) => s.toLowerCase().includes(term))) {
        out.push({
          id: d.id,
          label: d.title,
          sub: `${d.discipline} · rev ${d.currentRev}`,
          href: `/design`,
          group: "Drawings",
        });
      }
    }

    return out;
  }, [q, added]);

  const groups = (["Projects", "Clients", "Drawings"] as const)
    .map((g) => ({ group: g, items: results.filter((r) => r.group === g).slice(0, PER_GROUP) }))
    .filter((g) => g.items.length > 0);

  const showPanel = open && q.trim().length > 0;

  function close() {
    setOpen(false);
    setQ("");
  }

  return (
    <div ref={ref} className="relative hidden max-w-sm flex-1 sm:block">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          refreshAdded();
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
        }}
        placeholder="Search projects, clients, drawings…"
        className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      {showPanel && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[70vh] overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-lg">
          {groups.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No matches for “{q.trim()}”.
            </p>
          ) : (
            groups.map(({ group, items }) => {
              const Icon = groupIcon[group];
              return (
                <div key={group} className="py-1">
                  <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {group}
                  </p>
                  {items.map((r) => (
                    <Link
                      key={`${group}-${r.id}`}
                      href={r.href}
                      onClick={close}
                      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-secondary"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{r.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">{r.sub}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
