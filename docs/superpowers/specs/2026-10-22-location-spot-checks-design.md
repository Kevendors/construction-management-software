# Location Spot-Checks — Design

**Date:** 2026-10-22
**Status:** Draft, awaiting review

## Problem

Live location tracking (0042) only works while the My Attendance page is open on screen. Phones freeze websites when locked or backgrounded, so SiteHub has no continuous view of where site staff are during a shift. We want verified location points spread across the shift, without a native app.

## Solution summary

During a site employee's shift, SiteHub sends a phone notification at a random time inside each ~2-hour block. The employee taps it and confirms their location with one tap within 15 minutes. Each check is recorded as **On site**, **Off site** or **Missed**. A miss alerts Super Admin/HR straight away.

## Scope

**In:**
- Site staff only, meaning a self check-in with a `project_id`. Office check-ins (no project) are never spot-checked.
- Location only. No selfie.
- One random check per 2-hour block, from check-in until the shift end (`SHIFT_END_TIME`, 18:00 IST).
- A 15-minute response window.
- On a miss: the check is marked Missed, and Super Admin and HR get an in-app notification plus a push notification.
- Admin can see checks per attendance record and can **excuse** a missed check.

**Out:**
- Any automatic effect on pay or day status. The admin decides manually.
- Office staff.
- Configurable frequency or window. These are constants in code.
- Selfie or photo proof.

## Rules

### Scheduling (at site check-in)

1. Window = `check_in_at + 20 min` → `18:00 IST` that day. If the window is under 30 minutes, schedule nothing.
2. Split the window into consecutive 2-hour blocks. The last block may be shorter.
3. In each block, pick one uniformly random time, but drop a block shorter than 30 minutes. A check also needs at least 15 minutes before 18:00 so the response window fits inside the shift.
4. Insert one row per time with `status = 'scheduled'`.

Example: check-in at 9:40 gives a window of 10:00–18:00, so 4 blocks and 4 checks.

### Lifecycle

```
scheduled ──(time reached, shift still open)──▶ pending ──(confirmed in 15 min)──▶ on_site | off_site | confirmed
    │                                              └──(15 min passed)──▶ missed ──(admin)──▶ excused
    └──(employee punched out first)──▶ cancelled
```

- **on_site:** GPS distance to the project geofence centre ≤ `geofence_radius_m + min(accuracy, 100)`. The accuracy allowance is capped so a very poor fix can't pass by itself.
- **off_site:** outside that distance. The distance is stored and shown.
- **confirmed:** the project has no geofence set, so the location is recorded but can't be judged.
- **missed:** no confirmation within 15 minutes. `was_notified = false` if the user had no push subscription when the check went out, so the admin can tell "never got the alert" apart from "ignored it".
- **cancelled:** the employee punched out before the check fired. Punch-out cancels all remaining `scheduled` rows.

### Timing precision

The scheduler runs every 5 minutes, so a check goes out up to 5 minutes after its random time. The 15-minute window starts at `notified_at` (when it was actually sent), not at `scheduled_at`.

## Architecture

### 1. Database — migration `0045_attendance_spot_checks.sql`

Table `attendance_spot_checks`:

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| org_id | uuid → orgs, cascade | |
| attendance_id | uuid → employee_attendance, cascade | the shift it belongs to |
| user_id | uuid → profiles, cascade | |
| project_id | uuid → projects | geofence source |
| scheduled_at | timestamptz | random time |
| notified_at | timestamptz null | when the push went out |
| was_notified | boolean null | the user had ≥1 push subscription |
| responded_at | timestamptz null | |
| lat, lng | double precision null | |
| accuracy | real null | |
| distance_m | real null | from the geofence centre |
| status | text, check in (`scheduled`,`pending`,`on_site`,`off_site`,`confirmed`,`missed`,`excused`,`cancelled`) | |
| excused_by | uuid → profiles null | |
| excuse_note | text null | |
| created_at | timestamptz default now() | |

Indexes: `(status, scheduled_at)` for the scheduler, `(attendance_id)` for display, and `(user_id, status)` for the employee's pending check.

**RLS:** select for self, or for `has_role(org_id, ['super_admin','hr'])`, the same model as 0042. There are **no** insert/update policies. All writes go through server code using the service-role client, which gates itself.

**Scheduler (same migration, separate block):** enable the `pg_cron` and `pg_net` extensions, then:

```sql
select cron.schedule('sitehub-spot-checks', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://<prod-domain>/api/cron/spot-checks',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
  );
$$);
```

The domain and secret are filled in by hand when the migration is applied. SETUP.md documents this step.

### 2. Pure logic — `src/lib/attendance/spot-checks.ts`

Pure functions with no I/O, so they're easy to reason about:
- `planSpotChecks(checkInAt: Date, now?): Date[]` applies the scheduling rules.
- `judgeSpotCheck({lat,lng,accuracy}, project): { status, distanceM }` returns on_site, off_site or confirmed.
- Constants: `SPOT_CHECK_BLOCK_MIN = 120`, `SPOT_CHECK_WINDOW_MIN = 15`, `SPOT_CHECK_FIRST_DELAY_MIN = 20`.

### 3. Server writes

- **Site check-in action** (existing, `src/app/attendance/actions.ts`): after a successful self check-in with a `projectId`, insert the planned rows. Best-effort: a failure is logged and never blocks the check-in.
- **Check-out action** (existing): set the remaining `scheduled` and `pending` rows for that attendance to `cancelled`.
- **`confirmSpotCheckAction(id, {lat,lng,accuracy})`** (new, in the attendance actions file): `getAuthContext()`, then require the row to belong to `ctx.userId` with `status = 'pending'` and `now ≤ notified_at + 15 min + 1 min grace`. Validate coordinates (existing `validCoords`), run `judgeSpotCheck`, update the row and `logActivity()`.
- **`excuseSpotCheckAction(id, note)`** (new): super_admin/hr only. Changes `missed` to `excused` and logs it.

### 4. Scheduler endpoint — `src/app/api/cron/spot-checks/route.ts`

`POST`, rejected unless `Authorization: Bearer ${process.env.CRON_SECRET}`. Uses the admin client. Each run:

1. **Cancel stale:** `scheduled` rows whose attendance is already checked out become `cancelled`.
2. **Fire due:** `scheduled` rows with `scheduled_at ≤ now` become `pending`, with `notified_at = now` and `was_notified` set from `push_subscriptions`. Then `dispatchNotification({ userIds:[user], kind:'info', title:'Location check', body:'Tap to confirm you're on site — within 15 min', href:'/attendance?spotcheck=<id>' })`.
3. **Expire:** `pending` rows with `notified_at + 15 min < now` become `missed`. Then `dispatchNotification({ roles:['super_admin','hr'], kind:'delay', title:'Missed location check', body:'<name> · <project> · <time>', href:'/attendance?tab=admin' })`.

Every update is conditional on the current status (e.g. `.eq('status','scheduled')`), so overlapping runs can't double-send. The existing notification kinds (`info`, `delay`) are reused, so no enum change is needed. Mock mode (no Supabase env): the route returns 200 and does nothing.

### 5. Employee UI

- **`SpotCheckCard`** (new, `src/components/attendance/spot-check-card.tsx`), shown at the top of My Attendance when the user has a `pending` check. It shows "Location check — confirm by 2:45 PM", a countdown, and a big **Confirm Location** button. The button uses the existing `use-geolocation.ts` and then calls `confirmSpotCheckAction`. After that it shows the result (✅ On site / ⚠️ Off site, 1.2 km away).
- Data: `src/lib/data/attendance.ts` adds `pendingSpotCheck` to `MyAttendanceData`. The mock branch returns `null`.
- The card shows whether the employee arrived through the notification or opened the page themselves, so a disabled notification doesn't stop them confirming.

### 6. Admin UI

- **Record detail dialog** (`record-detail-dialog.tsx`): adds a "Spot-checks" section listing each check's time, status badge, distance and a map link. Missed checks have an **Excuse** button with an optional note (super_admin/hr only).
- **Admin attendance tab:** adds a small per-day indicator next to the record, such as "3/4 ✓" or a red dot when any check was missed, so problems stand out without opening each record.
- Mappers: add `mapSpotCheck` to `mappers.ts` and a `SpotCheck` type to `types.ts`.

## Error handling

- A push failure or missing subscription doesn't break anything. The check still goes `pending` and shows on the page, and `was_notified` records the gap.
- Location permission denied or GPS timeout on confirm: the card shows the error and lets the employee retry within the window.
- A scheduling insert failure at check-in is logged and the shift goes ahead without checks. It never blocks punch-in.
- Cron endpoint auth failure: returns 401. Nothing is changed.
- If the 0045 table doesn't exist yet, the code detects it the same way as 0042 (`PGRST205`) and silently skips, so the app keeps working before the migration is applied.

## Setup (live DB)

1. Run `0045_attendance_spot_checks.sql` in the Supabase SQL editor after filling in the prod domain and secret in the cron block.
2. Add the `CRON_SECRET` env var in Vercel (Production) with the same value, then redeploy.
3. Ask iPhone site staff to add SiteHub to the home screen and allow notifications. Android users just need to allow notifications.

Exact click-by-click steps go in SETUP.md and are given to the user at hand-off.

## Verification

There's no test suite. Verify with:
1. `npm run build` (type gate) in the local mirror.
2. A manual end-to-end check on prod with a test site account: punch in, then set one check's `scheduled_at` to `now()` in SQL. Within 5 minutes a notification should arrive. Confirm it and check the On/Off site result. Repeat with no response and check that it becomes Missed and the admin gets an alert. Punch out and check that the remaining checks become Cancelled.
3. Punch in as office staff and check that no rows are created.
