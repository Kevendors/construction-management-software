import { poTotals } from "@/lib/data/compute";
import { formatINR } from "@/lib/utils";
import type { Project, PurchaseOrder, Supplier } from "@/lib/types";

export function PoDocument({
  po,
  supplier,
  project,
}: {
  po: PurchaseOrder;
  supplier: Supplier | null;
  project: Project | null;
}) {
  const totals = poTotals(po);

  return (
    <>
      {/* meta */}
      <div className="mt-5 grid grid-cols-2 gap-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Supplier</p>
          <p className="font-semibold">{supplier?.company}</p>
          <p className="text-slate-600">{supplier?.contact}</p>
          <p className="text-slate-600">{supplier?.address}</p>
          <p className="text-slate-600">{supplier?.phone}</p>
          <p className="text-slate-600">GSTIN: {supplier?.gst}</p>
        </div>
        <div className="text-right">
          <table className="ml-auto text-sm">
            <tbody>
              <tr>
                <td className="pr-3 text-slate-400">PO No.</td>
                <td className="font-semibold">{po.number}</td>
              </tr>
              <tr>
                <td className="pr-3 text-slate-400">Date</td>
                <td>
                  {new Date(po.date).toLocaleDateString("en-IN", {
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
                <td className="pr-3 text-slate-400">Delivery</td>
                <td>{project?.location}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* items */}
      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-900 text-left text-white">
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Description</th>
            <th className="px-3 py-2 text-right font-medium">Qty</th>
            <th className="px-3 py-2 text-right font-medium">Rate</th>
            <th className="px-3 py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {po.items.map((it, i) => (
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

      {/* totals */}
      <div className="mt-4 ml-auto w-full max-w-xs space-y-1.5 text-sm">
        <Row label="Subtotal" value={formatINR(totals.subtotal)} />
        {totals.discount > 0 && <Row label="Discount" value={`− ${formatINR(totals.discount)}`} />}
        <Row label="Taxable Value" value={formatINR(totals.taxable)} />
        <Row label={`CGST @ ${po.taxRate / 2}%`} value={formatINR(totals.cgst)} />
        <Row label={`SGST @ ${po.taxRate / 2}%`} value={formatINR(totals.sgst)} />
        <div className="flex justify-between border-t-2 border-slate-900 pt-1.5 text-base font-bold">
          <span>Grand Total</span>
          <span className="tabular-nums">{formatINR(totals.grandTotal)}</span>
        </div>
      </div>

      {/* terms */}
      <div className="mt-8 grid grid-cols-2 gap-6 text-xs">
        <div>
          <p className="font-semibold text-slate-700">Terms &amp; Conditions</p>
          <p className="mt-1 text-slate-600">{po.terms}</p>
          <p className="mt-2 font-semibold text-slate-700">Payment Terms</p>
          <p className="mt-1 text-slate-600">{po.paymentTerms}</p>
        </div>
        <div className="flex flex-col items-end justify-end">
          <div className="mt-10 w-48 border-t border-slate-400 pt-1 text-center text-slate-600">
            For Charu Construction &amp; Design
          </div>
          <p className="mt-1 text-slate-500">Authorised Signatory</p>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
