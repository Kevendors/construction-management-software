# Weekly-off Types for Site Staff + Leave Pay Fixes — Design

**Date:** 2026-10-28 · **Status:** Approved by user (chat)

Builds on the weekly-off feature in `2026-10-26-weekly-off-design.md`: `WeekOffRule`, `isWeeklyOff`, `defaultDowOn`, swaps, and the history table in migration 0047. It also builds on office auto-leave in `2026-10-28-office-auto-leave-design.md` (`OFFICE_AUTO_LEAVE_FROM`, member `startDate`). Read both, and the current code in `src/lib/attendance/compute.ts`, before changing anything.

## 1. Office staff: unpaid missed days are labelled Absent (pay unchanged)
Today, for office staff from `OFFICE_AUTO_LEAVE_FROM`:
- missed days are counted;
- `daysOffCount = 1` makes the missed day paid Leave;
- `daysOffCount >= 2` makes the missed days "Leave (Unpaid)".

**Change:** when the days are unpaid (`daysOffCount >= 2`), missed days must be treated and displayed as **Absent**, not Leave (Unpaid). That means:
- glyph "A" and label "Absent";
- counted in `absent` in `monthlySummary`, not in `unpaidLeave`;
- `autoLeaveLabel` returns null for them, or the equivalent;
- the CSV, grid, calendars and list show Absent.

Explicit admin-marked Leave stays "Leave (Unpaid)" when unpaid, as today. The paid case (exactly one day off, and it is a missed day) is unchanged: paid Leave. Pay (`effectivePaidDays`) must be **identical** to the current code in every case. Prove it in the check script.

## 2. Site staff: no paid leave
For **site staff** (`!isOffice`), an explicit `status = "leave"` row is **unpaid**:
- `creditType` = "leave_unpaid", `dayCredit` 0, counted in `unpaidLeave`;
- label "Leave (Unpaid)", glyph "LU";
- reason: "Site staff have no paid leave — recorded as unpaid Leave."

Effective from **2026-10-01**, using the same date gate as `OFFICE_AUTO_LEAVE_FROM`; reuse that constant or add `SITE_UNPAID_LEAVE_FROM = "2026-10-01"`. Site Leave before that date stays paid, as before. A Leave on a declared holiday is still a Holiday (paid), as today. Office leave rules are unchanged. In the admin Mark Attendance dialog, the "Leave (paid)" option label must not mislead for site staff: show "Leave (unpaid)" when the selected member is site staff.

## 3. Site weekly-off types
### Data — new migration `0049_attendance_weekly_off_types.sql` (requires 0047)
- `memberships`:
  - add `weekly_off_kind text not null default 'fixed' check (weekly_off_kind in ('fixed','alternate_sunday','flexible'))`;
  - add `weekly_off_anchor date` (nullable).
- `attendance_weekly_off_history`:
  - add `kind text not null default 'fixed'`, with the same check;
  - add `anchor date`.
- `add column if not exists`, idempotent, with rollback notes.

### Kinds
- **fixed**: the existing behaviour. `dow` 0–6, where 0 = Sunday is the default "Every Sunday off". It covers "Every Sunday off" and "Fixed other day".
- **alternate_sunday**: the `anchor` is a Sunday that is an off day. A date is a weekly off when it is a Sunday and the whole number of weeks between `anchor` and `date` is even, which also works for dates before the anchor. Non-off Sundays are working days.
- **flexible**: there are no fixed weekly-off days, and Sundays are working days. Monthly allowance N = the number of Sundays in that calendar month. The weekly-off days in a month are the **first N "missed" days**, in date order. A missed day:
  - is `< today`;
  - has no attendance row;
  - is not a declared holiday for the member;
  - is `>= member startDate` when one is given.

  Missed days beyond N are Absent. Days with any attendance row (Present, Leave, Absent, Half-Day) do not consume the allowance.

### Rule model (compute.ts)
- Extend `WeekOffRule`:
  - `kind?: "fixed" | "alternate_sunday" | "flexible"` (default "fixed");
  - `anchor?: string`;
  - history entries `{ dow, from, kind?, anchor? }`.
- The kind, dow and anchor in effect on a date come from the latest history entry with `from <= date`, the same way `defaultDowOn` works now. With no history, use the top-level fields. Before the first history entry, the default is fixed Sunday.
- `isWeeklyOff(date, rule)` handles fixed and alternate_sunday, with swaps applied as today. For **flexible**, it must return false: flexible offs depend on attendance records and are resolved at month level.
- **New:** `weekOffDatesForMonth(month, rule, records, holidays, isOffice, today, startDate?): Set<string>`. It returns every weekly-off date in the month for this member:
  - fixed and alternate via `isWeeklyOff`;
  - flexible via the first-N-missed rule;
  - if the kind changes mid-month, each date is evaluated under the kind in effect that day. For flexible, apply the first-N rule only over the days where flexible is in effect, with N = Sundays in the month.
- Every place that decides "weekly off or not" for display, absent counts, office missed-day logic or the summary must use this set (or `isWeeklyOff` for non-flexible): `dayStatus` callers, `monthlySummary`, `evaluateEmployeeMonthAttendance`'s missed-day logic, the admin grid, daily view, CSV, `history-calendar`, `history-list` and `RecordDetailDialog`. A weekly off is never Absent and never a paid day; pay is unchanged by weekly-off kind.
- Swaps (`validateWeekOffSwap`, the dialog) are only allowed for fixed and alternate_sunday. Flexible returns a clear error: "Flexible staff choose their own days off — no swap needed."

### Server actions
`setWeeklyOffDayAction` becomes, or is joined by, `setWeeklyOffPatternAction(userId, { kind, dow?, anchor? })`:
- super_admin only;
- validates that the anchor is a Sunday for alternate_sunday and that dow is 0–6 for fixed;
- keeps the upcoming-swaps guard;
- writes history the same way, with the first-change baseline row carrying the previous kind/dow/anchor;
- updates `memberships`;
- maps a missing column or table to "Weekly-off update pending: run 0049_attendance_weekly_off_types.sql in Supabase SQL Editor."

Loaders read kind and anchor with the same tolerant pattern: missing means fixed.

### UI — Team page
Replace the single "Weekly off" select with a compact control:
- a **Type** select: "Every Sunday off", "Alternate Sundays off", "Flexible (= Sundays in month)", "Fixed other day";
- for "Fixed other day", a day select (Mon–Sat);
- for "Alternate Sundays off", a date input for "An off Sunday", which must be a Sunday;
- "Every Sunday off" maps to kind fixed with dow 0.

It is shown for members where `weekOffUiEnabled(isOffice)` (currently both site and office). **However, Alternate and Flexible are offered only for site staff**: office members see only the "Every Sunday off" and "Fixed other day" options. Use optimistic update with rollback, as today. Before 0049, the new kinds are disabled with a tooltip.

## Out of scope / unchanged
Spot-checks, tracking, geofence, the payroll formula (weekly offs stay unpaid, same as Sunday), and the office 1-paid-leave rule other than the Absent relabel in section 1.

## Verification
- A throwaway tsx check script outside the repo, covering:
  - section 1: office pay identical to the current code across many scenarios; labels Absent vs Leave;
  - section 2: site Leave unpaid from 2026-10-01, paid before it, Holiday override;
  - alternate Sundays: anchor parity forward and backward; swaps;
  - flexible: a 4-Sunday month and a 5-Sunday month; extra missed days are Absent; rows don't consume the allowance; today and the start-date floor; a kind change mid-month via history;
  - a fixed Sunday rule with no history equals the current behaviour exactly.
- `npm run build` + eslint on touched files.
