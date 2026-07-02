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
  Shield,
  type LucideIcon,
} from "lucide-react";
import type { AppRole } from "./auth/roles";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  phase?: number; // modules not yet built show a "soon" tag
  requiredRoles?: AppRole[]; // if set, only these roles can see this item
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Company Dashboard", href: "/", icon: LayoutDashboard },
      { label: "Analytics", href: "/analytics", icon: LineChart, requiredRoles: ["admin", "viewer"] },
    ],
  },
  {
    title: "Delivery",
    items: [
      { label: "Projects", href: "/projects", icon: FolderKanban },
      { label: "Design Management", href: "/design", icon: PencilRuler, requiredRoles: ["admin"] },
    ],
  },
  {
    title: "Commercial",
    items: [
      { label: "Clients / CRM", href: "/clients", icon: Users, requiredRoles: ["admin"] },
      { label: "Quotations", href: "/quotations", icon: FileText, requiredRoles: ["admin"] },
      { label: "Sales Invoices", href: "/invoices", icon: ReceiptText, requiredRoles: ["admin"] },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Material", href: "/material", icon: Boxes },
      { label: "Subcontractor", href: "/subcon", icon: HardHat, requiredRoles: ["admin"] },
      { label: "Payroll & Attendance", href: "/payroll", icon: Wallet, requiredRoles: ["admin"] },
      { label: "Petty Expenses", href: "/expenses", icon: Receipt },
      { label: "Equipment", href: "/equipment", icon: Wrench },
    ],
  },
  {
    title: "Admin",
    items: [
      { label: "User Management", href: "/admin/users", icon: Shield, requiredRoles: ["admin"] },
    ],
  },
];
