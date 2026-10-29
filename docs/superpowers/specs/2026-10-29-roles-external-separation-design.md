# Consistent Role Lists + External Users (Clients/Subcontractors) Separated from Employees — Design

**Date:** 2026-10-29 · **Status:** Approved by user (chat)

## Problems
1. Role choices drift between screens. Each screen keeps its own list: `ASSIGNABLE` in `team-board.tsx` (all 11), `ACCOUNT_ROLES` in `payroll/employees-tab.tsx` (only supervisor, pm, super_admin), and `PROJECT_ROLES` in `projects/team-tab.tsx`. Payroll's "Create login" therefore misses most employee roles.
2. External users (`client`, `viewer` "Client / Viewer", and `subcontractor`) are treated as employees:
   - they get the Attendance module (`ROLE_MODULES` in `src/lib/auth/permissions.ts`);
   - they appear in the admin attendance board and members, the live map, the monthly grid, spot-checks and the payroll "link to member" list;
   - on Team & Roles they get employee-only columns: Employee ID, Office/Site, Weekly off, Purchase Orders, Client visits, Can work from office.

## Decisions (user)
- **External roles:** `client`, `viewer`, `subcontractor`. They are NOT employees. There is no attendance for them, and they are not in employee lists, departments, payroll or attendance calculations. They keep their existing non-attendance access (dashboard, projects, subcon, etc.).
- **Employee roles:** `super_admin`, `pm`, `supervisor`, `accountant`, `hr`, `staff`, `architect`, `engineer`.
- **No existing role assignment changes, and no data is modified.** Only access to the Attendance module is removed for external roles. Existing attendance rows for such users stay in the DB but are no longer shown in employee attendance views. No new access roles are added.

## Code
- **One source of truth**, in a client-safe module (e.g. `src/lib/auth/roles.ts`, or extend `permissions.ts`):
  - `EMPLOYEE_ROLES: Role[]` (in menu order) and `EXTERNAL_ROLES: Role[] = ["subcontractor", "viewer", "client"]`;
  - `ALL_ROLES = [...EMPLOYEE_ROLES, ...EXTERNAL_ROLES]`;
  - `isEmployeeRole(role)` / `isExternalRole(role)`.
- **Replace the local lists:**
  - Team page → `ALL_ROLES`, grouped with `<optgroup label="Employees">` / `<optgroup label="External (clients & subcontractors)">`;
  - Payroll "Create login" → `EMPLOYEE_ROLES`;
  - project Team tab → keep its semantics, but derive the list from the shared catalogue (`ALL_ROLES`; external roles can be on a project team).
  - Keep the existing "show current role even if not in the list" fallback.
- **`ROLE_MODULES`:** remove `"attendance"` from `subcontractor`, `viewer` and `client`. Nothing else changes. Check the middleware and sidebar consequences: no other module may lose access, and a landing-page redirect must not loop. `landingPath` for these roles must still resolve to their first module.
- **Attendance and payroll data loaders** (`src/lib/data/attendance.ts` `getAttendanceAdminBoard`, the live locations action, spot-check summaries, payroll `employees-tab` member linking, the Team page member list for employee columns):
  - Exclude members whose role is external from employee lists.
  - In the admin board, filter `members` and `records` to employee-role users only.
  - `getMyAttendancePage` for an external role: return an empty/no-access shape, or rely on the middleware redirect. Make sure server actions (`checkInAction`, `officeCheckInAction`, `switchSiteAction`, `recordLocationPingAction`, `confirmSpotCheckAction`) refuse external roles with "Attendance is for employees only.". The server must enforce this, not just the UI.
- **Team & Roles page** (`team-board.tsx` / `app/team/page.tsx`):
  - Split into two cards. **"Employees"** has all the current columns. **"Client & subcontractor logins"** shows Member, Login, Role, Status and Action only. There are no Employee ID, Office/Site, Weekly off, PO, Client visits or Can-work-from-office controls for external users.
  - Changing someone's role between employee and external moves them between the cards (after refresh is fine). Don't auto-change any of their other flags.
  - "New Team Member" keeps all roles, grouped as above.
- **Employee ID auto-generation:** if the code auto-assigns employee IDs on member creation (check `team/actions.ts`, `payroll/actions.ts`), don't assign one for external roles going forward. Leave existing IDs untouched.
- **Mock data:** keep mock mode working.

## Out of scope
New roles, permission changes beyond removing attendance for external roles, and any DB migration. None is needed: role is an existing enum, and this is app logic only.

## Verification
- `npm run build` + eslint on touched files.
- A throwaway tsx check of `isEmployeeRole` / `isExternalRole` and that `ROLE_MODULES` for external roles has no `"attendance"` while every other module is unchanged. Diff against the baseline `ROLE_MODULES`.
- A sample-data browser check where feasible: Payroll "Create login" shows all 8 employee roles.
