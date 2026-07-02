"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HardHat, X } from "lucide-react";
import { navSections } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";
import { Select } from "@/components/ui/dialog";
import { type AppRole, appRoleLabel } from "@/lib/auth/roles";

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { role, setRole } = useAuth();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // Filter nav sections based on user role
  const filteredSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!item.requiredRoles) return true;
        return item.requiredRoles.includes(role);
      }),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div data-app-chrome>
      {/* mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <HardHat className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <div className="text-base font-bold tracking-tight text-white">SiteHub</div>
            <div className="text-[11px] text-sidebar-muted">Charu · Construction</div>
          </div>
          <button
            onClick={onClose}
            className="ml-auto rounded-md p-1 text-sidebar-muted hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {filteredSections.map((section) => (
            <div key={section.title}>
              <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
                {section.title}
              </div>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  const soon = !!item.phase;
                  return (
                    <li key={item.href}>
                      <Link
                        href={soon ? "#" : item.href}
                        onClick={(e) => {
                          if (soon) e.preventDefault();
                          else onClose();
                        }}
                        aria-disabled={soon}
                        className={cn(
                          "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          active
                            ? "bg-sidebar-accent text-white"
                            : "text-sidebar-foreground/90 hover:bg-sidebar-accent/60 hover:text-white",
                          soon && "cursor-not-allowed opacity-50 hover:bg-transparent"
                        )}
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0" />
                        <span className="truncate">{item.label}</span>
                        {soon && (
                          <span className="ml-auto rounded bg-sidebar-accent px-1.5 py-0.5 text-[9px] font-semibold uppercase text-sidebar-muted">
                            P{item.phase}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border px-4 py-3 space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
            Role
          </div>
          <Select
            value={role}
            onChange={(e) => setRole(e.target.value as AppRole)}
            className="h-8 text-xs bg-sidebar-accent border-sidebar-border text-white"
          >
            {(["admin", "supervisor", "viewer"] as AppRole[]).map((r) => (
              <option key={r} value={r}>{appRoleLabel[r]}</option>
            ))}
          </Select>
          <div className="text-[11px] text-sidebar-muted">
            v0.3 · SiteHub
          </div>
        </div>
      </aside>
    </div>
  );
}
