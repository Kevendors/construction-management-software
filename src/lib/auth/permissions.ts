import type { Role } from "@/lib/types";

/** A navigable area of the app. Maps 1:1 to a nav item / route group. */
export type ModuleKey =
  | "dashboard"
  | "analytics"
  | "projects"
  | "design"
  | "clients"
  | "quotations"
  | "invoices"
  | "material"
  | "subcon"
  | "payroll"
  | "expenses"
  | "equipment"
  | "team";

const ALL: ModuleKey[] = [
  "dashboard", "analytics", "projects", "design", "clients", "quotations",
  "invoices", "material", "subcon", "payroll", "expenses", "equipment", "team",
];

/**
 * Which modules each role may see. Single source of truth for nav filtering
 * and route guards. (DB-level RLS enforces the hard read/write boundary; this
 * drives the UI so users only see what applies to them.)
 */
export const ROLE_MODULES: Record<Role, ModuleKey[]> = {
  super_admin: ALL,
  pm: ["dashboard", "analytics", "projects", "design", "clients", "quotations", "invoices", "material", "subcon", "expenses", "equipment"],
  supervisor: ["projects", "expenses"], // site-only: projects (Updates/DPRs/Attendance live in the project) + petty expenses
  accountant: ["dashboard", "analytics", "clients", "quotations", "invoices", "expenses"],
  hr: ["dashboard", "payroll", "team"],
  staff: ["projects", "expenses"],
  architect: ["projects", "design"],
  engineer: ["projects", "expenses"],
  subcontractor: ["projects", "subcon"],
  viewer: ["dashboard", "projects"],
  client: ["dashboard", "projects"],
};

/** True if the role may access the module. Unknown/null role → deny. */
export function canAccess(role: Role | null | undefined, module: ModuleKey): boolean {
  if (!role) return false;
  return (ROLE_MODULES[role] ?? []).includes(module);
}

/** Canonical route for each module (used for redirects). */
export const MODULE_ROUTES: Record<ModuleKey, string> = {
  dashboard: "/",
  analytics: "/analytics",
  projects: "/projects",
  design: "/design",
  clients: "/clients",
  quotations: "/quotations",
  invoices: "/invoices",
  material: "/material",
  subcon: "/subcon",
  payroll: "/payroll",
  expenses: "/expenses",
  equipment: "/equipment",
  team: "/team",
};

/** Which module a pathname belongs to (null = unguarded route). */
export function pathModule(pathname: string): ModuleKey | null {
  if (pathname === "/") return "dashboard";
  const prefixes: [string, ModuleKey][] = [
    ["/analytics", "analytics"], ["/projects", "projects"], ["/design", "design"],
    ["/clients", "clients"], ["/quotations", "quotations"], ["/invoices", "invoices"],
    ["/material", "material"], ["/subcon", "subcon"], ["/payroll", "payroll"],
    ["/expenses", "expenses"], ["/equipment", "equipment"], ["/team", "team"],
  ];
  for (const [p, m] of prefixes) if (pathname === p || pathname.startsWith(p + "/")) return m;
  return null;
}

/** The landing route for a role — first module it can access (fallback "/"). */
export function landingPath(role: Role | null | undefined): string {
  const first = role ? (ROLE_MODULES[role] ?? [])[0] : undefined;
  return first ? MODULE_ROUTES[first] : "/";
}

/** Roles that can manage users/roles (the Team page + account creation). */
export function isAdminRole(role: Role | null | undefined): boolean {
  return role === "super_admin";
}
