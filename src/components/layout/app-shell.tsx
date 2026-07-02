"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { RoleProvider } from "./role-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Auth screens render full-bleed, without the app chrome.
  if (pathname === "/login" || pathname === "/reset-password") return <>{children}</>;

  return (
    <RoleProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar open={open} onClose={() => setOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onMenu={() => setOpen(true)} />
          <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
        </div>
      </div>
    </RoleProvider>
  );
}
