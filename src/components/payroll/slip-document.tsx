import { slipTotals } from "@/lib/payroll/compute";
import { departmentLabel } from "@/lib/labels";
import { formatINR } from "@/lib/utils";
import type { Employee, SalarySlip } from "@/lib/types";

export function SlipDocument({ slip, employee }: { slip: SalarySlip; employee: Employee | null }) {
  const emp = employee;
  const t = slipTotals(slip);
  const monthLabel = new Date(`${slip.month}-01`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const earningRows = [
    { label: "Basic", value: slip.basic },
    { label: "House Rent Allowance", value: slip.hra },
    { label: "Other Allowances", value: slip.allowances },
  ];
  const deductionRows = [
    { label: "Provident Fund (PF)", value: slip.pf },
    { label: "ESI", value: slip.esi },
    { label: "Advance Recovery", value: slip.advanceDeduction },
  ];

  return (
    <>
      <div className="mt-5 grid grid-cols-2 gap-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Employee</p>
          <p className="font-semibold">{emp?.name}</p>
          <p className="text-slate-600">{emp?.designation}</p>
          <p className="text-slate-600">Dept: {emp ? departmentLabel[emp.department] : ""}</p>
          <p className="text-slate-600">Emp ID: {slip.employeeId.toUpperCase()}</p>
        </div>
        <div className="text-right">
          <table className="ml-auto text-sm">
            <tbody>
              <tr>
                <td className="pr-3 text-slate-400">Pay Period</td>
                <td className="font-semibold">{monthLabel}</td>
              </tr>
              <tr>
                <td className="pr-3 text-slate-400">Paid Days</td>
                <td>
                  {slip.paidDays} / {slip.monthDays}
                </td>
              </tr>
              <tr>
                <td className="pr-3 text-slate-400">Date of Joining</td>
                <td>
                  {emp && emp.joinDate
                    ? new Date(emp.joinDate).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6">
        <div>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-900 text-left text-white">
                <th className="px-3 py-2 font-medium">Earnings</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {earningRows.map((r) => (
                <tr key={r.label} className="border-b border-slate-200">
                  <td className="px-3 py-2">{r.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatINR(r.value)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-900 font-semibold">
                <td className="px-3 py-2">Gross Earnings</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatINR(t.earnings)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-900 text-left text-white">
                <th className="px-3 py-2 font-medium">Deductions</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {deductionRows.map((r) => (
                <tr key={r.label} className="border-b border-slate-200">
                  <td className="px-3 py-2">{r.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatINR(r.value)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-900 font-semibold">
                <td className="px-3 py-2">Total Deductions</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatINR(t.deductions)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between rounded-lg bg-slate-900 px-5 py-3 text-white">
        <span className="text-sm font-medium uppercase tracking-wide">Net Pay</span>
        <span className="text-xl font-bold tabular-nums">{formatINR(t.net)}</span>
      </div>

      <div className="mt-10 flex items-end justify-between text-xs">
        <p className="max-w-xs text-slate-500">
          This is a computer-generated salary slip and does not require a signature.
          Net pay credited to the registered bank account.
        </p>
        <div className="text-center">
          <div className="w-56 border-t border-slate-400 pt-1 text-slate-700">For Charu Construction & Design</div>
          <p className="mt-1 text-slate-500">Authorised Signatory</p>
        </div>
      </div>
    </>
  );
}
