"use client";

import * as React from "react";
import { LogOut, ChevronDown } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { signOutAction } from "@/app/login/actions";
import { currentUser } from "@/lib/mock/data";
import { roleLabel } from "@/lib/labels";

interface Account {
  name: string;
  sub: string;
  initials: string;
  color: string;
}

function initialsFrom(name: string) {
  const p = name.trim().split(/\s+/);
  return (((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || name.slice(0, 2).toUpperCase() || "U");
}

const supaConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

export function AccountMenu() {
  const [open, setOpen] = React.useState(false);
  const [acct, setAcct] = React.useState<Account | null>(
    supaConfigured
      ? null
      : {
          name: currentUser.name,
          sub: roleLabel[currentUser.role],
          initials: currentUser.initials,
          color: currentUser.avatarColor,
        }
  );
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!supaConfigured) return;
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        const u = data.user;
        if (!u) return;
        const name =
          (u.user_metadata?.name as string | undefined) || u.email?.split("@")[0] || "User";
        setAcct({ name, sub: u.email ?? "", initials: initialsFrom(name), color: "#1e3a5f" });
      });
  }, []);

  React.useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  if (!acct) return <div className="h-9 w-28" aria-hidden />;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 hover:bg-secondary"
      >
        <Avatar initials={acct.initials} color={acct.color} />
        <div className="hidden text-left leading-tight sm:block">
          <div className="text-sm font-medium">{acct.name}</div>
          <div className="max-w-[160px] truncate text-[11px] text-muted-foreground">{acct.sub}</div>
        </div>
        {supaConfigured && <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />}
      </button>

      {open && supaConfigured && (
        <div className="absolute right-0 top-full z-30 mt-2 w-48 rounded-lg border border-border bg-card p-1 shadow-lg">
          <div className="border-b border-border px-3 py-2 sm:hidden">
            <p className="text-sm font-medium">{acct.name}</p>
            <p className="truncate text-xs text-muted-foreground">{acct.sub}</p>
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
