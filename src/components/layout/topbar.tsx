"use client";

import { Menu } from "lucide-react";
import { Notifications } from "./notifications";
import { GlobalSearch } from "./global-search";
import { AccountMenu } from "./account-menu";

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
        <AccountMenu />
      </div>
    </header>
  );
}
