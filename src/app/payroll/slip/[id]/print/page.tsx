import { notFound } from "next/navigation";
import { salarySlips } from "@/lib/mock/data";
import { DocumentShell } from "@/components/documents/document-shell";
import { SlipDocument } from "@/components/payroll/slip-document";

export function generateStaticParams() {
  return salarySlips.map((s) => ({ id: s.id }));
}

export default async function SlipPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const slip = salarySlips.find((s) => s.id === id);
  if (!slip) notFound();

  return (
    <DocumentShell backHref="/payroll" backLabel="Payroll & Attendance" docType="Salary Slip">
      <SlipDocument slip={slip} />
    </DocumentShell>
  );
}
