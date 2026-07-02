export type AppRole = "admin" | "supervisor" | "viewer";

export interface RolePermissions {
  canEditProjects: boolean;
  canManageUsers: boolean;
  canApproveExpenses: boolean;
  canViewPayroll: boolean;
  canViewAnalytics: boolean;
  canCreateInvoices: boolean;
  canCreateQuotations: boolean;
  canManageMaterial: boolean;
  canManageSubcon: boolean;
  canManageEquipment: boolean;
  canViewDesign: boolean;
  canViewCRM: boolean;
  seeAllProjects: boolean;
  visibleNavSections: string[];
}

export const PERMISSIONS: Record<AppRole, RolePermissions> = {
  admin: {
    canEditProjects: true,
    canManageUsers: true,
    canApproveExpenses: true,
    canViewPayroll: true,
    canViewAnalytics: true,
    canCreateInvoices: true,
    canCreateQuotations: true,
    canManageMaterial: true,
    canManageSubcon: true,
    canManageEquipment: true,
    canViewDesign: true,
    canViewCRM: true,
    seeAllProjects: true,
    visibleNavSections: ["Overview", "Delivery", "Commercial", "Operations"],
  },
  supervisor: {
    canEditProjects: true,
    canManageUsers: false,
    canApproveExpenses: false,
    canViewPayroll: false,
    canViewAnalytics: false,
    canCreateInvoices: false,
    canCreateQuotations: false,
    canManageMaterial: true,
    canManageSubcon: false,
    canManageEquipment: true,
    canViewDesign: false,
    canViewCRM: false,
    seeAllProjects: false,
    visibleNavSections: ["Overview", "Delivery", "Operations"],
  },
  viewer: {
    canEditProjects: false,
    canManageUsers: false,
    canApproveExpenses: false,
    canViewPayroll: false,
    canViewAnalytics: true,
    canCreateInvoices: false,
    canCreateQuotations: false,
    canManageMaterial: false,
    canManageSubcon: false,
    canManageEquipment: false,
    canViewDesign: false,
    canViewCRM: false,
    seeAllProjects: true,
    visibleNavSections: ["Overview"],
  },
};

export const appRoleLabel: Record<AppRole, string> = {
  admin: "Admin",
  supervisor: "Supervisor",
  viewer: "Viewer",
};

/** Nav items visible per role. Supervisor sees Projects + Expenses + Equipment only from Operations. */
export const SUPERVISOR_NAV_ITEMS = [
  "Company Dashboard",
  "Projects",
  "Material",
  "Petty Expenses",
  "Equipment",
];

export const VIEWER_NAV_ITEMS = [
  "Company Dashboard",
  "Analytics",
];
