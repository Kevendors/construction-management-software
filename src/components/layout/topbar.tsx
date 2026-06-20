"use client";

import { Menu, Search } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Notifications } from "./notifications";
import { currentUser } from "@/lib/mock/data";
import { roleLabel } from "@/lib/labels";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  return (
    <header
      data-app-chrome
      className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur lg:px-6"
    >
      <button
        onClick={onMenu}
        className="rounded-md p-2 text-muted-foreground hover:bg-secondary lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="relative hidden max-w-sm flex-1 sm:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Search projects, clients, drawings…"
          className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Notifications />
        <div className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 hover:bg-secondary">
          <Avatar initials={currentUser.initials} color={currentUser.avatarColor} />
          <div className="hidden leading-tight sm:block">
            <div className="text-sm font-medium">{currentUser.name}</div>
            <div className="text-[11px] text-muted-foreground">
              {roleLabel[currentUser.role]}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
