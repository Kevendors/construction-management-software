import { slipTotals } from "@/lib/payroll/compute";
import { departmentLabel } from "@/lib/labels";
import type { Employee, SalarySlip } from "@/lib/types";

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const unit = n % 10;
  return `${TENS[Math.floor(n / 10)]}${unit ? `-${ONES[unit]}` : ""}`;
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return `${h ? ONES[h] + " Hundred" + (r ? " " : "") : ""}${r ? twoDigits(r) : ""}`;
}

export function amountInIndianRupeesWords(amount: number): string {
  const rupees = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - rupees) * 100);
  if (rupees === 0 && paise === 0) return "Indian Rupee Zero Only";

  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const rest = rupees % 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));

  let words = "Indian Rupee " + parts.join(" ").trim();
  if (paise) words += ` and ${twoDigits(paise)} Paise`;
  return words + " Only";
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);
}

function formatDateDDMMYYYY(d?: string | null): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function getPayDate(monthStr: string): string {
  const [y, m] = monthStr.split("-").map(Number);
  if (!y || !m) return "—";
  const lastDay = new Date(y, m, 0);
  const day = String(lastDay.getDate()).padStart(2, "0");
  const month = String(lastDay.getMonth() + 1).padStart(2, "0");
  const year = lastDay.getFullYear();
  return `${day}/${month}/${year}`;
}

export const PAYROLL_COMPANY = {
  legalName: "Keyvendors India Private Limited",
  gstin: "07AAGCK1663C2ZS",
  address: "4th Floor, Shop No. 656, Aggarwal Chamber 3, Veer Savarkar Block, Shakarpur, Near Vidya Book Center, Nirman Vihar, Delhi – 110092",
  website: "www.keyvendors.com",
};

export function SlipDocument({ slip, employee }: { slip: SalarySlip; employee: Employee | null }) {
  const emp = employee;
  const t = slipTotals(slip);
  const monthLabel = new Date(`${slip.month}-01`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
  const lopDays = Math.max(0, slip.monthDays - slip.paidDays);
  const joinDateStr = formatDateDDMMYYYY(emp?.joinDate);
  const payDateStr = getPayDate(slip.month);

  const earningRows = [
    { label: "Basic", value: slip.basic },
    ...(slip.hra > 0 ? [{ label: "House Rent Allowance", value: slip.hra }] : []),
    ...(slip.allowances > 0 ? [{ label: "Other Allowances", value: slip.allowances }] : []),
  ];

  const deductionRows = [
    ...(slip.pf > 0 ? [{ label: "EPF Contribution", value: slip.pf }] : []),
    ...(slip.esi > 0 ? [{ label: "ESI Contribution", value: slip.esi }] : []),
    ...(slip.advanceDeduction > 0 ? [{ label: "Advance Recovery", value: slip.advanceDeduction }] : []),
  ];
  if (deductionRows.length === 0) {
    deductionRows.push({ label: "Nil Deductions", value: 0 });
  }

  return (
    <article
      id="salary-slip-doc"
      style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}
      className="mx-auto w-full max-w-[850px] rounded-2xl border border-slate-200 bg-white p-8 text-slate-900 shadow-sm sm:p-10 print:border-0 print:p-0 print:shadow-none"
    >
      {/* 1. Header: Logo & Company details on left, Payslip Month on right */}
      <div className="flex items-start justify-between gap-6 pb-6 border-b border-slate-200">
        <div className="flex items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/keyvendors-logo-square.png"
            alt="Keyvendors Logo"
            className="h-14 w-14 shrink-0 rounded-lg object-contain border border-slate-100 p-1 bg-white shadow-2xs"
          />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">
              {PAYROLL_COMPANY.legalName}
            </h1>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-500">
              {PAYROLL_COMPANY.address}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              <span className="font-semibold text-slate-600">GSTIN:</span> {PAYROLL_COMPANY.gstin}
              <span className="mx-2 text-slate-300">|</span>
              <span className="font-semibold text-slate-600">Website:</span>{" "}
              <a
                href={`https://${PAYROLL_COMPANY.website}`}
                target="_blank"
                rel="noreferrer"
                className="text-slate-600 hover:underline"
              >
                {PAYROLL_COMPANY.website}
              </a>
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Payslip For the Month</p>
          <p className="mt-0.5 text-xl font-bold text-slate-900 tracking-tight">{monthLabel}</p>
        </div>
      </div>

      {/* 2. Employee Summary (Left) & Net Pay Card (Right) */}
      <div className="grid grid-cols-1 md:grid-cols-[1.35fr_1fr] gap-6 items-start pt-6">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
            EMPLOYEE SUMMARY
          </h2>
          <table className="w-full text-xs">
            <tbody className="space-y-1.5">
              <tr>
                <td className="w-32 py-1 text-slate-500">Employee Name</td>
                <td className="py-1 font-semibold text-slate-900">: {emp?.name ?? "—"}</td>
              </tr>
              <tr>
                <td className="w-32 py-1 text-slate-500">Designation</td>
                <td className="py-1 font-semibold text-slate-900">: {emp?.designation ?? "—"}</td>
              </tr>
              {emp?.department && (
                <tr>
                  <td className="w-32 py-1 text-slate-500">Department</td>
                  <td className="py-1 font-semibold text-slate-900">: {departmentLabel[emp.department] ?? emp.department}</td>
                </tr>
              )}
              <tr>
                <td className="w-32 py-1 text-slate-500">Employee ID</td>
                <td className="py-1 font-semibold text-slate-900">: {slip.employeeId.toUpperCase()}</td>
              </tr>
              <tr>
                <td className="w-32 py-1 text-slate-500">Date of Joining</td>
                <td className="py-1 font-semibold text-slate-900">: {joinDateStr}</td>
              </tr>
              <tr>
                <td className="w-32 py-1 text-slate-500">Pay Period</td>
                <td className="py-1 font-semibold text-slate-900">: {monthLabel}</td>
              </tr>
              <tr>
                <td className="w-32 py-1 text-slate-500">Pay Date</td>
                <td className="py-1 font-semibold text-slate-900">: {payDateStr}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Net Pay & Attendance Box */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <div className="bg-[#f0fbf4] p-4.5 border-b border-emerald-100/60">
            <div className="border-l-4 border-emerald-500 pl-3.5">
              <p className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                {formatCurrency(t.net)}
              </p>
              <p className="text-xs font-semibold text-emerald-800">
                Employee Net Pay
              </p>
            </div>
          </div>
          <div className="p-4 bg-white">
            <table className="w-full text-xs">
              <tbody>
                <tr>
                  <td className="py-1 text-slate-500">Paid Days</td>
                  <td className="py-1 text-right font-semibold text-slate-900 tabular-nums">: {slip.paidDays}</td>
                </tr>
                <tr>
                  <td className="py-1 text-slate-500">LOP Days</td>
                  <td className="py-1 text-right font-semibold text-slate-900 tabular-nums">: {lopDays}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 3. Statutory Details Bar */}
      <div className="my-5 border-y border-dotted border-slate-300 py-2.5 text-xs">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center">
            <span className="w-28 text-slate-500">PF A/C Number</span>
            <span className="font-semibold text-slate-800">
              : {slip.pf > 0 ? `KV/DL/PF/${slip.employeeId.toUpperCase()}` : "Not Applicable"}
            </span>
          </div>
          <div className="flex items-center">
            <span className="w-16 text-slate-500">UAN</span>
            <span className="font-semibold text-slate-800">
              : {emp?.phone ? `10${emp.phone.replace(/\D/g, "").slice(0, 10).padEnd(10, "0")}` : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Earnings & Deductions Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden mt-4 shadow-2xs">
        <div className="grid grid-cols-2">
          {/* Earnings Column */}
          <div className="flex flex-col border-r border-slate-200">
            <div className="flex justify-between items-center px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 text-xs font-bold text-slate-700 tracking-wider">
              <span>EARNINGS</span>
              <span className="text-right">AMOUNT</span>
            </div>
            <div className="p-4 flex-1 space-y-2.5 text-xs min-h-[90px]">
              {earningRows.map((r) => (
                <div key={r.label} className="flex justify-between items-center">
                  <span className="text-slate-700">{r.label}</span>
                  <span className="font-semibold text-slate-900 tabular-nums">{formatCurrency(r.value)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center px-4 py-2.5 bg-slate-50/90 border-t border-slate-200 text-xs font-bold text-slate-900">
              <span>Gross Earnings</span>
              <span className="tabular-nums">{formatCurrency(t.earnings)}</span>
            </div>
          </div>

          {/* Deductions Column */}
          <div className="flex flex-col">
            <div className="flex justify-between items-center px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 text-xs font-bold text-slate-700 tracking-wider">
              <span>DEDUCTIONS</span>
              <span className="text-right">AMOUNT</span>
            </div>
            <div className="p-4 flex-1 space-y-2.5 text-xs min-h-[90px]">
              {deductionRows.map((r) => (
                <div key={r.label} className="flex justify-between items-center">
                  <span className="text-slate-700">{r.label}</span>
                  <span className="font-semibold text-slate-900 tabular-nums">{formatCurrency(r.value)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center px-4 py-2.5 bg-slate-50/90 border-t border-slate-200 text-xs font-bold text-slate-900">
              <span>Total Deductions</span>
              <span className="tabular-nums">{formatCurrency(t.deductions)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Total Net Payable Banner */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-white overflow-hidden flex items-stretch justify-between shadow-2xs">
        <div className="px-5 py-3.5 flex flex-col justify-center">
          <p className="text-sm font-bold text-slate-900 tracking-wide">TOTAL NET PAYABLE</p>
          <p className="text-xs text-slate-500">Gross Earnings - Total Deductions</p>
        </div>
        <div className="bg-[#f0fbf4] border-l border-slate-200 px-8 py-3.5 flex items-center justify-center">
          <span className="text-xl font-bold text-slate-900 tabular-nums">
            {formatCurrency(t.net)}
          </span>
        </div>
      </div>

      {/* 6. Amount in Words */}
      <div className="mt-4 text-right text-xs">
        <span className="text-slate-500">Amount In Words : </span>
        <span className="font-bold text-slate-900">{amountInIndianRupeesWords(t.net)}</span>
      </div>

      {/* 7. Footer Disclaimer */}
      <hr className="my-6 border-slate-200" />
      <p className="text-center text-[11px] text-slate-400">
        -- This document has been automatically generated by Keyvendors India Private Limited; therefore, a signature is not required. --
      </p>
    </article>
  );
}
