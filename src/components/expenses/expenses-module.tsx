"use client";

import { Receipt, Clock, CheckCircle2, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExpensesApprovalTab } from "./expenses-approval-tab";
import { ExpensesReportsTab } from "./expenses-reports-tab";
import { SupervisorBalanceTab } from "./supervisor-balance-tab";
import { computeSupervisorBalances } from "./compute";
import type { ExpensesBoard } from "@/lib/data/expenses";
import { useRole } from "@/components/layout/role-provider";
import { formatINR } from "@/lib/utils";

export function ExpensesModule({ board }: { board: ExpensesBoard }) {
  const { expenses, ledger } = board;
  const { role } = useRole();
  const isSupervisor = role === "supervisor";
  const pending = expenses.filter((e) => e.status === "pending");
  const approvedTotal = expenses
    .filter((e) => e.status === "approved")
    .reduce((s, e) => s + e.amount, 0);
  const balances = computeSupervisorBalances(ledger, expenses);
  const netBalance = balances.reduce((s, b) => s + b.remaining, 0);

  return (
    <>
      <PageHeader
        title="Petty Site Expenses"
        description="Field expense logging, approval workflow & supervisor imprest balances"
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Expenses" value={String(expenses.length)} icon={Receipt} accent="primary" />
        <StatCard label="Pending Approval" value={String(pending.length)} icon={Clock} accent="destructive" />
        <StatCard label="Approved Value" value={formatINR(approvedTotal, { compact: true })} icon={CheckCircle2} accent="success" />
        <StatCard label="Imprest Balance" value={formatINR(netBalance, { compact: true })} icon={Wallet} accent="info" hint={`${balances.length} supervisors`} />
      </div>

      <Tabs defaultValue="expenses">
        <TabsList>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          {!isSupervisor && <TabsTrigger value="reports">Reports</TabsTrigger>}
          <TabsTrigger value="balance">Supervisor Balance</TabsTrigger>
        </TabsList>
        <TabsContent value="expenses">
          <ExpensesApprovalTab board={board} />
        </TabsContent>
        {!isSupervisor && (
          <TabsContent value="reports">
            <ExpensesReportsTab board={board} />
          </TabsContent>
        )}
        <TabsContent value="balance">
          <SupervisorBalanceTab board={board} />
        </TabsContent>
      </Tabs>
    </>
  );
}
