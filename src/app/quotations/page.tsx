import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { getQuotationsView } from "@/lib/data/commercial";
import { QuotationsList } from "@/components/quotation/quotations-list";
import { getAuthContext } from "@/lib/auth/context";
import { isAdminRole } from "@/lib/auth/permissions";

export default async function QuotationsPage() {
  const [views, ctx] = await Promise.all([getQuotationsView(), getAuthContext()]);
  // No auth context = mock/demo mode, where the current user is a super_admin.
  const canDelete = ctx ? isAdminRole(ctx.role) : true;
  return (
    <>
      <PageHeader
        title="Quotations"
        description="Proposals & estimates — convert accepted quotes to projects"
        action={
          <Link href="/quotations/new">
            <Button>
              <Plus /> New Quotation
            </Button>
          </Link>
        }
      />

      <QuotationsList items={views} canDelete={canDelete} />
    </>
  );
}
