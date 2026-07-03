import { PayrollModule } from "@/components/payroll/payroll-module";
import { getPayrollBoard } from "@/lib/data/payroll";

export default async function PayrollPage() {
  const board = await getPayrollBoard();
  return <PayrollModule board={board} />;
}
