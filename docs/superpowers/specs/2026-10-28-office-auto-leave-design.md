# Office Staff Auto-Leave — Design

**Date:** 2026-10-28 · **Status:** Approved by user (chat)

## Rule (office staff only; `isOffice === true`, the Team-page setting)
- **Missed day:** a past working day with no attendance record. That means `date < today`, it is not a weekly off under the member's `WeekOffRule`, it is not a declared holiday for them (`isHolidayFor`), and it has no row. Such a day is **automatically treated as Leave**. Nobody has to mark it.
- **Days taken in the month** = explicit Leave rows (not on a declared holiday) + missed days + explicit admin-marked **Absent** rows.
  - If the total is **exactly 1** and that day is a Leave or missed day, it is **paid Leave** (1.0 credit).
  - If the total is **2 or more**, **all** Leave and missed days that month are **unpaid** (0 credit). This is the existing "2nd leave makes both unpaid" rule, now also counting missed days and Absent marks.
- **Admin-marked Absent** stays **unpaid Absent** and is never converted to Leave, but it **counts** toward the 2+ trigger. Example: 1 marked Absent + 1 missed day gives 2, so the missed day is unpaid.
- Today and future days never count. Site staff are unchanged: missed days stay Absent, and explicit leave is still unlimited paid.

## Code — `src/lib/attendance/compute.ts`
- `evaluateEmployeeMonthAttendance(records, month, isOffice, holidays, rule: WeekOffRule = SUNDAY_OFF, today = orgToday())`. Add the `rule` and `today` params at the end, with defaults, so existing calls stay valid.
- New outputs on `MonthlyAttendanceEvaluation`:
  - `autoLeaveDates: string[]` (office only; empty for site staff);
  - `autoLeavePaid: boolean`.
  - Count auto-leave days into `fullDays` when paid, or into `unpaidLeave` when unpaid. `effectivePaidDays` therefore includes a paid auto-leave day.
- `leavesAreUnpaid` must use the new total (explicit leave + missed + explicit absent) > 1, office only. Keep the existing per-record reason text accurate, e.g. "Office staff get 1 paid Leave per month — 2 days off this month (incl. missed days / Absent), so all Leave is unpaid."
- `monthlySummary` passes `rule` through to the evaluation. For office staff, a missed day must NOT be counted in `absent`. Count it in `leave` when paid, or `unpaidLeave` when unpaid.
- Export a helper for the UI, e.g. `autoLeaveLabel(evaluation, date): { label: "Leave" | "Leave (Unpaid)"; glyph: "LV" | "LU" } | null`.

## Call sites to update (pass the member's `WeekOffRule`)
- `components/attendance/admin-attendance-tab.tsx`: lines ~116, ~636 and ~969. Wherever a past no-record day is rendered as Absent ("A") for a member, render the auto-leave glyph and label instead when `autoLeaveDates` includes it. The relevant views are the monthly grid, daily view, employee view and CSV export.
- `components/attendance/history-calendar.tsx` (~42) and `history-list.tsx` (~42): these get `weekOff` (My Attendance already has `data.weekOff`; thread it through as a prop the same way `monthly-summary.tsx` gets it). Show Leave / Leave (Unpaid) for auto-leave days.
- `components/payroll/employees-tab.tsx` (~86): pass the member's `weekOff` (from `attendanceBoard.members`) so payroll paid days include a paid auto-leave day.
  - Note: `attendanceStatsFor` returns null when an employee has zero records in the month. Keep that behaviour unchanged.
- `monthly-summary.tsx`: the policy text should read "Office staff get 1 paid Leave per month — a missed working day counts as Leave automatically; taking a 2nd day off (missed, Leave or Absent) makes all Leave that month unpaid."

## Verification
- A throwaway tsx script outside the repo, covering office staff:
  - 0 missed days;
  - 1 missed day (paid, `effectivePaidDays` +1);
  - 2 missed days (both unpaid);
  - 1 missed day + 1 explicit Leave (both unpaid);
  - 1 marked Absent + 1 missed day (missed day unpaid, Absent stays Absent);
  - a missed day on a weekly off or declared holiday (not counted);
  - today not counted.
- Site staff: a missed day stays Absent, with an unchanged `effectivePaidDays`.
- `npm run build` + eslint on touched files.
