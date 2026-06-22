"use client";

import { Menu } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Notifications } from "./notifications";
import { GlobalSearch } from "./global-search";
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

      <GlobalSearch />

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
