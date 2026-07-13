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
import { canAccess } from "@/lib/auth/permissions";
import { isLowStock } from "@/lib/data/compute";
import type { MaterialBoard } from "@/lib/data/material";

export function MaterialModule({ board }: { board: MaterialBoard }) {
  const { role, canViewPurchaseOrders } = useRole();
  // Full material access is role-based (super_admin, pm). A user who reaches
  // this page only through an explicit Purchase Orders grant sees just the PO
  // tab — not inventory/suppliers/usage their role isn't meant to see.
  const hasFullMaterial = canAccess(role, "material");
  const poOnly = !hasFullMaterial; // guaranteed here via the PO grant
  const showPoTab = canViewPurchaseOrders;

  const lowStock = board.items.filter(isLowStock).length;
  const openPOs = board.purchaseOrders.filter((p) => p.status === "draft" || p.status === "sent").length;
  const pendingReqs = board.requests.filter((r) => r.status === "pending").length;

  return (
    <>
      <PageHeader
        title={poOnly ? "Purchase Orders" : "Material Management"}
        description={
          poOnly
            ? "Purchase orders you have been granted access to"
            : "Warehouse inventory, site requests, purchase orders & usage"
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {!poOnly && (
          <>
            <StatCard label="Material Items" value={String(board.items.length)} icon={Boxes} accent="primary" />
            <StatCard label="Low Stock" value={String(lowStock)} icon={AlertTriangle} accent="destructive" />
          </>
        )}
        {showPoTab && (
          <StatCard label="Open POs" value={String(openPOs)} icon={ShoppingCart} accent="info" />
        )}
        {!poOnly && (
          <StatCard label="Pending Requests" value={String(pendingReqs)} icon={ClipboardList} accent="accent" />
        )}
      </div>

      <Tabs defaultValue={poOnly ? "po" : "inventory"}>
        <TabsList>
          {!poOnly && <TabsTrigger value="inventory">Inventory</TabsTrigger>}
          {!poOnly && <TabsTrigger value="requests">Requests</TabsTrigger>}
          {showPoTab && <TabsTrigger value="po">Purchase Orders</TabsTrigger>}
          {!poOnly && <TabsTrigger value="suppliers">Suppliers</TabsTrigger>}
          {!poOnly && <TabsTrigger value="usage">Usage</TabsTrigger>}
        </TabsList>
        {!poOnly && (
          <TabsContent value="inventory">
            <InventoryTab board={board} />
          </TabsContent>
        )}
        {!poOnly && (
          <TabsContent value="requests">
            <RequestsTab board={board} />
          </TabsContent>
        )}
        {showPoTab && (
          <TabsContent value="po">
            <PurchaseOrdersTab board={board} />
          </TabsContent>
        )}
        {!poOnly && (
          <TabsContent value="suppliers">
            <SuppliersTab board={board} />
          </TabsContent>
        )}
        {!poOnly && (
          <TabsContent value="usage">
            <UsageTab board={board} />
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}
