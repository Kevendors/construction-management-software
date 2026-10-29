"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, List } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  minutesBetween,
  orgThisMonth,
  orgToday,
  overtimeOf,
  type MyAttendanceData,
} from "@/lib/attendance/compute";
import { currentProjectIdFrom, isSiteFlowShift, OFFICE_SITE, OFFICE_SITE_NAME } from "@/lib/attendance/site-visits";
import type { EmployeeAttendance } from "@/lib/types";
import { CheckInCard } from "./check-in-card";
import { CheckInFlow, type FlowMode, type FlowSuccess } from "./check-in-flow";
import { OfficeCheckInFlow } from "./office-check-in-flow";
import { HistoryCalendar } from "./history-calendar";
import { HistoryList } from "./history-list";
import { MonthlySummary } from "./monthly-summary";
import { SpotCheckCard } from "./spot-check-card";
import { UnclosedShiftAlert } from "./unclosed-shift-alert";
import { useLiveTracking } from "./use-live-tracking";
import { LiveTrackingStatus } from "./live-tracking-status";

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function MyAttendance({ data }: { data: MyAttendanceData }) {
  const router = useRouter();
  const [view, setView] = React.useState<"calendar" | "list">("calendar");
  const [flowMode, setFlowMode] = React.useState<FlowMode | null>(null);
  // Optimistic override so the card flips immediately (and mock mode, whose
  // actions are no-ops, still demos the full flow until the next reload).
  const [localToday, setLocalToday] = React.useState<EmployeeAttendance | null>(null);

  const today = localToday ?? data.today;
  // 0050 addendum: a Site member allowed to use "Office" as a site — their
  // office check-in (project_id null) is still a site-flow shift.
  const worksFromOffice = data.canWorkFromOffice && !data.isOffice;
  const isOpenSelfShift = Boolean(today && today.source === "self" && today.checkInAt && !today.checkOutAt);
  // Switch Site (0050): server visits plus any just made here that the
  // refreshed data doesn't include yet (always the case in mock mode).
  const [localVisits, setLocalVisits] = React.useState<MyAttendanceData["todayVisits"]>([]);
  const todayVisits = React.useMemo(() => {
    const serverIds = new Set(data.todayVisits.map((v) => v.id));
    return [...data.todayVisits, ...localVisits.filter((v) => !serverIds.has(v.id))].sort((a, b) =>
      a.arrivedAt.localeCompare(b.arrivedAt)
    );
  }, [data.todayVisits, localVisits]);
  // An open self-punched shift closes with the flow it was opened in, decided
  // from the row itself (project, check-in selfie, visits) — so a Team-page
  // Office/Site or "Can work from office" change mid-shift can't strand it;
  // otherwise the Team-page setting decides.
  const usesSiteFlow =
    isOpenSelfShift && today
      ? isSiteFlowShift(
          { projectId: today.projectId || null, checkInSelfiePath: today.checkInSelfiePath || null },
          todayVisits.length,
          worksFromOffice
        )
      : data.usesSiteFlow;
  const isOpenSiteShift = isOpenSelfShift && usesSiteFlow;
  // Current site: latest visit, else today's project; null = the Office
  // (a null-project visit counts as the Office only while allowed — same
  // rule as the server).
  const currentProjectId = isOpenSiteShift
    ? currentProjectIdFrom(todayVisits, today?.projectId || null, worksFromOffice)
    : null;
  const latestVisit = [...todayVisits].reverse().find((v) => (v.projectId || null) === currentProjectId);
  const currentSite =
    isOpenSiteShift && today
      ? latestVisit
        ? { name: latestVisit.projectName, since: latestVisit.arrivedAt }
        : {
            name: !currentProjectId
              ? OFFICE_SITE_NAME
              : data.todayProjectName ||
                data.assignedProjects.find((p) => p.id === today.projectId)?.name ||
                "Your site",
            since: today.checkInAt,
          }
      : null;
  // Site staff only — and only while at a project: an office check-in, or a
  // hybrid member currently at the Office, has nothing to track.
  const isTracking = isOpenSiteShift && Boolean(currentProjectId) && !data.isOffice;
  const tracking = useLiveTracking(isTracking);
  // Site staff only (the explicit Team-page Office/Site setting).
  const canSwitchSite = isOpenSiteShift && !data.isOffice;
  const isCurrentMonth = data.month === orgThisMonth();
  const records = React.useMemo(() => {
    if (!localToday || !isCurrentMonth) return data.records;
    const rest = data.records.filter((r) => r.date !== localToday.date);
    return [localToday, ...rest];
  }, [data.records, localToday, isCurrentMonth]);

  const monthLabel = new Date(`${data.month}-01T00:00:00`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  function handleSuccess(result: FlowSuccess) {
    if (flowMode === "switch") {
      setLocalVisits((prev) => [
        ...prev,
        {
          id: result.id && result.id !== "mock" ? result.id : `local-${result.at}`,
          projectId: result.projectId === OFFICE_SITE ? null : result.projectId,
          projectName:
            result.projectId === OFFICE_SITE
              ? OFFICE_SITE_NAME
              : data.assignedProjects.find((p) => p.id === result.projectId)?.name ?? "New site",
          arrivedAt: result.at,
        },
      ]);
    } else if (flowMode === "in") {
      setLocalToday({
        id: `local-${result.at}`,
        userId: "",
        employeeId: data.employeeId,
        userName: data.userName,
        projectId: result.projectId === OFFICE_SITE ? "" : result.projectId,
        date: orgToday(),
        checkInAt: result.at,
        checkInLat: result.lat,
        checkInLng: result.lng,
        // Placeholder so a just-made SITE check-in stays on the site flow
        // (isSiteFlowShift keys on it); an office punch never has a selfie.
        checkInSelfiePath: usesSiteFlow ? "local" : "",
        checkOutAt: "",
        checkOutLat: null,
        checkOutLng: null,
        checkOutSelfiePath: "",
        totalMinutes: 0,
        overtimeMinutes: 0,
        source: "self",
        markedByName: "",
        note: "",
        status: "present",
      });
    } else if (today) {
      const total = minutesBetween(today.checkInAt, result.at);
      setLocalToday({
        ...today,
        checkOutAt: result.at,
        checkOutLat: result.lat,
        checkOutLng: result.lng,
        totalMinutes: total,
        overtimeMinutes: overtimeOf(total),
      });
    }
    router.refresh();
  }

  return (
    <>
      <PageHeader
        title="My Attendance"
        description={
          data.employeeId ? `${data.userName} · ${data.employeeId}` : data.userName
        }
      />

      <div className="mx-auto max-w-xl space-y-4">
        {data.unclosedPreviousShift && (
          <UnclosedShiftAlert shift={data.unclosedPreviousShift} />
        )}

        {data.pendingSpotCheck && <SpotCheckCard key={data.pendingSpotCheck.id} check={data.pendingSpotCheck} />}

        <CheckInCard
          today={today}
          usesSiteFlow={usesSiteFlow}
          currentSite={currentSite}
          canSwitchSite={canSwitchSite}
          onStart={setFlowMode}
        />

        <LiveTrackingStatus status={tracking.status} lastError={tracking.lastError} />

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Monthly Summary</CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Previous month"
                onClick={() => router.push(`/attendance?month=${shiftMonth(data.month, -1)}`)}
              >
                <ChevronLeft />
              </Button>
              <span className="min-w-28 text-center text-sm font-medium">{monthLabel}</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Next month"
                disabled={isCurrentMonth}
                onClick={() => router.push(`/attendance?month=${shiftMonth(data.month, 1)}`)}
              >
                <ChevronRight />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <MonthlySummary records={records} month={data.month} isOffice={data.isOffice} holidays={data.holidays} weekOff={data.weekOff} startDate={data.startDate} />
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={view === "calendar" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView("calendar")}
              >
                <CalendarDays /> Calendar
              </Button>
              <Button
                variant={view === "list" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView("list")}
              >
                <List /> List
              </Button>
            </div>
            {view === "calendar" ? (
              <HistoryCalendar records={records} month={data.month} isOffice={data.isOffice} holidays={data.holidays} weekOff={data.weekOff} startDate={data.startDate} />
            ) : (
              <HistoryList records={records} month={data.month} isOffice={data.isOffice} holidays={data.holidays} weekOff={data.weekOff} startDate={data.startDate} />
            )}
          </CardContent>
        </Card>
      </div>

      {usesSiteFlow ? (
        <CheckInFlow
          open={flowMode !== null}
          mode={flowMode ?? "in"}
          projects={data.assignedProjects}
          activeProjectId={isOpenSiteShift ? currentProjectId ?? OFFICE_SITE : today?.projectId}
          canWorkFromOffice={worksFromOffice}
          officeGeofence={data.officeGeofence}
          onClose={() => setFlowMode(null)}
          onSuccess={handleSuccess}
        />
      ) : (
        <OfficeCheckInFlow
          open={flowMode !== null}
          mode={flowMode === "out" ? "out" : "in"}
          officeGeofence={data.officeGeofence}
          onClose={() => setFlowMode(null)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
