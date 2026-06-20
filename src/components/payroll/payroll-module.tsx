"use client";

import { Users, CalendarCheck, Wallet, HandCoins } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AttendanceTab } from "./attendance-tab";
import { EmployeesTab } from "./employees-tab";
import { ContractorsTab } from "./contractors-tab";
import { AdvancesTab } from "./advances-tab";
import { employees } from "@/lib/mock/data";
import {
  labourPresentOn,
  monthlyPayroll,
  totalAdvancesOutstanding,
} from "@/lib/mock/selectors";
import { formatINR } from "@/lib/utils";

export function PayrollModule() {
  const presentToday = labourPresentOn("2026-06-18");
  const payroll = monthlyPayroll("2026-05");
  const advances = totalAdvancesOutstanding();

  return (
    <>
      <PageHeader
        title="Payroll & Attendance"
        description="Staff payroll, salary slips, GPS labour attendance, contractors & advances"
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Staff on Payroll" value={String(employees.length)} icon={Users} accent="primary" />
        <StatCard label="Labour Present" value={String(presentToday)} icon={CalendarCheck} accent="success" hint="latest shift" />
        <StatCard label="Payroll (May)" value={formatINR(payroll, { compact: true })} icon={Wallet} accent="info" />
        <StatCard label="Advances Outstanding" value={formatINR(advances, { compact: true })} icon={HandCoins} accent="destructive" />
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
          <EmployeesTab month="2026-05" />
        </TabsContent>
        <TabsContent value="contractors">
          <ContractorsTab />
        </TabsContent>
        <TabsContent value="advances">
          <AdvancesTab />
        </TabsContent>
      </Tabs>
    </>
  );
}
