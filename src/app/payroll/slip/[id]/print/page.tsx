import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/documents/print-button";
import { SlipDocument } from "@/components/payroll/slip-document";
import { getPayrollBoard } from "@/lib/data/payroll";

export const dynamic = "force-dynamic";

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
    <div className="mx-auto max-w-[850px] py-6 px-4 print:p-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href="/payroll"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Payroll & Attendance
        </Link>
        <PrintButton />
      </div>

      <SlipDocument slip={slip} employee={employee} />
    </div>
  );
}
