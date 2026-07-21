import { PayrollModule } from "@/components/payroll/payroll-module";
import { getPayrollBoard } from "@/lib/data/payroll";
import { getAttendanceAdminBoard } from "@/lib/data/attendance";

// Employee attendance is session-scoped (role-gated board) — render on demand.
export const dynamic = "force-dynamic";

export default async function PayrollPage() {
  const [board, attendanceBoard] = await Promise.all([
    getPayrollBoard(),
    getAttendanceAdminBoard(),
  ]);
  return <PayrollModule board={board} attendanceBoard={attendanceBoard} />;
}
