import Link from "next/link";
import { Plus, IndianRupee, CheckCircle2, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { getInvoicesView } from "@/lib/data/commercial";
import { lineTotalWithTax } from "@/lib/data/compute";
import { formatINR } from "@/lib/utils";
import { InvoicesList } from "@/components/invoice/invoices-list";
import { getAuthContext } from "@/lib/auth/context";
import { isAdminRole } from "@/lib/auth/permissions";

export default async function InvoicesPage() {
  const [views, ctx] = await Promise.all([getInvoicesView(), getAuthContext()]);
  const rows = views.map((v) => ({
    ...v,
    total: lineTotalWithTax(v.invoice.items, v.invoice.taxRate),
  }));
  const totalRaised = rows.reduce((s, r) => s + r.total, 0);
  const totalReceived = rows.reduce((s, r) => s + r.invoice.received, 0);
  const outstanding = totalRaised - totalReceived;
  // No auth context = mock/demo mode, where the current user is a super_admin.
  const canDelete = ctx ? isAdminRole(ctx.role) : true;

  return (
    <>
      <PageHeader
        title="Sales Invoices"
        description="Client billing — raised vs received"
        action={
          <Link href="/invoices/new">
            <Button>
              <Plus /> New Invoice
            </Button>
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Raised" value={formatINR(totalRaised, { compact: true })} icon={IndianRupee} accent="primary" />
        <StatCard label="Received" value={formatINR(totalReceived, { compact: true })} icon={CheckCircle2} accent="success" />
        <StatCard label="Outstanding" value={formatINR(outstanding, { compact: true })} icon={AlertCircle} accent="destructive" />
      </div>

      <InvoicesList items={views} canDelete={canDelete} />

    </>
  );
}
