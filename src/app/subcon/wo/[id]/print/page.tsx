import { notFound } from "next/navigation";
import { DocumentShell } from "@/components/documents/document-shell";
import { WoDocument } from "@/components/subcon/wo-document";
import { getAllWorkOrderIds, getWorkOrderView } from "@/lib/data/subcon";

export async function generateStaticParams() {
  return (await getAllWorkOrderIds()).map((id) => ({ id }));
}

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
