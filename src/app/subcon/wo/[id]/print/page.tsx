import { notFound } from "next/navigation";
import { DocumentShell } from "@/components/documents/document-shell";
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
    <DocumentShell backHref="/subcon" backLabel="Subcontractor" docType="Work Order">
      <WoDocument wo={view.wo} sc={view.subcontractor} project={view.project} />
    </DocumentShell>
  );
}
