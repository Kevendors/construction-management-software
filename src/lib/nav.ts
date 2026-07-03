import {
  LayoutDashboard,
  LineChart,
  FolderKanban,
  Users,
  PencilRuler,
  FileText,
  ReceiptText,
  Boxes,
  HardHat,
  Wallet,
  Receipt,
  Wrench,
  ShieldCheck,
  History,
  type LucideIcon,
} from "lucide-react";
import type { ModuleKey } from "@/lib/auth/permissions";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  module: ModuleKey; // gates visibility by role
  phase?: number; // modules not yet built show a "soon" tag
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Company Dashboard", href: "/", icon: LayoutDashboard, module: "dashboard" },
      { label: "Analytics", href: "/analytics", icon: LineChart, module: "analytics" },
    ],
  },
  {
    title: "Delivery",
    items: [
      { label: "Projects", href: "/projects", icon: FolderKanban, module: "projects" },
      { label: "Design Management", href: "/design", icon: PencilRuler, module: "design" },
    ],
  },
  {
    title: "Commercial",
    items: [
      { label: "Clients / CRM", href: "/clients", icon: Users, module: "clients" },
      { label: "Quotations", href: "/quotations", icon: FileText, module: "quotations" },
      { label: "Sales Invoices", href: "/invoices", icon: ReceiptText, module: "invoices" },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Material", href: "/material", icon: Boxes, module: "material" },
      { label: "Subcontractor", href: "/subcon", icon: HardHat, module: "subcon" },
      { label: "Payroll & Attendance", href: "/payroll", icon: Wallet, module: "payroll" },
      { label: "Petty Expenses", href: "/expenses", icon: Receipt, module: "expenses" },
      { label: "Equipment", href: "/equipment", icon: Wrench, module: "equipment" },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Team & Roles", href: "/team", icon: ShieldCheck, module: "team" },
      { label: "Activity Log", href: "/activity", icon: History, module: "activity" },
    ],
  },
];
