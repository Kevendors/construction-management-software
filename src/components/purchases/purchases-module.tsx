"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PurchaseOrdersList } from "./purchase-orders-list";
import { PurchaseBillsList } from "./purchase-bills-list";
import type { Project, PurchaseBill, PurchaseOrder, Supplier } from "@/lib/types";

export function PurchasesModule({
  purchaseOrders,
  suppliers,
  projects,
  bills,
  canDelete,
}: {
  purchaseOrders: PurchaseOrder[];
  suppliers: Supplier[];
  projects: Project[];
  bills: PurchaseBill[];
  canDelete: boolean;
}) {
  return (
    <Tabs defaultValue="orders">
      <TabsList>
        <TabsTrigger value="orders">Purchase Orders</TabsTrigger>
        <TabsTrigger value="bills">Purchase Bills</TabsTrigger>
      </TabsList>
      <TabsContent value="orders">
        <PurchaseOrdersList purchaseOrders={purchaseOrders} suppliers={suppliers} projects={projects} />
      </TabsContent>
      <TabsContent value="bills">
        <PurchaseBillsList bills={bills} suppliers={suppliers} projects={projects} canDelete={canDelete} />
      </TabsContent>
    </Tabs>
  );
}
