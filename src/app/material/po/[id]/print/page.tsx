import { notFound } from "next/navigation";
import { DocumentShell } from "@/components/documents/document-shell";
import { PoDocument } from "@/components/material/po-document";
import { getPurchaseOrderView } from "@/lib/data/material";

// Rendered on-demand — the data layer reads request cookies (Supabase auth),
// which aren't available during build-time static generation.
export const dynamic = "force-dynamic";

export default async function PoPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const view = await getPurchaseOrderView(id);
  if (!view) notFound();

  return (
    <DocumentShell backHref="/material" backLabel="Material" docType="Purchase Order">
      <PoDocument po={view.po} supplier={view.supplier} project={view.project} />
    </DocumentShell>
  );
}
