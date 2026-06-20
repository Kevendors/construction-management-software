"use client";

import { HardHat, ClipboardCheck, ReceiptText, IndianRupee } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SubcontractorsTab } from "./subcontractors-tab";
import { WorkOrdersTab } from "./work-orders-tab";
import { ProgressTab } from "./progress-tab";
import { RaBillsTab } from "./ra-bills-tab";
import { MaterialIssuesTab } from "./material-issues-tab";
import { woTotals } from "@/lib/data/compute";
import type { SubconBoard } from "@/lib/data/subcon";
import { formatINR } from "@/lib/utils";

export function SubconModule({ board }: { board: SubconBoard }) {
  const { workOrders, subcontractors, raBills } = board;
  const activeWOs = workOrders.filter(
    (w) => w.status === "issued" || w.status === "in_progress"
  ).length;
  const woValue = workOrders.reduce((s, w) => s + woTotals(w).grandTotal, 0);
  const pendingRA = raBills.filter((r) => r.status === "submitted").length;

  return (
    <>
      <PageHeader
        title="Subcontractor Management"
        description="Work orders, progress, material issues & RA bills"
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Subcontractors" value={String(subcontractors.length)} icon={HardHat} accent="primary" />
        <StatCard label="Active Work Orders" value={String(activeWOs)} icon={ClipboardCheck} accent="info" />
        <StatCard label="WO Value" value={formatINR(woValue, { compact: true })} icon={IndianRupee} accent="accent" />
        <StatCard label="RA Bills Pending" value={String(pendingRA)} icon={ReceiptText} accent="destructive" />
      </div>

      <Tabs defaultValue="work-orders">
        <TabsList>
          <TabsTrigger value="work-orders">Work Orders</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="ra-bills">RA Bills</TabsTrigger>
          <TabsTrigger value="issues">Material Issues</TabsTrigger>
          <TabsTrigger value="subcontractors">Subcontractors</TabsTrigger>
        </TabsList>
        <TabsContent value="work-orders">
          <WorkOrdersTab board={board} />
        </TabsContent>
        <TabsContent value="progress">
          <ProgressTab board={board} />
        </TabsContent>
        <TabsContent value="ra-bills">
          <RaBillsTab board={board} />
        </TabsContent>
        <TabsContent value="issues">
          <MaterialIssuesTab board={board} />
        </TabsContent>
        <TabsContent value="subcontractors">
          <SubcontractorsTab board={board} />
        </TabsContent>
      </Tabs>
    </>
  );
}
