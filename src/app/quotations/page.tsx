import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { getQuotationsView } from "@/lib/data/commercial";
import { QuotationsList } from "@/components/quotation/quotations-list";

export default async function QuotationsPage() {
  const views = await getQuotationsView();
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

      <QuotationsList items={views} />
    </>
  );
}
