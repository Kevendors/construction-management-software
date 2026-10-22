"use client";

import * as React from "react";
import { Search } from "lucide-react";
import type { MasterItem } from "@/lib/quotation/item-master";

/**
 * Search-to-pick item master control. A plain <select> can't usefully show
 * longer entries (multi-line methodology descriptions, saved custom items,
 * etc.) — long text wraps badly/truncates in native <option>s and there's no
 * way to search by keyword, so anything longer than a short material name
 * was effectively unfindable once saved. This replaces it with a text search
 * over name/category and a result list that can wrap full descriptions.
 */
export function ItemMasterPicker({
  items,
  onPick,
  className = "",
}: {
  items: MasterItem[];
  onPick: (id: string) => void;
  className?: string;
}) {
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const term = q.trim().toLowerCase();
  const results = (
    term
      ? items.filter((i) => i.name.toLowerCase().includes(term) || i.category.toLowerCase().includes(term))
      : items
  ).slice(0, 30);

  function pick(id: string) {
    onPick(id);
    setQ("");
    setOpen(false);
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="+ Add from item master…"
          className="h-8 w-full rounded-md border border-input bg-background pl-7 pr-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 w-80 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-lg">
          {results.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              No matches{term ? ` for "${q.trim()}"` : ""}.
            </p>
          ) : (
            results.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => pick(i.id)}
                className="block w-full rounded-md px-2.5 py-1.5 text-left text-xs hover:bg-secondary"
              >
                <span className="line-clamp-2 whitespace-pre-line">{i.name}</span>
                <span className="mt-0.5 block text-[10px] text-muted-foreground">
                  {i.category} · {i.unit}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
