# Departments, Designations & Office "Client visits allowed" — Design

**Date:** 2026-10-29 · **Status:** Approved by user (chat)

## The model (unchanged principle, made explicit)
An employee has four independent settings:
1. **Access role** (`memberships.role`): permissions only. **Unchanged.** No new roles. Sales, Marketing and BD staff use "Employee / Staff" (`staff`).
2. **Employee type** (`memberships.is_office`, Office/Site, on the Team page): the **only** thing that drives attendance flow, weekly-off rules, leave and salary. Unchanged.
3. **Department** (`employees.department`): an HR label. **Extended.**
4. **Designation** (`employees.designation`): job title, free text. **Gains a suggestion list.**

Department and designation never affect employee type, attendance or salary. Existing employee rows, departments and attendance are untouched.

## 1. Departments — migration `0051_departments_client_visits.sql`
- Extend the Postgres enum `department` (from 0001: engineering, design, site, accounts, admin) with `alter type public.department add value if not exists '<v>';`, one statement per value: `sales`, `digital_marketing`, `business_development`, `hr`, `projects`, `it`, `purchase`, `others`. Put these statements **first**, and don't use the new values anywhere else in the migration (Postgres restriction).
- `src/lib/types.ts`: add the new values to `type Department`.
- `src/lib/labels.ts`: add to `departmentLabel` — Sales, Digital Marketing, Business Development, HR, Projects, IT, Purchase, Others.
- Every department `<select>` (Add Employee in `payroll/employees-tab.tsx`, `payroll/set-salary-dialog.tsx`, and any other place found by grep) lists all departments, grouped with `<optgroup>`:
  - **Office:** Admin, Accounts, HR, Sales, Digital Marketing, Business Development, Purchase, IT;
  - **Site / Projects:** Site, Projects, Engineering, Design;
  - **Others.**
- Check charts and labels that iterate departments (`charts/payroll-chart.tsx`, `lib/payroll/compute.ts` `payrollByDepartment`) so unknown or new keys don't break.
- **Before 0051 runs:** saving a new department value fails with a Postgres enum error. Map that to a friendly message: "New departments need 0051_departments_client_visits.sql run in Supabase first."

## 2. Designation suggestions
In the Add Employee and Set Salary designation inputs, add an HTML `<datalist>` of suggestions. Free text is still allowed.
- **Office:** Sales Executive, Sales Manager, Digital Marketing Executive, Admin Executive, Office Manager, Business Development Executive, Business Development Manager, Accountant, Accounts Manager, HR Executive, HR Manager, Purchase Executive, IT Executive.
- **Site:** Site Supervisor, Project Manager, Site Engineer, Junior Engineer, Foreman, Safety Officer, Store Keeper, Surveyor, Draughtsman, Architect.

## 3. Office staff "Client visits allowed"
- **Data:** in the same migration, after the enum statements, `alter table public.memberships add column if not exists client_visits_allowed boolean not null default false;`.
- **Team page:** a tick, **"Client visits allowed"**, shown only for **Office** members. Super_admin only. It uses a server action like `setMemberWorkFromOfficeAction` (same pattern, optimistic update with rollback, tolerant of the column being missing: disabled with the tooltip "Run 0051… first"). Switching a member to Site clears the tick, tolerantly.
- **Office punch** (`officeCheckInAction` / `officeCheckOutAction` in `src/app/attendance/actions.ts`, and `office-check-in-flow.tsx`):
  - Without the flag, behaviour is unchanged: the strict office fence (`fenceError`) blocks a punch outside the office.
  - With the flag, outside the office fence: **don't block**. Ask for a reason, mirroring the site flow's reason step:
    - add an optional `outsideReason` to the office input and return `outsideDistanceM` when it's missing;
    - reasons: "Client meeting", "Client site visit", "Vendor / supplier meeting", "Other" (Other needs typed text, max 200 characters).
  - Save the punch, appending to the record's note "Punched in away from office (X km): <reason>" or "Punched out away from office (X km): <reason>". Notify super_admin + hr (`kind: 'delay'`) "<name> punched in away from office — X km — <reason>".
  - There is no selfie, as for office punches today. The employee **stays Office**: no tracking, no spot-checks, and office leave and salary rules apply.
- **Admin attendance table:** the existing "Outside site" badge (it matches `record.note.includes("outside site")`) should also show for "away from office", labelled **"Away from office"**. The record dialog already prints self-record notes.
- Load the flag tolerantly onto `MyAttendanceData` (`clientVisitsAllowed`) so the office flow knows to offer the reason step, and onto the Team page member.

## Out of scope
New access roles, permission changes, and changing any existing employee's department, designation or type.

## Verification
- `npm run build` + eslint on the touched files.
- A sample-data browser check that the department dropdown shows the groups, the designation suggestions appear, and the Team tick renders for Office members only.
