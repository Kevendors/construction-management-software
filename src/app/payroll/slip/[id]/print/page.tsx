import { notFound } from "next/navigation";
import { DocumentShell } from "@/components/documents/document-shell";
import { SlipDocument } from "@/components/payroll/slip-document";
import { getPayrollBoard } from "@/lib/data/payroll";

export default async function SlipPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const board = await getPayrollBoard();
  const slip = board.slips.find((s) => s.id === id);
  if (!slip) notFound();
  const employee = board.employees.find((e) => e.id === slip.employeeId) ?? null;

  return (
    <DocumentShell backHref="/payroll" backLabel="Payroll & Attendance" docType="Salary Slip">
      <SlipDocument slip={slip} employee={employee} />
    </DocumentShell>
  );
}
