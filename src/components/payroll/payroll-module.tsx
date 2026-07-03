"use client";

import * as React from "react";
import { Users, CalendarCheck, Wallet, HandCoins } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AttendanceTab } from "./attendance-tab";
import { EmployeesTab } from "./employees-tab";
import { ContractorsTab } from "./contractors-tab";
import { AdvancesTab } from "./advances-tab";
import type { PayrollBoard } from "@/lib/payroll/compute";
import {
  latestAttendancePresent,
  latestSlipMonth,
  monthlyPayroll,
  totalAdvancesOutstanding,
} from "@/lib/payroll/compute";
import { formatINR } from "@/lib/utils";

const thisMonth = () => new Date().toISOString().slice(0, 7);

export function PayrollModule({ board }: { board: PayrollBoard }) {
  const activeMonth = latestSlipMonth(board.slips) || thisMonth();
  const [month, setMonth] = React.useState(activeMonth);
  const presentLatest = latestAttendancePresent(board.attendance);
  const payroll = monthlyPayroll(board.slips, month);
  const advances = totalAdvancesOutstanding(board.advances);
  const monthLabel = new Date(`${month}-01`).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });

  return (
    <>
      <PageHeader
        title="Payroll & Attendance"
        description="Staff payroll, salary slips, GPS labour attendance, contractors & advances"
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Staff on Payroll" value={String(board.employees.length)} icon={Users} accent="primary" />
        <StatCard label="Labour Present" value={String(presentLatest)} icon={CalendarCheck} accent="success" hint="latest shift" />
        <StatCard label={`Payroll (${monthLabel})`} value={formatINR(payroll, { compact: true })} icon={Wallet} accent="info" />
        <StatCard label="Advances Outstanding" value={formatINR(advances, { compact: true })} icon={HandCoins} accent="destructive" />
      </div>

      <Tabs defaultValue="payroll">
        <TabsList>
          <TabsTrigger value="payroll">Staff Payroll</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="contractors">Contractors</TabsTrigger>
          <TabsTrigger value="advances">Advances</TabsTrigger>
        </TabsList>
        <TabsContent value="payroll">
          <EmployeesTab board={board} month={month} onMonthChange={setMonth} />
        </TabsContent>
        <TabsContent value="attendance">
          <AttendanceTab board={board} />
        </TabsContent>
        <TabsContent value="contractors">
          <ContractorsTab board={board} />
        </TabsContent>
        <TabsContent value="advances">
          <AdvancesTab board={board} />
        </TabsContent>
      </Tabs>
    </>
  );
}
