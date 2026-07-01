import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/documents/print-button";
import { WoDocument } from "@/components/subcon/wo-document";
import { getWorkOrderView } from "@/lib/data/subcon";

// Rendered on-demand — the data layer reads request cookies (Supabase auth),
// which aren't available during build-time static generation.
export const dynamic = "force-dynamic";

export default async function WoPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const view = await getWorkOrderView(id);
  if (!view) notFound();

  return (
    <div className="mx-auto max-w-[820px]">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href="/subcon"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Subcontractor
        </Link>
        <PrintButton />
      </div>

      <WoDocument wo={view.wo} sc={view.subcontractor} project={view.project} />
    </div>
  );
}
