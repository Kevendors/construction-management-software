"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HardHat, X } from "lucide-react";
import { navSections } from "@/lib/nav";
import { canAccess, canReachMaterial } from "@/lib/auth/permissions";
import { useRole } from "./role-provider";
import { cn } from "@/lib/utils";

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { role, loading, canViewPurchaseOrders } = useRole();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // Show only the modules this role may access (empty sections drop out).
  // Material also appears for users with an explicit Purchase Orders grant.
  const canSee = (module: (typeof navSections)[number]["items"][number]["module"]) =>
    module === "material"
      ? canReachMaterial(role, canViewPurchaseOrders)
      : canAccess(role, module);
  const sections = loading
    ? []
    : navSections
        .map((s) => ({ ...s, items: s.items.filter((i) => canSee(i.module)) }))
        .filter((s) => s.items.length > 0);

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
            <div className="text-[11px] text-sidebar-muted">By KeyVendors</div>
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
          {sections.map((section) => (
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

        <div className="border-t border-sidebar-border px-5 py-3 text-[11px] text-sidebar-muted">
          v0.3 · live
        </div>
      </aside>
    </div>
  );
}
