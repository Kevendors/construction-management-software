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
import type { EmployeeAttendance } from "@/lib/types";
import { CheckInCard } from "./check-in-card";
import { CheckInFlow, type FlowSuccess } from "./check-in-flow";
import { HistoryCalendar } from "./history-calendar";
import { HistoryList } from "./history-list";
import { MonthlySummary } from "./monthly-summary";

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function MyAttendance({ data }: { data: MyAttendanceData }) {
  const router = useRouter();
  const [view, setView] = React.useState<"calendar" | "list">("calendar");
  const [flowMode, setFlowMode] = React.useState<"in" | "out" | null>(null);
  // Optimistic override so the card flips immediately (and mock mode, whose
  // actions are no-ops, still demos the full flow until the next reload).
  const [localToday, setLocalToday] = React.useState<EmployeeAttendance | null>(null);

  const today = localToday ?? data.today;
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
    if (flowMode === "in") {
      setLocalToday({
        id: `local-${result.at}`,
        userId: "",
        employeeId: data.employeeId,
        userName: data.userName,
        projectId: result.projectId,
        date: orgToday(),
        checkInAt: result.at,
        checkInLat: result.lat,
        checkInLng: result.lng,
        checkInSelfiePath: "",
        checkOutAt: "",
        checkOutLat: null,
        checkOutLng: null,
        checkOutSelfiePath: "",
        totalMinutes: 0,
        overtimeMinutes: 0,
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
        <CheckInCard
          today={today}
          hasProjects={data.assignedProjects.length > 0}
          onStart={setFlowMode}
        />

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
            <MonthlySummary records={records} month={data.month} />
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
              <HistoryCalendar records={records} month={data.month} />
            ) : (
              <HistoryList records={records} />
            )}
          </CardContent>
        </Card>
      </div>

      <CheckInFlow
        open={flowMode !== null}
        mode={flowMode ?? "in"}
        projects={data.assignedProjects}
        activeProjectId={today?.projectId}
        onClose={() => setFlowMode(null)}
        onSuccess={handleSuccess}
      />
    </>
  );
}
