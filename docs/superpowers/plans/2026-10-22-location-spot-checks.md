# Location Spot-Checks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At random times during a site employee's shift, push a "confirm your location" notification. Record each check as On site, Off site, Confirmed, Missed, Excused or Cancelled, and alert Super Admin/HR on a miss.

**Architecture:**
- **Pure logic** (`src/lib/attendance/spot-checks.ts`): plans the random times and judges on/off site.
- **Server store helper** (`src/lib/attendance/spot-check-store.ts`): schedules rows at site check-in and cancels them at check-out.
- **Server actions** (`src/app/attendance/spot-check-actions.ts`): confirm a check, excuse a missed one, and read checks.
- **Cron route** (`src/app/api/cron/spot-checks/route.ts`): Supabase `pg_cron` + `pg_net` call it every 5 minutes to fire due checks, expire missed ones and cancel stale ones.
- **UI:** an employee card on My Attendance, plus an admin section in the record dialog and a "Checks" column.

**Tech Stack:** Next.js 16 App Router (Route Handlers, Server Actions), React 19, Supabase (Postgres + RLS + pg_cron + pg_net), existing web-push dispatch, Tailwind v4, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-22-location-spot-checks-design.md`

## Global Constraints

- **Repo on Google Drive.** Edit files in `G:/My Drive/Keyvendors/Ad hocs/Construction Management Software/sitehub/` (canonical). **Never** run `npm install`/`build` there. Mirror before every build:
  `robocopy "G:\My Drive\Keyvendors\Ad hocs\Construction Management Software\sitehub" "C:\Users\dell\sitehub-build" /MIR /XD node_modules .next .git .claude /XF desktop.ini tsconfig.tsbuildinfo`
  then run `npm run build` in `C:\Users\dell\sitehub-build`.
- **No test suite exists.** The gates are `npm run build` (tsc), `npm run lint`, and the throwaway `tsx` check script in Task 1, which lives in the scratchpad and never enters the repo.
- **Git:** do **not** commit or push unless the user asks. "Commit" steps below are therefore "stage only / skip"; one commit happens at the end on request.
- Site staff only: a check-in with a `project_id`. `officeCheckInAction` is never touched.
- Location only (no selfie). One check per 2-hour block. 15-minute response window. First check ≥ 20 min after check-in. A block shorter than 30 min is dropped. A check must fire ≥ 15 min before `SHIFT_END_TIME` (18:00 IST).
- On-site rule: `distance ≤ radius + min(accuracy, 100)`. With no geofence, status = `confirmed`.
- Missed: Super Admin + HR get an in-app + push notification (`kind: 'delay'`). No automatic pay or status change.
- Reuse the existing notification kinds `info`/`delay`. **No** enum change.
- If table `attendance_spot_checks` is missing (error code `PGRST205`), every code path silently skips. The app must keep working before migration 0045 is applied.
- Employees must never be able to read their own **future** (`scheduled`) check times. This is enforced in RLS and in the read action.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `supabase/migrations/0045_attendance_spot_checks.sql` | Create | Table, indexes, RLS, pg_cron job |
| `src/lib/types.ts` | Modify | `SpotCheckStatus`, `SpotCheck` |
| `src/lib/data/mappers.ts` | Modify | `SpotCheckRow`, `mapSpotCheck` |
| `src/lib/attendance/spot-checks.ts` | Create | Pure: constants, `planSpotChecks`, `judgeSpotCheck`, `spotCheckDeadline`, `isValidPosition` |
| `src/lib/attendance/spot-check-store.ts` | Create | Server-only: `scheduleSpotChecks`, `cancelSpotChecks` |
| `src/app/attendance/actions.ts` | Modify | Call schedule on site check-in, cancel on check-out |
| `src/app/attendance/spot-check-actions.ts` | Create | `confirmSpotCheckAction`, `excuseSpotCheckAction`, `getSpotChecksAction`, `getSpotCheckSummaryAction` |
| `src/lib/notifications/dispatch.ts` | Modify | `await` web push so serverless (cron) doesn't drop it |
| `src/app/api/cron/spot-checks/route.ts` | Create | Fire / expire / cancel loop |
| `src/middleware.ts` | Modify | Let `/api/cron/*` through without a session |
| `src/lib/attendance/compute.ts` | Modify | `MyAttendanceData.pendingSpotCheck` |
| `src/lib/data/attendance.ts` | Modify | Load `pendingSpotCheck` (live + mock + no-ctx) |
| `src/components/attendance/use-geolocation.ts` | Modify | Export `geoErrorMessage` |
| `src/components/attendance/spot-check-card.tsx` | Create | Employee confirm card |
| `src/components/attendance/my-attendance.tsx` | Modify | Render the card |
| `src/components/attendance/spot-checks-section.tsx` | Create | Admin/employee list of checks + Excuse |
| `src/components/attendance/record-detail-dialog.tsx` | Modify | Render the section; `canExcuse` prop |
| `src/components/attendance/admin-attendance-tab.tsx` | Modify | "Checks" column; pass `canExcuse` |
| `SETUP.md`, `../PROJECT-MEMORY.md` | Modify | Apply steps + state |

---

### Task 1: Pure spot-check logic + types + mapper

**Files:**
- Modify: `src/lib/types.ts` (append after the `EmployeeAttendance` interface, ~line 549)
- Modify: `src/lib/data/mappers.ts` (append at end)
- Create: `src/lib/attendance/spot-checks.ts`
- Throwaway check: `<scratchpad>/spot-checks.check.ts` (not in repo)

**Interfaces:**
- Produces:
  - `type SpotCheckStatus = "scheduled"|"pending"|"on_site"|"off_site"|"confirmed"|"missed"|"excused"|"cancelled"`
  - `interface SpotCheck { id; attendanceId; userId; projectId: string|null; scheduledAt: string; notifiedAt: string; wasNotified: boolean|null; respondedAt: string; lat: number|null; lng: number|null; accuracy: number|null; distanceM: number|null; status: SpotCheckStatus; excuseNote: string }`
  - `interface SpotCheckRow` and `mapSpotCheck(r: SpotCheckRow): SpotCheck`
  - `SPOT_CHECK_BLOCK_MIN=120`, `SPOT_CHECK_WINDOW_MIN=15`, `SPOT_CHECK_FIRST_DELAY_MIN=20`, `SPOT_CHECK_MIN_BLOCK_MIN=30`, `SPOT_CHECK_GPS_SLACK_CAP_M=100`
  - `planSpotChecks(checkInAtIso: string, rand?: () => number): string[]`
  - `judgeSpotCheck(pos: {lat:number;lng:number;accuracy:number}, fence: SpotCheckFence|null): { status: "on_site"|"off_site"|"confirmed"; distanceM: number|null }`
  - `interface SpotCheckFence { lat: number|null; lng: number|null; radiusM: number|null }`
  - `spotCheckDeadline(notifiedAtIso: string): number` (epoch ms)
  - `isValidPosition(lat: number, lng: number, accuracy: number): boolean`

- [ ] **Step 1: Add types** to `src/lib/types.ts`, directly after the closing `}` of `export interface EmployeeAttendance`:

```ts
/** Random location spot-check during a site shift (migration 0045). */
export type SpotCheckStatus =
  | "scheduled"
  | "pending"
  | "on_site"
  | "off_site"
  | "confirmed"
  | "missed"
  | "excused"
  | "cancelled";

export interface SpotCheck {
  id: string;
  attendanceId: string;
  userId: string;
  projectId: string | null;
  scheduledAt: string;
  /** When the push actually went out ("" until fired). The 15-min window starts here. */
  notifiedAt: string;
  /** false = the user had no push subscription when it fired; null = not fired yet. */
  wasNotified: boolean | null;
  respondedAt: string;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  distanceM: number | null;
  status: SpotCheckStatus;
  excuseNote: string;
}
```

- [ ] **Step 2: Add the mapper** at the end of `src/lib/data/mappers.ts`. Add `SpotCheck` and `SpotCheckStatus` to the file's existing `import type { … } from "@/lib/types"` list.

```ts
export interface SpotCheckRow {
  id: string;
  attendance_id: string;
  user_id: string;
  project_id: string | null;
  scheduled_at: string;
  notified_at: string | null;
  was_notified: boolean | null;
  responded_at: string | null;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  distance_m: number | null;
  status: string;
  excuse_note: string | null;
}

export const mapSpotCheck = (r: SpotCheckRow): SpotCheck => ({
  id: r.id,
  attendanceId: r.attendance_id,
  userId: r.user_id,
  projectId: r.project_id ?? null,
  scheduledAt: r.scheduled_at,
  notifiedAt: r.notified_at ?? "",
  wasNotified: r.was_notified ?? null,
  respondedAt: r.responded_at ?? "",
  lat: r.lat ?? null,
  lng: r.lng ?? null,
  accuracy: r.accuracy ?? null,
  distanceM: r.distance_m ?? null,
  status: r.status as SpotCheckStatus,
  excuseNote: r.excuse_note ?? "",
});
```

- [ ] **Step 3: Write the throwaway check script first** (it should fail, because the module doesn't exist yet). Path: `C:\Users\dell\AppData\Local\Temp\claude\g--My-Drive-Keyvendors-Ad-hocs-Construction-Management-Software\187c8443-27a7-40db-a8b5-c6eadb263b4a\scratchpad\spot-checks.check.ts`

```ts
import assert from "node:assert/strict";
import {
  planSpotChecks,
  judgeSpotCheck,
  spotCheckDeadline,
  isValidPosition,
} from "C:/Users/dell/sitehub-build/src/lib/attendance/spot-checks";

const ist = (hhmm: string) => new Date(`2026-10-22T${hhmm}:00+05:30`).toISOString();
const istTime = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

// 9:40 check-in → window 10:00–17:45 → blocks 10-12, 12-14, 14-16, 16-17:45 = 4 checks
const low = planSpotChecks(ist("09:40"), () => 0);
assert.deepEqual(low.map(istTime), ["10:00", "12:00", "14:00", "16:00"]);
const high = planSpotChecks(ist("09:40"), () => 0.999999);
assert.deepEqual(high.map(istTime), ["11:59", "13:59", "15:59", "17:44"]);

// 17:00 check-in → window 17:20–17:45 (25 min) → none
assert.equal(planSpotChecks(ist("17:00")).length, 0);
// After shift end → none
assert.equal(planSpotChecks(ist("19:00")).length, 0);
// 16:00 → window 16:20–17:45 (85 min) → 1
assert.equal(planSpotChecks(ist("16:00")).length, 1);
// Every planned time is inside [checkIn+20, 17:45]
for (const t of planSpotChecks(ist("08:00"))) {
  assert.ok(t >= ist("08:20") && t <= ist("17:45"), t);
}

// judge: no fence → confirmed
assert.deepEqual(judgeSpotCheck({ lat: 28.6, lng: 77.3, accuracy: 10 }, null), { status: "confirmed", distanceM: null });
assert.equal(judgeSpotCheck({ lat: 28.6, lng: 77.3, accuracy: 10 }, { lat: null, lng: null, radiusM: null }).status, "confirmed");
// at centre → on_site
assert.equal(judgeSpotCheck({ lat: 28.6273, lng: 77.3714, accuracy: 10 }, { lat: 28.6273, lng: 77.3714, radiusM: 300 }).status, "on_site");
// ~1.1 km away, 300 m fence, 50 m accuracy → off_site
const far = judgeSpotCheck({ lat: 28.6373, lng: 77.3714, accuracy: 50 }, { lat: 28.6273, lng: 77.3714, radiusM: 300 });
assert.equal(far.status, "off_site");
assert.ok(far.distanceM! > 1000);
// Accuracy slack is capped at 100 m: ~500 m away, 300 m fence (+100 cap = 400), 5000 m accuracy → off_site
assert.equal(judgeSpotCheck({ lat: 28.6318, lng: 77.3714, accuracy: 5000 }, { lat: 28.6273, lng: 77.3714, radiusM: 300 }).status, "off_site");
// …but ~350 m away with 80 m accuracy (300 + 80 = 380) → on_site
assert.equal(judgeSpotCheck({ lat: 28.63045, lng: 77.3714, accuracy: 80 }, { lat: 28.6273, lng: 77.3714, radiusM: 300 }).status, "on_site");

assert.equal(spotCheckDeadline("2026-10-22T08:00:00.000Z"), Date.parse("2026-10-22T08:15:00.000Z"));
assert.equal(isValidPosition(28.6, 77.3, 10), true);
assert.equal(isValidPosition(NaN, 77.3, 10), false);
assert.equal(isValidPosition(28.6, 77.3, -1), false);
console.log("spot-checks: all checks passed");
```

- [ ] **Step 4: Run it and confirm it fails.** Mirror first (robocopy command from Global Constraints), then in `C:\Users\dell\sitehub-build` run:
  `npx --yes tsx --tsconfig tsconfig.json "<scratchpad>/spot-checks.check.ts"`
  Expected: an error that the module `spot-checks` cannot be found.

- [ ] **Step 5: Create `src/lib/attendance/spot-checks.ts`**

```ts
// Client-safe pure helpers for random location spot-checks (migration 0045).
// No I/O — scheduling/judging rules only, so they're easy to reason about.

import {
  haversineMeters,
  ORG_TIMEZONE,
  ORG_UTC_OFFSET,
  SHIFT_END_TIME,
} from "@/lib/attendance/compute";

const MIN = 60_000;

/** One random check inside each block of this many minutes. */
export const SPOT_CHECK_BLOCK_MIN = 120;
/** Minutes the employee has to confirm once the notification goes out. */
export const SPOT_CHECK_WINDOW_MIN = 15;
/** No check in the first minutes after punching in. */
export const SPOT_CHECK_FIRST_DELAY_MIN = 20;
/** A trailing block shorter than this is dropped. */
export const SPOT_CHECK_MIN_BLOCK_MIN = 30;
/** Max GPS-accuracy slack added to the fence radius, so a bad fix can't pass by itself. */
export const SPOT_CHECK_GPS_SLACK_CAP_M = 100;

export interface SpotCheckFence {
  lat: number | null;
  lng: number | null;
  radiusM: number | null;
}

function orgDateOf(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ORG_TIMEZONE }).format(new Date(iso));
}

/**
 * Random check times (ISO) for a site shift: one per 2-hour block between
 * check-in + 20 min and SHIFT_END_TIME − 15 min (so every response window
 * ends inside the shift). Empty when that window is under 30 minutes.
 */
export function planSpotChecks(checkInAtIso: string, rand: () => number = Math.random): string[] {
  const start = new Date(checkInAtIso).getTime() + SPOT_CHECK_FIRST_DELAY_MIN * MIN;
  const shiftEnd = new Date(`${orgDateOf(checkInAtIso)}T${SHIFT_END_TIME}:00${ORG_UTC_OFFSET}`).getTime();
  const end = shiftEnd - SPOT_CHECK_WINDOW_MIN * MIN;
  const times: string[] = [];
  for (let b = start; end - b >= SPOT_CHECK_MIN_BLOCK_MIN * MIN; b += SPOT_CHECK_BLOCK_MIN * MIN) {
    const blockEnd = Math.min(b + SPOT_CHECK_BLOCK_MIN * MIN, end);
    times.push(new Date(b + rand() * (blockEnd - b)).toISOString());
  }
  return times;
}

/** on_site / off_site against the project fence; "confirmed" when no fence is set. */
export function judgeSpotCheck(
  pos: { lat: number; lng: number; accuracy: number },
  fence: SpotCheckFence | null
): { status: "on_site" | "off_site" | "confirmed"; distanceM: number | null } {
  if (!fence || fence.lat == null || fence.lng == null || !fence.radiusM) {
    return { status: "confirmed", distanceM: null };
  }
  const distanceM = haversineMeters(pos.lat, pos.lng, fence.lat, fence.lng);
  const slack = Math.min(Math.max(pos.accuracy, 0), SPOT_CHECK_GPS_SLACK_CAP_M);
  return { status: distanceM <= fence.radiusM + slack ? "on_site" : "off_site", distanceM };
}

/** Epoch ms when a fired check stops accepting a response. */
export function spotCheckDeadline(notifiedAtIso: string): number {
  return new Date(notifiedAtIso).getTime() + SPOT_CHECK_WINDOW_MIN * MIN;
}

export function isValidPosition(lat: number, lng: number, accuracy: number): boolean {
  return (
    Number.isFinite(lat) && Math.abs(lat) <= 90 &&
    Number.isFinite(lng) && Math.abs(lng) <= 180 &&
    Number.isFinite(accuracy) && accuracy >= 0
  );
}
```

- [ ] **Step 6: Re-mirror, re-run the check script.** Expected: `spot-checks: all checks passed`. If the `high` assertion is off by a minute, it's a rounding issue in `istTime` (it truncates seconds). Check that each `high` value is `< blockEnd`, then adjust only the expected strings, not the logic.

- [ ] **Step 7: Type-check.** In the mirror, run `npx tsc --noEmit -p .`. Expected: exit 0.

---

### Task 2: Migration 0045

**Files:**
- Create: `supabase/migrations/0045_attendance_spot_checks.sql`

**Interfaces:**
- Produces: table `public.attendance_spot_checks` (columns exactly as `SpotCheckRow` plus `org_id`, `excused_by`, `created_at`), and the pg_cron job `sitehub-spot-checks` that POSTs to `/api/cron/spot-checks` with `Authorization: Bearer <CRON_SECRET>`.

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================================
-- 0045_attendance_spot_checks.sql — random location spot-checks for site staff.
-- At site check-in the app schedules one random check per 2-hour block; a
-- pg_cron job (below) calls /api/cron/spot-checks every 5 minutes to send due
-- checks as push notifications, expire unanswered ones (15 min) and alert
-- Super Admin/HR. See docs/superpowers/specs/2026-10-22-location-spot-checks-design.md
-- ============================================================================

create table if not exists public.attendance_spot_checks (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.orgs(id) on delete cascade,
  attendance_id  uuid not null references public.employee_attendance(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  project_id     uuid references public.projects(id) on delete set null,
  scheduled_at   timestamptz not null,
  notified_at    timestamptz,
  was_notified   boolean,
  responded_at   timestamptz,
  lat            double precision,
  lng            double precision,
  accuracy       real,
  distance_m     real,
  status         text not null default 'scheduled'
                 check (status in ('scheduled','pending','on_site','off_site','confirmed','missed','excused','cancelled')),
  excused_by     uuid references public.profiles(id) on delete set null,
  excuse_note    text,
  created_at     timestamptz not null default now()
);

create index if not exists attendance_spot_checks_due_idx
  on public.attendance_spot_checks (status, scheduled_at);
create index if not exists attendance_spot_checks_attendance_idx
  on public.attendance_spot_checks (attendance_id);
create index if not exists attendance_spot_checks_user_idx
  on public.attendance_spot_checks (user_id, status);

alter table public.attendance_spot_checks enable row level security;

-- Same privacy model as 0042: self + super_admin/hr. An employee can NOT see
-- their own not-yet-fired ('scheduled') checks, or the random times would be
-- predictable. No insert/update/delete policies: every write goes through
-- server code using the service-role client, which gates itself.
drop policy if exists asc_read on public.attendance_spot_checks;
create policy asc_read on public.attendance_spot_checks for select to authenticated
  using (
    public.is_org_member(org_id)
    and (
      (user_id = auth.uid() and status <> 'scheduled')
      or public.has_role(org_id, array['super_admin','hr'])
    )
  );

-- ----------------------------------------------------------------------------
-- Scheduler. BEFORE RUNNING: replace both REPLACE_ME values —
--   REPLACE_ME_DOMAIN  → the live site domain, e.g. sitehub.example.com
--   REPLACE_ME_SECRET  → the exact CRON_SECRET value set in Vercel
-- Re-running this block updates the existing job (same name).
-- ----------------------------------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'sitehub-spot-checks',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://REPLACE_ME_DOMAIN/api/cron/spot-checks',
    headers := jsonb_build_object(
      'Authorization', 'Bearer REPLACE_ME_SECRET',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ----------------------------------------------------------------------------
-- ROLLBACK:
--   select cron.unschedule('sitehub-spot-checks');
--   drop table public.attendance_spot_checks;
-- ----------------------------------------------------------------------------
```

- [ ] **Step 2: Sanity read.** Check that every column name matches `SpotCheckRow` in Task 1, and that the status values match `SpotCheckStatus` exactly.

---

### Task 3: Schedule on site check-in, cancel on check-out

**Files:**
- Create: `src/lib/attendance/spot-check-store.ts`
- Modify: `src/app/attendance/actions.ts` (`checkInAction` ~line 270–312, `checkOutAction` ~line 351–385)

**Interfaces:**
- Consumes: `planSpotChecks` (Task 1), table (Task 2)
- Produces: `scheduleSpotChecks(input: { orgId: string; userId: string; attendanceId: string; projectId: string; checkInAt: string }): Promise<void>` and `cancelSpotChecks(attendanceId: string): Promise<void>`. Both are best-effort and never throw.

- [ ] **Step 1: Create `src/lib/attendance/spot-check-store.ts`**

```ts
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { planSpotChecks } from "@/lib/attendance/spot-checks";

const TABLE = "attendance_spot_checks";

/**
 * Schedule a site shift's random location checks (0045). Best-effort: a
 * failure is logged and never blocks the check-in. Uses the service-role
 * client — the table has no insert policy by design.
 */
export async function scheduleSpotChecks(input: {
  orgId: string;
  userId: string;
  attendanceId: string;
  projectId: string;
  checkInAt: string;
}): Promise<void> {
  const times = planSpotChecks(input.checkInAt);
  if (times.length === 0) return;
  try {
    const { error } = await createAdminClient()
      .from(TABLE)
      .insert(
        times.map((t) => ({
          org_id: input.orgId,
          attendance_id: input.attendanceId,
          user_id: input.userId,
          project_id: input.projectId,
          scheduled_at: t,
          status: "scheduled",
        }))
      );
    // PGRST205 = table not there yet (0045 not applied) — skip silently.
    if (error && error.code !== "PGRST205") console.error("[spot-checks] schedule failed", error.message);
  } catch (err) {
    console.error("[spot-checks] schedule failed", err instanceof Error ? err.message : err);
  }
}

/** Punch-out: drop every check of this shift that hasn't been answered. */
export async function cancelSpotChecks(attendanceId: string): Promise<void> {
  try {
    const { error } = await createAdminClient()
      .from(TABLE)
      .update({ status: "cancelled" })
      .eq("attendance_id", attendanceId)
      .in("status", ["scheduled", "pending"]);
    if (error && error.code !== "PGRST205") console.error("[spot-checks] cancel failed", error.message);
  } catch (err) {
    console.error("[spot-checks] cancel failed", err instanceof Error ? err.message : err);
  }
}
```

- [ ] **Step 2: Wire into `checkInAction`.** Add the import near the other `@/lib` imports at the top of `src/app/attendance/actions.ts`:

```ts
import { cancelSpotChecks, scheduleSpotChecks } from "@/lib/attendance/spot-check-store";
```

Then, in `checkInAction`, directly after this existing line:
```ts
  await supabase.from("employee_attendance").update({ check_in_selfie_path: selfiePath }).eq("id", row.id);
```
insert:
```ts
  // Site shift → random location spot-checks (0045). Office punch-in never gets these.
  await scheduleSpotChecks({
    orgId: ctx.orgId,
    userId: ctx.userId,
    attendanceId: row.id,
    projectId: input.projectId,
    checkInAt: nowIso,
  });
```

- [ ] **Step 3: Wire into `checkOutAction`.** Directly after this existing line:
```ts
  if (error) return { error: error.message };
```
(the one following the `.update({ check_out_at: nowIso, … })` in `checkOutAction`), insert:
```ts
  await cancelSpotChecks(row.id as string);
```

- [ ] **Step 4: Type-check.** Mirror, then run `npx tsc --noEmit -p .`. Expected: exit 0.

---

### Task 4: Server actions — confirm, excuse, read

**Files:**
- Create: `src/app/attendance/spot-check-actions.ts`

**Interfaces:**
- Consumes: `judgeSpotCheck`, `spotCheckDeadline`, `isValidPosition` (Task 1); `mapSpotCheck`, `SpotCheckRow` (Task 1)
- Produces:
  - `confirmSpotCheckAction(id: string, pos: { lat: number; lng: number; accuracy: number }): Promise<{ status?: SpotCheckStatus; distanceM?: number | null; error?: string }>`
  - `excuseSpotCheckAction(id: string, note: string): Promise<{ id?: string; error?: string }>`
  - `getSpotChecksAction(attendanceId: string): Promise<SpotCheck[]>`: fired checks only (no `scheduled`, no `cancelled`), oldest first
  - `getSpotCheckSummaryAction(attendanceIds: string[]): Promise<Record<string, { total: number; ok: number; missed: number }>>`: super_admin/hr only; `ok` = on_site + confirmed + excused; `missed` = missed; `total` = all fired non-cancelled checks with a final status (pending excluded)

- [ ] **Step 1: Create the file**

```ts
"use server";

import { getAuthContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { logActivity } from "@/lib/activity/log";
import {
  isValidPosition,
  judgeSpotCheck,
  spotCheckDeadline,
  type SpotCheckFence,
} from "@/lib/attendance/spot-checks";
import { mapSpotCheck, type SpotCheckRow } from "@/lib/data/mappers";
import type { SpotCheck, SpotCheckStatus } from "@/lib/types";

const TABLE = "attendance_spot_checks";
/** Server-side grace on top of the 15-min window (clock skew / slow network). */
const CONFIRM_GRACE_MS = 60_000;

export async function confirmSpotCheckAction(
  id: string,
  pos: { lat: number; lng: number; accuracy: number }
): Promise<{ status?: SpotCheckStatus; distanceM?: number | null; error?: string }> {
  if (!isSupabaseConfigured()) return { status: "confirmed", distanceM: null };
  const ctx = await getAuthContext();
  if (!ctx?.orgId) return { error: "You must be signed in." };
  if (!isValidPosition(pos.lat, pos.lng, pos.accuracy)) {
    return { error: "Could not read a valid location. Enable location access and retry." };
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from(TABLE)
    .select("id, user_id, project_id, attendance_id, status, notified_at")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.user_id !== ctx.userId) return { error: "Location check not found." };
  if (row.status !== "pending" || !row.notified_at) return { error: "This location check is no longer open." };
  if (Date.now() > spotCheckDeadline(row.notified_at as string) + CONFIRM_GRACE_MS) {
    return { error: "Time's up — this location check has expired." };
  }

  let fence: SpotCheckFence | null = null;
  if (row.project_id) {
    const { data: p } = await admin
      .from("projects")
      .select("geofence_lat, geofence_lng, geofence_radius_m")
      .eq("id", row.project_id)
      .maybeSingle();
    if (p) fence = { lat: p.geofence_lat, lng: p.geofence_lng, radiusM: p.geofence_radius_m };
  }
  const verdict = judgeSpotCheck(pos, fence);

  const { data: updated, error } = await admin
    .from(TABLE)
    .update({
      status: verdict.status,
      responded_at: new Date().toISOString(),
      lat: pos.lat,
      lng: pos.lng,
      accuracy: pos.accuracy,
      distance_m: verdict.distanceM,
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  if (error) return { error: error.message };
  if (!updated?.length) return { error: "This location check is no longer open." };

  await logActivity({
    action: "updated",
    entityType: "attendance",
    entityId: row.attendance_id as string,
    summary:
      verdict.status === "off_site"
        ? `${ctx.name} answered a location check — off site (~${verdict.distanceM}m away)`
        : `${ctx.name} answered a location check — ${verdict.status === "on_site" ? "on site" : "confirmed"}`,
    meta: { spotCheckId: id, lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy },
  });

  return verdict;
}

export async function excuseSpotCheckAction(id: string, note: string): Promise<{ id?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { id };
  const ctx = await getAuthContext();
  if (!ctx?.orgId) return { error: "You must be signed in." };
  if (ctx.role !== "super_admin" && ctx.role !== "hr") return { error: "Only Super Admin or HR can excuse a check." };

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from(TABLE)
    .update({ status: "excused", excused_by: ctx.userId, excuse_note: note.trim() || null })
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .eq("status", "missed")
    .select("id, attendance_id");
  if (error) return { error: error.message };
  if (!updated?.length) return { error: "Only a missed check can be excused." };

  await logActivity({
    action: "updated",
    entityType: "attendance",
    entityId: updated[0].attendance_id as string,
    summary: `${ctx.name} excused a missed location check${note.trim() ? ` — ${note.trim()}` : ""}`,
    meta: { spotCheckId: id },
  });
  return { id };
}

/** Fired checks for one shift (RLS: self or super_admin/hr). Never returns future times. */
export async function getSpotChecksAction(attendanceId: string): Promise<SpotCheck[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("attendance_id", attendanceId)
    .not("status", "in", "(scheduled,cancelled)")
    .order("notified_at", { ascending: true });
  if (error) return [];
  return ((data ?? []) as SpotCheckRow[]).map(mapSpotCheck);
}

/** Per-shift tallies for the admin table's "Checks" column. */
export async function getSpotCheckSummaryAction(
  attendanceIds: string[]
): Promise<Record<string, { total: number; ok: number; missed: number }>> {
  const out: Record<string, { total: number; ok: number; missed: number }> = {};
  if (!isSupabaseConfigured() || attendanceIds.length === 0) return out;
  const ctx = await getAuthContext();
  if (ctx?.role !== "super_admin" && ctx?.role !== "hr") return out;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("attendance_id, status")
    .in("attendance_id", attendanceIds)
    .in("status", ["on_site", "off_site", "confirmed", "missed", "excused"]);
  if (error) return out;
  for (const r of data ?? []) {
    const k = r.attendance_id as string;
    const s = (out[k] ??= { total: 0, ok: 0, missed: 0 });
    s.total += 1;
    if (r.status === "missed") s.missed += 1;
    else if (r.status !== "off_site") s.ok += 1;
  }
  return out;
}
```

- [ ] **Step 2: Type-check.** Mirror, then run `npx tsc --noEmit -p .`. Expected: exit 0.

---

### Task 5: Cron route + middleware + reliable push

**Files:**
- Create: `src/app/api/cron/spot-checks/route.ts`
- Modify: `src/middleware.ts:43`
- Modify: `src/lib/notifications/dispatch.ts:86-93` and `:128-135`

**Interfaces:**
- Consumes: `dispatchNotification` (existing), `formatTime` (existing in compute), `SPOT_CHECK_WINDOW_MIN` (Task 1)
- Produces: `POST /api/cron/spot-checks`, which returns `200 { ok, fired, missed, cancelled }`, `401` on a bad secret, and `200 { ok:true, skipped }` in mock mode or when the table is missing.

- [ ] **Step 1: Make web push awaited** in `src/lib/notifications/dispatch.ts`. Without this, a serverless function (the cron route) can return before the push is sent. In **both** places, replace

```ts
          sendWebPushBatch(subs, {
```
…`}).catch((e) => console.warn("[notifications] web push delivery error:", e));`

with an awaited call. First occurrence (targeted recipients):

```ts
          await sendWebPushBatch(subs, {
            title: input.title,
            body: input.body,
            href: input.href,
            tag: `${input.kind}-${Date.now()}`,
          }).catch((e) => console.warn("[notifications] web push delivery error:", e));
```

Second occurrence (broadcast):

```ts
            await sendWebPushBatch(targets, {
              title: input.title,
              body: input.body,
              href: input.href,
              tag: `${input.kind}-${Date.now()}`,
            }).catch((e) => console.warn("[notifications] web push delivery error:", e));
```

(`sendWebPushBatch` is documented as never-throwing, and the `.catch` stays as a backstop, so callers are unaffected apart from waiting for delivery.)

- [ ] **Step 2: Let the cron path through middleware.** In `src/middleware.ts` replace

```ts
  const isPublic = path === "/login" || path === "/reset-password";
```
with
```ts
  // /api/cron/* is called by Supabase pg_cron with no session — those
  // routes authenticate themselves with CRON_SECRET.
  const isPublic = path === "/login" || path === "/reset-password" || path.startsWith("/api/cron/");
```

- [ ] **Step 3: Create `src/app/api/cron/spot-checks/route.ts`**

```ts
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dispatchNotification } from "@/lib/notifications/dispatch";
import { formatTime } from "@/lib/attendance/compute";
import { SPOT_CHECK_WINDOW_MIN } from "@/lib/attendance/spot-checks";

export const dynamic = "force-dynamic";

const TABLE = "attendance_spot_checks";

interface ActiveRow {
  id: string;
  org_id: string;
  user_id: string;
  project_id: string | null;
  attendance_id: string;
  status: "scheduled" | "pending";
  scheduled_at: string;
  notified_at: string | null;
  was_notified: boolean | null;
}

/**
 * Called every 5 min by Supabase pg_cron (migration 0045). Each run:
 * 1. cancels checks whose shift is already closed,
 * 2. fires due 'scheduled' checks → 'pending' + push to the employee,
 * 3. expires 'pending' checks past the 15-min window → 'missed' + alert
 *    Super Admin/HR.
 * Every update is guarded on the current status, so overlapping runs can't
 * double-send.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!isSupabaseConfigured()) return Response.json({ ok: true, skipped: "mock" });

  const admin = createAdminClient();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  const { data, error } = await admin
    .from(TABLE)
    .select("id, org_id, user_id, project_id, attendance_id, status, scheduled_at, notified_at, was_notified")
    .in("status", ["scheduled", "pending"]);
  if (error) {
    if (error.code === "PGRST205") return Response.json({ ok: true, skipped: "table pending" });
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  const rows = (data ?? []) as ActiveRow[];
  if (rows.length === 0) return Response.json({ ok: true, fired: 0, missed: 0, cancelled: 0 });

  // 1. Shifts already closed (punch-out, closed-previous-shift, admin edit).
  const attIds = Array.from(new Set(rows.map((r) => r.attendance_id)));
  const { data: atts } = await admin.from("employee_attendance").select("id, check_out_at").in("id", attIds);
  const closed = new Set((atts ?? []).filter((a) => a.check_out_at).map((a) => a.id as string));
  const live = rows.filter((r) => !closed.has(r.attendance_id));
  let cancelled = 0;
  if (closed.size) {
    const { data: c } = await admin
      .from(TABLE)
      .update({ status: "cancelled" })
      .in("attendance_id", Array.from(closed))
      .in("status", ["scheduled", "pending"])
      .select("id");
    cancelled = c?.length ?? 0;
  }

  // 2. Fire due checks.
  const due = live.filter((r) => r.status === "scheduled" && Date.parse(r.scheduled_at) <= now);
  let fired = 0;
  if (due.length) {
    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("user_id")
      .in("user_id", Array.from(new Set(due.map((r) => r.user_id))));
    const hasPush = new Set((subs ?? []).map((s) => s.user_id as string));
    for (const r of due) {
      const { data: u } = await admin
        .from(TABLE)
        .update({ status: "pending", notified_at: nowIso, was_notified: hasPush.has(r.user_id) })
        .eq("id", r.id)
        .eq("status", "scheduled")
        .select("id");
      if (!u?.length) continue;
      fired += 1;
      await dispatchNotification({
        orgId: r.org_id,
        userIds: [r.user_id],
        kind: "info",
        title: "Location check",
        body: `Tap to confirm you're on site — within ${SPOT_CHECK_WINDOW_MIN} minutes.`,
        href: "/attendance",
      });
    }
  }

  // 3. Expire unanswered checks.
  const windowMs = SPOT_CHECK_WINDOW_MIN * 60_000;
  const expired = live.filter(
    (r) => r.status === "pending" && r.notified_at && Date.parse(r.notified_at) + windowMs < now
  );
  let missed = 0;
  if (expired.length) {
    const userIds = Array.from(new Set(expired.map((r) => r.user_id)));
    const projectIds = Array.from(new Set(expired.map((r) => r.project_id).filter(Boolean))) as string[];
    const [{ data: people }, { data: projects }] = await Promise.all([
      admin.from("profiles").select("id, name").in("id", userIds),
      projectIds.length
        ? admin.from("projects").select("id, name").in("id", projectIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);
    const nameOf = new Map((people ?? []).map((p) => [p.id as string, (p.name as string) || "An employee"]));
    const projectOf = new Map((projects ?? []).map((p) => [p.id as string, p.name as string]));

    for (const r of expired) {
      const { data: u } = await admin
        .from(TABLE)
        .update({ status: "missed" })
        .eq("id", r.id)
        .eq("status", "pending")
        .select("id");
      if (!u?.length) continue;
      missed += 1;
      const site = r.project_id ? projectOf.get(r.project_id) ?? "site" : "site";
      await dispatchNotification({
        orgId: r.org_id,
        roles: ["super_admin", "hr"],
        kind: "delay",
        title: "Missed location check",
        body: `${nameOf.get(r.user_id) ?? "An employee"} didn't confirm their location at ${site} (sent ${formatTime(r.notified_at as string)})${
          r.was_notified === false ? " — notifications are off on their phone" : ""
        }.`,
        href: "/payroll",
      });
    }
  }

  return Response.json({ ok: true, fired, missed, cancelled });
}
```

- [ ] **Step 4: Type-check + build.** Mirror, then run `npm run build`. Expected: build succeeds and lists `ƒ /api/cron/spot-checks` among the routes.

- [ ] **Step 5: Local smoke test of the auth gate.** In the mirror, start `npm run dev`, then run `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/cron/spot-checks`. Expected: `401`, because no `CRON_SECRET` is set locally. Stop the dev server.

---

### Task 6: Employee "Location check" card

**Files:**
- Modify: `src/lib/attendance/compute.ts` (`MyAttendanceData`, ~line 6–50)
- Modify: `src/lib/data/attendance.ts` (`getMyAttendancePage`, ~lines 131–275)
- Modify: `src/components/attendance/use-geolocation.ts:22` (export `geoErrorMessage`)
- Create: `src/components/attendance/spot-check-card.tsx`
- Modify: `src/components/attendance/my-attendance.tsx` (~line 104)

**Interfaces:**
- Consumes: `SpotCheck`, `mapSpotCheck`, `SpotCheckRow` (Task 1); `confirmSpotCheckAction` (Task 4); `spotCheckDeadline` (Task 1)
- Produces: `MyAttendanceData.pendingSpotCheck: SpotCheck | null` and `<SpotCheckCard check={SpotCheck} />`

- [ ] **Step 1: Extend `MyAttendanceData`** in `src/lib/attendance/compute.ts`. Change the type import line to

```ts
import type { EmployeeAttendance, Project, Role, SpotCheck } from "@/lib/types";
```
and add this field inside `export interface MyAttendanceData { … }`, right after `unclosedPreviousShift`:
```ts
  /** A fired, still-open random location check (0045) — null if none. */
  pendingSpotCheck: SpotCheck | null;
```

- [ ] **Step 2: Populate it** in `src/lib/data/attendance.ts`:
  - Add `mapSpotCheck` and `type SpotCheckRow` to the existing import from `./mappers` (or `@/lib/data/mappers`; match the file's existing style).
  - In the **mock** return object and the **no-ctx** return object, add `pendingSpotCheck: null,` after `unclosedPreviousShift: null,`.
  - In the live branch's `Promise.all([...])`, append a 10th element, and extend the destructuring to `[..., holidaysRes, pendingSpotRes]`:

```ts
    supabase
      .from("attendance_spot_checks")
      .select("*")
      .eq("user_id", ctx.userId)
      .eq("status", "pending")
      .order("notified_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
```
  - In the live return object, after `unclosedPreviousShift: …,` add:
```ts
    // Errors (incl. 0045 not applied yet) just mean "no pending check".
    pendingSpotCheck: pendingSpotRes?.data ? mapSpotCheck(pendingSpotRes.data as SpotCheckRow) : null,
```

- [ ] **Step 3: Export the geolocation error helper.** In `src/components/attendance/use-geolocation.ts`, change `function geoErrorMessage(` to `export function geoErrorMessage(`.

- [ ] **Step 4: Create `src/components/attendance/spot-check-card.tsx`**

```tsx
"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/attendance/compute";
import { spotCheckDeadline } from "@/lib/attendance/spot-checks";
import { confirmSpotCheckAction } from "@/app/attendance/spot-check-actions";
import type { SpotCheck, SpotCheckStatus } from "@/lib/types";
import { geoErrorMessage } from "./use-geolocation";

function readPosition(): Promise<{ lat: number; lng: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("This device does not support location."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        }),
      (err) => reject(new Error(geoErrorMessage(err))),
      // maximumAge 0: a spot-check must be a fresh fix, not a cached one.
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

/**
 * Random location spot-check (0045): shown on My Attendance while a fired
 * check is open. One tap reads a fresh GPS fix and confirms it.
 */
export function SpotCheckCard({ check }: { check: SpotCheck }) {
  const deadline = spotCheckDeadline(check.notifiedAt);
  const [now, setNow] = React.useState(() => Date.now());
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [result, setResult] = React.useState<{ status: SpotCheckStatus; distanceM: number | null } | null>(null);

  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      const pos = await readPosition();
      const res = await confirmSpotCheckAction(check.id, pos);
      if (res.error) setError(res.error);
      else if (res.status) setResult({ status: res.status, distanceM: res.distanceM ?? null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read your location.");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const off = result.status === "off_site";
    return (
      <div
        className={`flex items-start gap-2 rounded-lg border p-4 text-sm ${
          off ? "border-warning/40 bg-warning/10" : "border-success/40 bg-success/10"
        }`}
      >
        {off ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        )}
        <p>
          {off
            ? `Location recorded — you're about ${formatDistance(result.distanceM ?? 0)} from the site.`
            : result.status === "on_site"
            ? "Location confirmed — you're on site. Thanks!"
            : "Location confirmed. Thanks!"}
        </p>
      </div>
    );
  }

  const remaining = Math.max(0, deadline - now);
  if (remaining === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        This location check has expired.
      </div>
    );
  }
  const mm = Math.floor(remaining / 60000);
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");

  return (
    <div className="space-y-3 rounded-lg border-2 border-primary bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <p className="font-semibold">Location check</p>
          <p className="text-sm text-muted-foreground">
            Confirm you&apos;re on site by {formatTime(new Date(deadline).toISOString())} ·{" "}
            <span className="tabular-nums">
              {mm}:{ss}
            </span>{" "}
            left
          </p>
        </div>
      </div>
      <Button size="lg" className="w-full" onClick={confirm} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
        {busy ? "Getting location…" : "Confirm Location"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 5: Render it** in `src/components/attendance/my-attendance.tsx`. Add the import next to the other local imports:

```tsx
import { SpotCheckCard } from "./spot-check-card";
```
Then, directly after the `{data.unclosedPreviousShift && ( … )}` block and before `<CheckInCard`, insert:
```tsx
        {data.pendingSpotCheck && <SpotCheckCard check={data.pendingSpotCheck} />}
```

- [ ] **Step 6: Build + lint.** Mirror, then run `npm run build && npm run lint`. Expected: both pass with no new errors in the touched files. If tsc reports another place that constructs `MyAttendanceData`, add `pendingSpotCheck: null` there.

---

### Task 7: Admin view — record dialog section, Excuse, Checks column

**Files:**
- Create: `src/components/attendance/spot-checks-section.tsx`
- Modify: `src/components/attendance/record-detail-dialog.tsx`
- Modify: `src/components/attendance/admin-attendance-tab.tsx` (employee-view table ~lines 735–800; dialog render ~line 846)

**Interfaces:**
- Consumes: `getSpotChecksAction`, `excuseSpotCheckAction`, `getSpotCheckSummaryAction` (Task 4)
- Produces: `<SpotChecksSection attendanceId={string} canExcuse={boolean} />` and the new `RecordDetailDialog` prop `canExcuse?: boolean` (default false)

- [ ] **Step 1: Create `src/components/attendance/spot-checks-section.tsx`**

```tsx
"use client";

import * as React from "react";
import { ExternalLink, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/attendance/compute";
import { excuseSpotCheckAction, getSpotChecksAction } from "@/app/attendance/spot-check-actions";
import type { SpotCheck, SpotCheckStatus } from "@/lib/types";

const STATUS: Partial<Record<SpotCheckStatus, { label: string; variant: "success" | "warning" | "destructive" | "muted" | "outline" }>> = {
  pending: { label: "Waiting", variant: "outline" },
  on_site: { label: "On site", variant: "success" },
  confirmed: { label: "Confirmed", variant: "success" },
  off_site: { label: "Off site", variant: "warning" },
  missed: { label: "Missed", variant: "destructive" },
  excused: { label: "Excused", variant: "muted" },
};

/** Random location spot-checks (0045) for one shift, inside the record dialog. */
export function SpotChecksSection({ attendanceId, canExcuse }: { attendanceId: string; canExcuse: boolean }) {
  const [checks, setChecks] = React.useState<SpotCheck[]>([]);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    setChecks([]);
    getSpotChecksAction(attendanceId).then(setChecks);
  }, [attendanceId]);

  async function excuse(id: string) {
    const note = window.prompt("Reason for excusing (optional), e.g. no signal at site:") ?? null;
    if (note === null) return;
    setBusyId(id);
    setError("");
    const res = await excuseSpotCheckAction(id, note);
    setBusyId(null);
    if (res.error) setError(res.error);
    else setChecks((prev) => prev.map((c) => (c.id === id ? { ...c, status: "excused", excuseNote: note.trim() } : c)));
  }

  if (checks.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <MapPin className="h-3.5 w-3.5" /> Location Spot-Checks
      </p>
      <div className="divide-y divide-border rounded-lg border border-border">
        {checks.map((c) => {
          const meta = STATUS[c.status];
          return (
            <div key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <span className="w-16 tabular-nums">{formatTime(c.notifiedAt)}</span>
              {meta && <Badge variant={meta.variant}>{meta.label}</Badge>}
              {c.distanceM != null && c.status === "off_site" && (
                <span className="text-xs text-muted-foreground">
                  {c.distanceM >= 1000 ? `${(c.distanceM / 1000).toFixed(1)} km` : `${c.distanceM} m`} away
                </span>
              )}
              {c.status === "missed" && c.wasNotified === false && (
                <span className="text-xs text-muted-foreground">notifications off</span>
              )}
              {c.status === "excused" && c.excuseNote && (
                <span className="text-xs text-muted-foreground">{c.excuseNote}</span>
              )}
              <span className="ml-auto flex items-center gap-2">
                {c.lat != null && c.lng != null && (
                  <a
                    href={`https://maps.google.com/?q=${c.lat},${c.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Map
                  </a>
                )}
                {canExcuse && c.status === "missed" && (
                  <Button size="sm" variant="outline" disabled={busyId === c.id} onClick={() => excuse(c.id)}>
                    Excuse
                  </Button>
                )}
              </span>
            </div>
          );
        })}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
```

> Note: `window.prompt` is acceptable here. It matches the low-ceremony admin UX elsewhere and avoids a new dialog component.

- [ ] **Step 2: Render it in `RecordDetailDialog`.** In `src/components/attendance/record-detail-dialog.tsx`:
  - Add the import: `import { SpotChecksSection } from "./spot-checks-section";`
  - Add a prop: in the destructured params add `canExcuse = false,`, and in the props type add `canExcuse?: boolean;`
  - Directly before `{history.length > 0 && (`, insert:

```tsx
        {!isOffice && !isDeclarative && <SpotChecksSection attendanceId={record.id} canExcuse={canExcuse} />}
```

- [ ] **Step 3: Pass `canExcuse` from the admin tab.** In `src/components/attendance/admin-attendance-tab.tsx`, in the `<RecordDetailDialog … showName />` render (~line 846), add the prop `canExcuse` (true). This tab is only reachable by super_admin/hr, and the server action re-checks the role anyway.

- [ ] **Step 4: Add the "Checks" column** to the employee-view table in `admin-attendance-tab.tsx`:
  - Add the import: `import { getSpotCheckSummaryAction } from "@/app/attendance/spot-check-actions";`
  - Inside the component, after `employeeRecords` is defined, add:

```tsx
  const [checkSummary, setCheckSummary] = React.useState<
    Record<string, { total: number; ok: number; missed: number }>
  >({});
  const siteRecordIds = React.useMemo(
    () => employeeRecords.filter((r) => r.status === "present" && r.projectId).map((r) => r.id),
    [employeeRecords]
  );
  const siteRecordKey = siteRecordIds.join(",");
  React.useEffect(() => {
    if (!siteRecordKey) {
      setCheckSummary({});
      return;
    }
    getSpotCheckSummaryAction(siteRecordKey.split(",")).then(setCheckSummary);
  }, [siteRecordKey]);
```
  - In the employee-view `<TableHeader>`, insert `<TableHead>Checks</TableHead>` between `<TableHead>Source</TableHead>` and the trailing `<TableHead />`.
  - Change the empty-state `colSpan={8}` to `colSpan={9}`.
  - In each row, insert a new cell between the Source `<TableCell>` and the actions `<TableCell>`:

```tsx
                        <TableCell>
                          {(() => {
                            const s = checkSummary[record.id];
                            if (!s || s.total === 0) return <span className="text-muted-foreground">—</span>;
                            return (
                              <Badge
                                variant={s.missed > 0 ? "destructive" : s.ok === s.total ? "success" : "warning"}
                                title={`${s.ok} confirmed/on site, ${s.total - s.ok - s.missed} off site, ${s.missed} missed`}
                              >
                                {s.ok}/{s.total}
                              </Badge>
                            );
                          })()}
                        </TableCell>
```

- [ ] **Step 5: Build + lint.** Mirror, then run `npm run build && npm run lint`. Expected: pass. If `employeeRecords` is defined *after* an early return or inside a conditional, place the new hooks right after its definition but before any early `return`. Hooks must not be conditional.

---

### Task 8: Docs, final build, hand-off

**Files:**
- Modify: `SETUP.md` (append a section)
- Modify: `../PROJECT-MEMORY.md` (append to open items / live-DB facts)

- [ ] **Step 1: Append to `SETUP.md`**

```markdown
## Location spot-checks (migration 0045)

Random "confirm your location" checks for **site** staff (one per ~2-hour block, 15 min to answer; a miss alerts Super Admin/HR).

1. **Pick a secret**: any long random string (e.g. from a password generator). This is `CRON_SECRET`.
2. **Vercel** → Project → Settings → Environment Variables → add `CRON_SECRET` = that string (Production) → Save → Deployments → ⋯ on the latest → **Redeploy**.
3. **Supabase** → SQL Editor → paste `supabase/migrations/0045_attendance_spot_checks.sql` → replace `REPLACE_ME_DOMAIN` with the live domain (no `https://`, no trailing `/`) and `REPLACE_ME_SECRET` with the same secret → **Run**.
4. Verify: SQL Editor → `select * from cron.job;` shows `sitehub-spot-checks`; after 5 min, `select status_code, content from net._http_response order by created desc limit 3;` shows `200` responses.
5. Staff: Android — allow notifications when SiteHub asks. iPhone — Safari → Share → **Add to Home Screen**, open SiteHub from that icon, allow notifications.

Rollback: `select cron.unschedule('sitehub-spot-checks'); drop table public.attendance_spot_checks;`
```

- [ ] **Step 2: Append to `../PROJECT-MEMORY.md`**: one bullet stating that "Location spot-checks (0045) are built and that **0045 + the `CRON_SECRET` env var are pending** on the live DB/Vercel", with a pointer to the SETUP.md section. Also a bullet saying that live location tracking is now site-only (office check-ins are never tracked).

- [ ] **Step 3: Final gate.** Mirror, then run `npm run build && npm run lint`. Expected: pass.

- [ ] **Step 4: Hand off to the user** (a non-developer, so exact steps): the SETUP.md steps 1–5 above, plus this production test:
  1. Log in as a test **site** employee on a phone and punch in.
  2. Supabase SQL Editor: `update attendance_spot_checks set scheduled_at = now() where status = 'scheduled' and user_id = (select id from profiles where name = '<test name>') and scheduled_at = (select min(scheduled_at) from attendance_spot_checks where status='scheduled');`
  3. Within 5 min the phone gets "Location check". Tap it, tap **Confirm Location**, and see the result.
  4. Repeat step 2 and ignore it. About 20 min later, the admin gets "Missed location check", and Payroll → Attendance → employee view shows a red badge in **Checks**. Open the record and click **Excuse**.
  5. Punch out. `select status, count(*) from attendance_spot_checks group by 1;` shows the remaining checks as `cancelled`.
  6. Punch in as an **office** employee. No rows are created for them.

- [ ] **Step 5: Ask the user** whether to commit and push (together with the earlier office-tracking fix). Only on a yes: `gh auth switch --user Kevendors`, then in `sitehub/` stage the listed files, commit with the message `feat(attendance): random location spot-checks for site staff` plus the Co-Authored-By trailer, and push.
