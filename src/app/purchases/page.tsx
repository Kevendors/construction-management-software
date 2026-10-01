import { PageHeader } from "@/components/layout/page-header";
import { PurchasesModule } from "@/components/purchases/purchases-module";
import { getMaterialBoard } from "@/lib/data/material";
import { getPurchaseBillsBoard } from "@/lib/data/purchases";
import { getAuthContext } from "@/lib/auth/context";
import { isAdminRole } from "@/lib/auth/permissions";

export default async function PurchasesPage() {
  const [materialBoard, billsBoard, ctx] = await Promise.all([
    getMaterialBoard(),
    getPurchaseBillsBoard(),
    getAuthContext(),
  ]);
  const canDelete = ctx ? isAdminRole(ctx.role) : true;

  return (
    <>
      <PageHeader
        title="Purchase Order/Bill"
        description="What we've ordered from suppliers, and what we owe them"
      />
      <PurchasesModule
        purchaseOrders={materialBoard.purchaseOrders}
        suppliers={materialBoard.suppliers}
        projects={materialBoard.projects}
        bills={billsBoard.bills}
        canDelete={canDelete}
      />
    </>
  );
}
