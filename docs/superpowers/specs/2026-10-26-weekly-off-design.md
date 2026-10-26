# Weekly Off (per-employee default + same-week swaps) — Design

**Date:** 2026-10-26 · **Status:** Approved by user (chat, 2026-10-26)

## Problem
Sunday is hard-coded as everyone's weekly off (`compute.ts` `dayStatus`: `getDay() === 0`). Staff who work a Sunday and take a weekday off instead show that weekday as **Absent**. Some staff also have a different fixed weekly off day.

## Decisions (from the user)
- **Admin/HR record swaps** directly. They are approved when saved; there is no employee request flow.
- **A per-employee default weekly off day**, set on the Team page. The default is Sunday.
- **Same-week comp-off:** a swap's replacement off day must be within ±6 days of the off day being worked.
- **Site staff only in the UI for now.** The data model and calculations apply to every employee, so office staff can be enabled later by flipping one constant.
- **Pay:** a weekly off is treated exactly like a Sunday off is today. It isn't counted as Absent and isn't added to `effectivePaidDays`. A worked swapped Sunday counts as Present as usual. Payroll code is not changed.

## Data — migration `0047_attendance_weekly_off.sql`
(0045 and 0046 are already taken.)
- `alter table memberships add column if not exists weekly_off_dow smallint not null default 0 check (weekly_off_dow between 0 and 6);` where 0 = Sunday and 6 = Saturday, matching JS `getDay()`.
- New table `attendance_week_off_swaps`:
  - Columns: `id uuid pk`, `org_id → orgs cascade`, `user_id → profiles cascade`, `worked_date date not null` (a default off day the employee works), `off_date date not null` (the replacement off day), `note text`, `created_by → profiles set null`, `created_at timestamptz default now()`.
  - Constraints: `unique(user_id, worked_date)`, `unique(user_id, off_date)`, `check (off_date <> worked_date and abs(off_date - worked_date) <= 6)`.
  - Index on `(org_id, user_id)`.
- RLS: select for `is_org_member(org_id) and (user_id = auth.uid() or has_role(org_id, array['super_admin','hr']))`. No write policies; writes go through server actions using the admin client with a role gate.
- Rollback notes, as in the other migrations.

## Pure logic — `src/lib/attendance/compute.ts`
- `export interface WeekOffRule { defaultDow: number; swaps: { workedDate: string; offDate: string }[] }`
- `export const SUNDAY_OFF: WeekOffRule = { defaultDow: 0, swaps: [] }`
- `export function isWeeklyOff(date: string, rule: WeekOffRule = SUNDAY_OFF): boolean` returns true when `swaps` has an entry with `offDate === date`. Otherwise it returns `getDay(date) === rule.defaultDow && !swaps.some(s => s.workedDate === date)`.
- `dayStatus(date, hasRecord, today, isExtraHoliday, rule = SUNDAY_OFF)` replaces the Sunday check with `isWeeklyOff(date, rule)`. It stays backward compatible: with no rule it behaves exactly as today.
- `monthlySummary(..., rule = SUNDAY_OFF)` passes the rule through, and adds `weekOff: number` to `MonthlySummary` (the count of weekly-off days). Weekly offs are counted in `weekOff`, not in `holiday`; `holiday` then means declared holidays only. Update the UI labels that show these counts.
- `evaluateEmployeeMonthAttendance` is unchanged (pay unchanged).
- `export const WEEK_OFF_UI_FOR: ("site" | "office")[] = ["site"];` plus a helper `weekOffUiEnabled(isOffice: boolean)`. This is the single switch to extend the UI to office staff.
- `export function validateWeekOffSwap(rule, workedDate, offDate, holidays, isOffice): string | null` returns an error message or null. Rules:
  - `workedDate` must currently be a weekly off under the rule.
  - `offDate` must be within ±6 days and must not already be a weekly off.
  - `offDate` must not be a declared holiday for the employee.
  - Neither date may already be used in another swap.

## Data loading — `src/lib/data/attendance.ts`
- The `AttendanceMember` type (in compute.ts) gains `weekOff: WeekOffRule`. `getAttendanceAdminBoard` loads `weekly_off_dow` for the members and all swaps for the org. These are separate queries, so a missing column or table (`42703` / `PGRST205` / `PGRST204`) falls back to `SUNDAY_OFF` rather than breaking the board.
- `MyAttendanceData` gains `weekOff: WeekOffRule`, loaded for the caller in the same tolerant way.
- Mock branches return `SUNDAY_OFF`. Update `src/lib/mock/data.ts:658` only if needed for types.

## Server actions — `src/app/attendance/week-off-actions.ts` (new)
These mirror the `team/actions.ts` pattern: `getAuthContext` → role gate (super_admin/hr) → admin client → `logActivity` → `{ id?, error? }`.
- `setWeeklyOffDayAction(userId, dow)` (super_admin only, the same gate as the Office/Site setter) updates `memberships.weekly_off_dow`. It could live in `team/actions.ts` next to `setMemberOfficeAction` instead, if that matches the pattern better.
- `createWeekOffSwapAction({ userId, workedDate, offDate, note })` re-validates on the server with `validateWeekOffSwap`, using fresh DB data, then inserts.
- `deleteWeekOffSwapAction(id)`.
- If the migration isn't applied yet (missing column or table), return the friendly error "Weekly-off table pending: run 0047_attendance_weekly_off.sql in Supabase SQL Editor."

## UI
- **Team page** (`team-board.tsx`, `app/team/page.tsx`): a "Weekly off" select (Sun–Sat) next to the Office/Site select. It only renders for members where `weekOffUiEnabled(isOffice)`. It updates optimistically with rollback, matching the Office/Site select.
- **Admin attendance** (`admin-attendance-tab.tsx`):
  - In the **Employee** view, for an employee where `weekOffUiEnabled`: a "Swap weekly off" button opening a small dialog. The dialog has the worked date (defaulting to the nearest upcoming default off day), the replacement off date and a note.
  - A list of that employee's swaps in the selected range, each with Delete.
  - Every `dayStatus(...)` and `isSunday` call site uses the member's `weekOff` rule, so the replacement day shows **Week Off** and the swapped Sunday is a working day. The call sites are lines ~485, ~523, ~575 and ~623.
- **My Attendance** (`history-calendar.tsx`, `history-list.tsx` if relevant, `monthly-summary.tsx`): pass `data.weekOff`. The calendar shows "Week Off" on weekly offs, and the summary tile reads "Week Off" alongside "Holiday".
- The label is **"Week Off"** everywhere.

## Out of scope
Employee request/approval flow, comp-off balances, office-staff UI (switch only), and payroll formula changes.

## Verification
`npm run build` + lint on touched files. A throwaway tsx script checks `isWeeklyOff` / `validateWeekOffSwap` / `dayStatus` with a rule that has a Tuesday default and a Sunday→Wednesday swap. Then a sample-data browser check that the Team select and the swap dialog render, and that the calendar shows Week Off.
