"use client";

import * as React from "react";
import { LogOut, ChevronDown } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { signOutAction } from "@/app/login/actions";
import { roleLabel } from "@/lib/labels";
import { useRole } from "./role-provider";

function initialsFrom(name: string) {
  const p = name.trim().split(/\s+/);
  return (((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || name.slice(0, 2).toUpperCase() || "U");
}

const supaConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

export function AccountMenu() {
  const [open, setOpen] = React.useState(false);
  const { name, email, role, loading } = useRole();
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  if (loading || !name) return <div className="h-9 w-28" aria-hidden />;

  const sub = (role && roleLabel[role]) || email;
  const initials = initialsFrom(name);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 hover:bg-secondary"
      >
        <Avatar initials={initials} color="#1e3a5f" />
        <div className="hidden text-left leading-tight sm:block">
          <div className="text-sm font-medium">{name}</div>
          <div className="max-w-[160px] truncate text-[11px] text-muted-foreground">{sub}</div>
        </div>
        {supaConfigured && <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />}
      </button>

      {open && supaConfigured && (
        <div className="absolute right-0 top-full z-30 mt-2 w-52 rounded-lg border border-border bg-card p-1 shadow-lg">
          <div className="border-b border-border px-3 py-2">
            <p className="text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
            {role && <p className="mt-0.5 text-[11px] font-medium text-primary">{roleLabel[role] ?? role}</p>}
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-secondary"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
