import type { Role } from "@/lib/types";

/**
 * The single role catalogue every role picker reads (client-safe, no server
 * imports). Employees are staff of the org — they have attendance, payroll,
 * departments and Employee IDs. External users (clients / viewers and
 * subcontractors) are logins only: no attendance, never in employee lists.
 */

/** Employee roles, in menu order. */
export const EMPLOYEE_ROLES: Role[] = [
  "super_admin",
  "pm",
  "supervisor",
  "accountant",
  "hr",
  "staff",
  "architect",
  "engineer",
];

/** External (non-employee) roles, in menu order. */
export const EXTERNAL_ROLES: Role[] = ["subcontractor", "viewer", "client"];

/** Every role, employees first (menu order). */
export const ALL_ROLES: Role[] = [...EMPLOYEE_ROLES, ...EXTERNAL_ROLES];

/** Group labels for `<optgroup>`s in role pickers. */
export const EMPLOYEE_ROLES_LABEL = "Employees";
export const EXTERNAL_ROLES_LABEL = "External (clients & subcontractors)";

/** True for an employee role. Unknown/null → false. */
export function isEmployeeRole(role: Role | null | undefined): boolean {
  return !!role && EMPLOYEE_ROLES.includes(role);
}

/** True for an external (client / viewer / subcontractor) role. Unknown/null → false. */
export function isExternalRole(role: Role | null | undefined): boolean {
  return !!role && EXTERNAL_ROLES.includes(role);
}

/** Server-action refusal message for external users on attendance paths. */
export const ATTENDANCE_EMPLOYEES_ONLY = "Attendance is for employees only.";
