# Switch Site (multiple projects in one day) — Design

**Date:** 2026-10-29 · **Status:** Approved by user (chat)

## Problem
A Site employee picks one project at check-in. Staff who visit several projects in a day have no way to record the later sites. Spot-checks and the live map keep judging them against the morning project.

## Decisions (from the user)
- A **"Switch Site"** button is available while a site shift is open: checked in with a project, not checked out.
- It is available to **all Site staff**. Projects offered: the same list as the check-in picker, i.e. their roster, or all open projects when unassigned (`MyAttendanceData.assignedProjects`). The current site is excluded.
- Each switch requires **GPS + a live selfie**, as at check-in.
- The geofence rule is the same as check-in. Outside the chosen project's fence: ask for a reason (same reason list); save it; notify Super Admin + HR (`kind: 'delay'`) "X switched to <project> outside site — <distance> — <reason>". Never block.
- **One attendance day is unchanged:** one check-in and one check-out. Pay, the weekly-off logic and the leave logic are untouched. `employee_attendance.project_id` stays the **first** project.

## Data — migration `0050_attendance_site_visits.sql`
Table `attendance_site_visits`:
- `id uuid pk`;
- `org_id → orgs cascade`;
- `attendance_id → employee_attendance cascade`;
- `user_id → profiles cascade`;
- `project_id → projects set null`;
- `arrived_at timestamptz not null default now()`;
- `lat double precision not null`, `lng double precision not null`, `accuracy real`;
- `selfie_path text`;
- `outside_m integer`, `outside_reason text`;
- `created_at timestamptz default now()`.

Index on `(attendance_id, arrived_at)` and on `(org_id, arrived_at desc)`. RLS: select only, for `is_org_member(org_id) and (user_id = auth.uid() or has_role(org_id, ['super_admin','hr']))`. No write policies. Include rollback notes and an idempotent style, as in other migrations. The app must keep working before 0050 runs (`PGRST205` / `42P01` mean "no visits", and the switch action returns "Site switching pending: run 0050_attendance_site_visits.sql in Supabase SQL Editor.").

## Current site
Shared helper (server side), e.g. `currentProjectIdFor(attendanceId, fallbackProjectId)`: the `project_id` of the latest visit by `arrived_at`, or else the attendance row's `project_id`. Use it in:
- `checkOutAction`: the geofence / outside-site check uses the **current** project;
- `confirmSpotCheckAction` (`src/app/attendance/spot-check-actions.ts`): judge on/off site against the current project at confirmation time, not the spot-check row's original `project_id`. Also store the judged project, by updating the spot-check row's `project_id` to the current one, so admin sees the right site;
- `getLiveLocationsAction`: `projectName` and `distanceFromSiteM` use the current project;
- the missed spot-check alert text in `src/app/api/cron/spot-checks/route.ts`: use the current project name.

## Server action — `switchSiteAction(input: { projectId, lat, lng, accuracy, selfieDataUrl, outsideReason? })`
It lives in `src/app/attendance/actions.ts`, next to check-in/out, and reuses `validCoords`, `outsideSiteDistance`, `formatMeters`, `uploadSelfie` (with a new suffix, e.g. `visit-<n>`; extend the `suffix` type as needed) and the role/roster rule from `checkInAction`. Steps:
1. Validate. There must be an open self check-in today with a non-null `project_id`; otherwise return the error "Check in at a site first."
2. The project is looked up org-scoped with `createAdminClient()` (unassigned staff can't read it through RLS). The same role/roster rule as check-in applies.
3. Reject if it equals the current project: "You're already at this site."
4. Outside the fence with no reason: return `{ error, outsideDistanceM }`, like check-in.
5. The selfie is mandatory. Upload it first; if the upload fails, return an error and insert nothing.
6. Insert the visit with the admin client.
7. `logActivity`.
8. Outside-site notification to super_admin + hr.
9. Cap at 20 visits per day.

## Client UI
- **My Attendance** (`check-in-card.tsx` / `my-attendance.tsx`): while a site shift is open, show a secondary **"Switch Site"** button next to Check Out, plus a line "Current site: <name> since <time>".
  - `MyAttendanceData` gains `todayVisits: { projectId, projectName, arrivedAt }[]`, loaded tolerantly.
  - The current site's name comes from the latest visit, or else today's project.
- **Flow:** reuse `CheckInFlow` with a third mode, `"switch"`, rather than duplicating it. Steps: pick a project (excluding the current one) → GPS → reason if outside → selfie → confirm → `switchSiteAction`. The success text reads "Switched to <project> at <time>".
- **Admin record dialog** (`record-detail-dialog.tsx`): a **"Sites visited"** timeline, shown when visits exist:
  - the check-in project at the check-in time, then each visit with its time, project name, address (reuse `reverseGeocodeAction`; at most 10 points), selfie thumbnail (signed URL, like the existing selfies; extend `getAttendanceSelfieUrls` or add a visits variant), an outside-site note and a map link;
  - the mini map gains numbered pins for the visits ("1", "2", …), in addition to IN/OUT.
- **Admin table (Employee view):** add a small "N sites" badge on days with visits.

## Out of scope
Per-site hours or pay, editing or deleting visits, and office staff.

## Verification
- `npm run build` + eslint on touched files.
- A throwaway tsx check for any pure helper you add (e.g. choosing the current project from a visit list).
- A sample-data (mock mode) sanity check that the Switch Site button and flow render when `today` is an open site shift. Mock actions can return success.

---

## Addendum (2026-10-29): "Office" as a site for selected Site staff (e.g. sales executives)
Decided by the user: **only selected people**.

- **Flag.** `memberships.can_work_from_office boolean not null default false`, added in the same migration 0050. On the **Team page** it is a tick, "Can work from office", shown only for **Site** members, set by super_admin only (server action alongside `setMemberOfficeAction`, same pattern, optimistic UI with rollback). It is loaded tolerantly: a missing column means false. It is exposed on `MyAttendanceData` (`canWorkFromOffice`) and on `AttendanceMember`.
- **Pickers.** For Site members with the flag, the **morning check-in project picker** and the **Switch Site picker** show **"🏢 Office"** as the first option, using the sentinel value `"office"`. It is excluded from Switch Site when they are currently at the Office.
- **Check-in at the Office** (site flow, `projectId = "office"`):
  - the server verifies the flag;
  - GPS is judged against the **org office geofence** (`orgs.office_lat/lng/radius_m`) with the same soft rule: outside means a reason and an Admin/HR notification, never blocked;
  - a selfie is required (site flow);
  - the attendance row is stored with `project_id = null`;
  - **no spot-checks are scheduled** at an office check-in.
- **Switch Site to the Office:** a visit row with `project_id = null` means "Office". The office geofence and reason rule apply, and the selfie is required. **Cancel this shift's remaining `scheduled` and `pending` spot-checks** (reuse `cancelSpotChecks`).
- **Switch Site from the Office to a project:** a normal visit. **Schedule spot-checks for the rest of the shift**, starting from the switch time: reuse `planSpotChecks` with the switch time as the start, insert via the spot-check store with that project, and skip rows that would duplicate existing scheduled ones.
- **Current site** is a project or the Office. "Current site: Office since 9:30" is shown. The live tracking (`use-live-tracking`) and spot-check judging only apply while the current site is a **project**. While the current site is the Office there is no tracking, like office staff. `getLiveLocationsAction` omits members currently at the Office.
- **Check-out:** the geofence check uses the current site (a project fence, or the office fence when at the Office). A hybrid member's open shift **always closes with the site flow** (selfie), even when the attendance row's `project_id` is null. In `my-attendance.tsx` the flow choice for an open self shift must account for `canWorkFromOffice` and `!isOffice`.
- **Admin timeline and labels:** show "Office" for null-project visits and for an office check-in by a hybrid member. The live map and the outside-site notifications say "Office".
- **Pay, weekly-off and leave rules are unchanged.** They follow the Team Office/Site setting (these members are Site).
