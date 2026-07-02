import { woTotals } from "@/lib/data/compute";
import { tradeLabel } from "@/lib/labels";
import { formatINR } from "@/lib/utils";
import type { Project, Subcontractor, SubconWorkOrder } from "@/lib/types";

export function WoDocument({
  wo,
  sc,
  project,
}: {
  wo: SubconWorkOrder;
  sc: Subcontractor | null;
  project: Project | null;
}) {
  const totals = woTotals(wo);

  return (
    <>
      <div className="mt-5 grid grid-cols-2 gap-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Subcontractor</p>
          <p className="font-semibold">{sc?.company}</p>
          <p className="text-slate-600">{sc?.contact}</p>
          <p className="text-slate-600">Trade: {sc ? tradeLabel[sc.trade] : ""}</p>
          <p className="text-slate-600">{sc?.phone}</p>
          <p className="text-slate-600">GSTIN: {sc?.gst}</p>
        </div>
        <div className="text-right">
          <table className="ml-auto text-sm">
            <tbody>
              <tr>
                <td className="pr-3 text-slate-400">WO No.</td>
                <td className="font-semibold">{wo.number}</td>
              </tr>
              <tr>
                <td className="pr-3 text-slate-400">Date</td>
                <td>
                  {new Date(wo.date).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
              </tr>
              <tr>
                <td className="pr-3 text-slate-400">Project</td>
                <td>
                  {project?.code} — {project?.name}
                </td>
              </tr>
              <tr>
                <td className="pr-3 text-slate-400">Site</td>
                <td>{project?.location}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-900 text-left text-white">
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Scope of Work</th>
            <th className="px-3 py-2 text-right font-medium">Qty</th>
            <th className="px-3 py-2 text-right font-medium">Rate</th>
            <th className="px-3 py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {wo.items.map((it, i) => (
            <tr key={it.id} className="border-b border-slate-200">
              <td className="px-3 py-2 text-slate-400">{i + 1}</td>
              <td className="px-3 py-2">{it.description}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {it.qty} {it.unit}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{formatINR(it.rate)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatINR(it.qty * it.rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 ml-auto w-full max-w-xs space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">Subtotal</span>
          <span className="tabular-nums">{formatINR(totals.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">CGST @ {wo.taxRate / 2}%</span>
          <span className="tabular-nums">{formatINR(totals.cgst)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">SGST @ {wo.taxRate / 2}%</span>
          <span className="tabular-nums">{formatINR(totals.sgst)}</span>
        </div>
        <div className="flex justify-between border-t-2 border-slate-900 pt-1.5 text-base font-bold">
          <span>Grand Total</span>
          <span className="tabular-nums">{formatINR(totals.grandTotal)}</span>
        </div>
      </div>

      <div className="mt-10 flex items-end justify-between text-xs">
        <p className="max-w-xs text-slate-500">
          The subcontractor shall execute the above scope as per approved drawings,
          specifications and the project programme. Retention as per agreement.
        </p>
        <div className="text-center">
          <div className="w-56 border-t border-slate-400 pt-1 text-slate-700">{wo.signatory}</div>
          <p className="mt-1 text-slate-500">Authorised Signatory</p>
        </div>
      </div>
    </>
  );
}
