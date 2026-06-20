import { notFound } from "next/navigation";
import { DocumentShell } from "@/components/documents/document-shell";
import { PoDocument } from "@/components/material/po-document";
import { getAllPurchaseOrderIds, getPurchaseOrderView } from "@/lib/data/material";

export async function generateStaticParams() {
  return (await getAllPurchaseOrderIds()).map((id) => ({ id }));
}

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
