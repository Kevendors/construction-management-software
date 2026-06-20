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
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
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
      { label: "Company Dashboard", href: "/", icon: LayoutDashboard },
      { label: "Analytics", href: "/analytics", icon: LineChart },
    ],
  },
  {
    title: "Delivery",
    items: [
      { label: "Projects", href: "/projects", icon: FolderKanban },
      { label: "Design Management", href: "/design", icon: PencilRuler },
    ],
  },
  {
    title: "Commercial",
    items: [
      { label: "Clients / CRM", href: "/clients", icon: Users },
      { label: "Quotations", href: "/quotations", icon: FileText },
      { label: "Sales Invoices", href: "/invoices", icon: ReceiptText },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Material", href: "/material", icon: Boxes },
      { label: "Subcontractor", href: "/subcon", icon: HardHat },
      { label: "Payroll & Attendance", href: "/payroll", icon: Wallet },
      { label: "Petty Expenses", href: "/expenses", icon: Receipt },
      { label: "Equipment", href: "/equipment", icon: Wrench },
    ],
  },
];
