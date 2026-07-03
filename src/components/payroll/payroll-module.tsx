"use client";

import * as React from "react";
import { Users, CalendarCheck, Wallet, HandCoins, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AttendanceTab } from "./attendance-tab";
import { EmployeesTab } from "./employees-tab";
import { ContractorsTab } from "./contractors-tab";
import { AdvancesTab } from "./advances-tab";
import { ProjectStoreProvider } from "@/lib/store/project-store";
import { employees } from "@/lib/mock/data";
import {
  labourPresentOn,
  monthlyPayroll,
  totalAdvancesOutstanding,
} from "@/lib/mock/selectors";
import { formatINR } from "@/lib/utils";

const today = () => new Date().toISOString().slice(0, 10);

function shiftMonth(month: string, delta: number) {
  const d = new Date(month + "-01");
  d.setMonth(d.getMonth() + delta);
  return d.toISOString().slice(0, 7);
}

function monthLabel(month: string) {
  return new Date(month + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function shortMonthLabel(month: string) {
  return new Date(month + "-01").toLocaleDateString("en-IN", { month: "short" });
}

export function PayrollModule() {
  const [month, setMonth] = React.useState(() => new Date().toISOString().slice(0, 7));
  const presentToday = labourPresentOn(today());
  const payroll = monthlyPayroll(month);
  const advances = totalAdvancesOutstanding();

  return (
    <ProjectStoreProvider>
      <PageHeader
        title="Payroll & Attendance"
        description="Staff payroll, salary slips, GPS labour attendance, contractors & advances"
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Staff on Payroll" value={String(employees.length)} icon={Users} accent="primary" />
        <StatCard label="Labour Present" value={String(presentToday)} icon={CalendarCheck} accent="success" hint="today" />
        <StatCard label={`Payroll (${shortMonthLabel(month)})`} value={formatINR(payroll, { compact: true })} icon={Wallet} accent="info" />
        <StatCard label="Advances Outstanding" value={formatINR(advances, { compact: true })} icon={HandCoins} accent="destructive" />
      </div>

      {/* Month selector */}
      <div className="mb-4 flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[140px] text-center text-sm font-medium">{monthLabel(month)}</span>
        <Button size="sm" variant="outline" onClick={() => setMonth((m) => shiftMonth(m, 1))} disabled={month >= new Date().toISOString().slice(0, 7)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="attendance">
        <TabsList>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="payroll">Staff Payroll</TabsTrigger>
          <TabsTrigger value="contractors">Contractors</TabsTrigger>
          <TabsTrigger value="advances">Advances</TabsTrigger>
        </TabsList>
        <TabsContent value="attendance">
          <AttendanceTab />
        </TabsContent>
        <TabsContent value="payroll">
          <EmployeesTab month={month} />
        </TabsContent>
        <TabsContent value="contractors">
          <ContractorsTab />
        </TabsContent>
        <TabsContent value="advances">
          <AdvancesTab />
        </TabsContent>
      </Tabs>
    </ProjectStoreProvider>
  );
}
