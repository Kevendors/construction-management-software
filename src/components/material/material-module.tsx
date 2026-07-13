"use client";

import { Boxes, AlertTriangle, ShoppingCart, ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InventoryTab } from "./inventory-tab";
import { RequestsTab } from "./requests-tab";
import { PurchaseOrdersTab } from "./purchase-orders-tab";
import { SuppliersTab } from "./suppliers-tab";
import { UsageTab } from "./usage-tab";
import { useRole } from "@/components/layout/role-provider";
import { isLowStock } from "@/lib/data/compute";
import type { MaterialBoard } from "@/lib/data/material";

export function MaterialModule({ board }: { board: MaterialBoard }) {
  // Purchase Orders are an explicit Super-Admin grant — hide the tab entirely
  // for users without it (RLS already returns no PO rows to them).
  const { canViewPurchaseOrders } = useRole();
  const lowStock = board.items.filter(isLowStock).length;
  const openPOs = board.purchaseOrders.filter((p) => p.status === "draft" || p.status === "sent").length;
  const pendingReqs = board.requests.filter((r) => r.status === "pending").length;

  return (
    <>
      <PageHeader
        title="Material Management"
        description="Warehouse inventory, site requests, purchase orders & usage"
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Material Items" value={String(board.items.length)} icon={Boxes} accent="primary" />
        <StatCard label="Low Stock" value={String(lowStock)} icon={AlertTriangle} accent="destructive" />
        {canViewPurchaseOrders && (
          <StatCard label="Open POs" value={String(openPOs)} icon={ShoppingCart} accent="info" />
        )}
        <StatCard label="Pending Requests" value={String(pendingReqs)} icon={ClipboardList} accent="accent" />
      </div>

      <Tabs defaultValue="inventory">
        <TabsList>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          {canViewPurchaseOrders && <TabsTrigger value="po">Purchase Orders</TabsTrigger>}
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
        </TabsList>
        <TabsContent value="inventory">
          <InventoryTab board={board} />
        </TabsContent>
        <TabsContent value="requests">
          <RequestsTab board={board} />
        </TabsContent>
        {canViewPurchaseOrders && (
          <TabsContent value="po">
            <PurchaseOrdersTab board={board} />
          </TabsContent>
        )}
        <TabsContent value="suppliers">
          <SuppliersTab board={board} />
        </TabsContent>
        <TabsContent value="usage">
          <UsageTab board={board} />
        </TabsContent>
      </Tabs>
    </>
  );
}
