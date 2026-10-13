# Office attendance (punch-in/out) design

## Context

SiteHub's attendance system (`/attendance`, built 2026-07-18, extended through
2026-10-07 with late-arrival/half-day policy) is built entirely around **site
staff**: checking in requires picking a project, capturing GPS, and taking a
live selfie, with an optional per-project geofence. Anyone with **zero
project assignments** — office roles like accountant, HR, admin staff — hits
a hard block today: the "Mark Attendance" button is replaced with *"You're
not assigned to a project yet — ask your admin to add you from the project's
Team tab."* They have no way to mark attendance through the app at all.

The user wants office employees onboarded onto the same app, with a
deliberately lighter flow: single-tap punch, no selfie, no project picker —
matching the explicit requirements list they provided (direct punch-in,
automatic time tracking, live location with permission, punch-out,
attendance history, admin visibility with access control, optional location
validation, and clear exception handling when GPS isn't available).

Confirmed via brainstorming (this session, 2026-10-13):
- **Who gets the office flow**: automatic, based on whether the employee has
  any project assignment — **not** role-based, **not** a manual per-person
  choice. Zero projects → office flow. One or more projects → existing site
  flow (unchanged, including the "always show project step" fix from
  2026-10-13).
- **No selfie for office punches** — GPS + one tap only.
- **One shared office location for the whole org** (not per-branch/multiple
  offices), with an optional geofence — same "all three null = disabled"
  convention already used for per-project geofences.

## 1. Data model

**No change needed to `employee_attendance`.** `project_id` is already
nullable (`references projects(id) on delete set null`, migration 0016,
no `not null`), and both selfie-path columns are already plain nullable
`text`. A null `project_id` *is* the office-attendance marker — no new
column, no ambiguity (an employee is either on a project roster, in which
case their row always has a `project_id`, or they aren't, in which case it's
always null).

**New migration `0036_org_office_location.sql`:**
```sql
alter table public.orgs
  add column if not exists office_lat numeric,
  add column if not exists office_lng numeric,
  add column if not exists office_radius_m integer;
```
All three nullable; the fence is disabled unless all three are set, matching
`projects.geofence_lat/lng/radius_m`'s existing convention exactly. No RLS
change needed — `orgs` is already readable by any org member and writable
only by super_admin under the existing policy.

## 2. Server actions

New additions to `src/app/attendance/actions.ts` (existing `checkInAction`/
`checkOutAction` are untouched — kept separate rather than overloaded with
conditionals, so each stays easy to read in isolation):

- **`getOfficeGeofenceAction(): Promise<{ lat: number | null; lng: number | null; radiusM: number | null }>`**
  — reads the org's office_lat/lng/radius_m, used both by the office
  check-in flow's client-side pre-check and the settings form.

- **`officeCheckInAction({ lat, lng, accuracy }): Promise<CheckInResult>`**
  — mirrors `checkInAction` minus `projectId`/`selfieDataUrl`: validates
  coordinates, loads the org's office geofence and applies the same
  `fenceError()` helper (extracted to accept a `GeofenceRow`-shaped object,
  which org office settings already match), rejects a same-day duplicate the
  same way, inserts `employee_attendance` with `project_id: null`,
  `check_in_selfie_path: null`. Reuses the exact same late-arrival/half-day
  evaluation as site check-in (it only ever looks at `checkInAt`, never
  `projectId`).

- **`officeCheckOutAction({ lat, lng, accuracy }): Promise<ActionResult>`**
  — mirrors `checkOutAction` minus selfie: closes today's open row,
  computes `total_minutes`/`overtime_minutes` identically.

- **`setOfficeGeofenceAction(lat, lng, radiusM)`** — super_admin-only,
  updates the three `orgs` columns. Passing all three as null disables the
  fence (same pattern as how a project's fence is cleared).

## 3. Office punch UI

**`CheckInCard`** (`src/components/attendance/check-in-card.tsx`): the
`hasProjects === false` branch currently renders a blocking warning. It
becomes the office-flow entry point instead — a **"Punch In"** button
(office wording, matching the requirements list's own terminology) that
opens the new office flow. `hasProjects === true` is completely unchanged
(existing site flow, including today's "always show project step" fix).

**New `OfficeCheckInFlow`** component (`src/components/attendance/office-check-in-flow.tsx`)
— deliberately separate from `CheckInFlow` rather than a third mode bolted
onto it, since it's genuinely simpler (3 steps vs. 5, no selfie, no project
list) and keeping it isolated means neither component has to reason about
the other's steps:
1. Dialog opens already acquiring GPS (`useGeolocation`, reused as-is).
2. If an office fence is configured and the reported position falls outside
   it (minus GPS accuracy, same slack logic as site): clear error message +
   Retry button — identical UX pattern to the site flow's fence rejection.
3. On a valid fix, submit immediately (`officeCheckInAction`/
   `officeCheckOutAction`) — true one-tap, no confirm screen, since there's
   no selfie to review. Success state shows the punch time and (if
   applicable) the same late-arrival/half-day callout `CheckInFlow` already
   renders, reused as a shared small component rather than duplicated.

**Exception handling** (GPS disabled/denied/undetectable): same error step +
Retry as site already has, plus explicit copy: *"Still having trouble? Ask
your admin to mark today's attendance for you."* — pointing at the existing
admin manual-entry path (`AdminMarkAttendanceDialog`, already works for any
employee/date with no project required — its Project field already has a
blank "—" option). No new admin tooling needed for this fallback; it already
exists and already supports office employees.

## 4. Admin dashboard + office-location setting

**`AdminAttendanceTab`** (`src/components/attendance/admin-attendance-tab.tsx`):
every place that currently does `projectById.get(record.projectId)?.name`
and would otherwise render blank/"—" for a null `project_id` now renders an
**"Office" badge** instead — Daily view's Project column, the Monthly grid's
cell tooltip, Employee view's Project column, and CSV export's Project
field. This is the only change needed for "clearly distinguish office vs.
site attendance" — no new filter/tab, since Daily/Monthly/Employee already
show every employee regardless of project, and the existing "All projects"
filter dropdown naturally has no effect on office rows (they have no
project to filter by, so they always show — correct, since "All projects"
should mean "everyone").

**`RecordDetailDialog`**: when a record has no `check_in_selfie_path` /
`check_out_selfie_path` *and* `project_id` is null, show *"No selfie —
Office punch-in"* instead of the current bare "No selfie" (which otherwise
reads as something being wrong).

**Office location setting**: a small card at the top of the Attendance
admin tab, **visible and editable by super_admin only** (same gating as the
rest of admin attendance config) — three inputs (latitude, longitude, radius
in meters), save button, and a "Fence disabled — attendance accepted from
anywhere" hint when any of the three is empty. Deliberately mirrors
`settings-tab.tsx`'s existing per-project geofence form (manual numeric
entry, same layout) rather than introducing a new input pattern like a
map picker or "use my current location" button — consistent with how
project geofences are already configured today.

## Out of scope

- Multiple office branches/locations — explicitly declined; one shared
  office location for the whole org.
- Selfie capture for office punches — explicitly declined.
- Role-based or manual office/site selection — explicitly declined;
  determined automatically from project assignment.
- Any change to the late-arrival/half-day policy, payroll paid-days
  calculation, or duplicate-punch prevention — all already project-agnostic
  and apply to office rows with no changes.
- Any change to the existing site check-in/check-out flow beyond what the
  2026-10-13 "always show project step" fix already shipped.
