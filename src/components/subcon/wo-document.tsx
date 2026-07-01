import { DEFAULT_SIGNATURE, KEYVENDORS, KEYVENDORS_LINKS } from "@/lib/quotation/company";
import { woTotals } from "@/lib/data/compute";
import { amountInWords } from "@/lib/quotation/amount-in-words";
import { tradeLabel } from "@/lib/labels";
import type { Project, Subcontractor, SubconWorkOrder } from "@/lib/types";

const SALMON = "#e79b84";
const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n || 0);
const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "—";

function Logo({ big }: { big?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={big ? "/keyvendors-logo-square.png" : "/keyvendors-landscape.png"}
      alt="Keyvendors"
      className={`object-contain ${big ? "h-24 w-28" : "h-auto w-full"}`}
    />
  );
}

function Bar({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 py-1 text-center text-[11px] font-bold uppercase text-slate-900" style={{ background: SALMON }}>
      {children}
    </div>
  );
}

/** Pixel-faithful Keyvendors Work Order (on-screen preview + print). */
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
  const words = amountInWords(totals.grandTotal);

  return (
    <article
      id="quote-doc"
      style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}
      className="mx-auto w-full max-w-[820px] border border-slate-400 bg-white text-[11px] leading-snug text-slate-900 shadow-sm print:max-w-none print:shadow-none"
    >
      {/* Title banner */}
      <div className="py-2 text-center text-2xl font-extrabold tracking-wide text-white" style={{ background: SALMON }}>
        Work Order
      </div>

      {/* Header: From (left) + Date/Important Links (right) */}
      <div className="grid grid-cols-[1.5fr_1fr]">
        {/* left */}
        <div className="flex flex-col border-r border-slate-400">
          <div className="flex h-24 items-center justify-center px-4 py-1">
            <Logo />
          </div>
          <Bar>From</Bar>
          <div className="flex flex-1 flex-col justify-center divide-y divide-slate-300 border-y border-slate-300">
            <p className="px-3 py-1">
              <span className="font-semibold">Company name : </span>
              <span className="font-semibold" style={{ color: "#1A5FA8" }}>{KEYVENDORS.name}</span>
            </p>
            <p className="px-3 py-1 text-slate-600">Address: {KEYVENDORS.address}</p>
            <p className="px-3 py-1">Contact Person : {KEYVENDORS.contactPerson}</p>
            <p className="px-3 py-1">Contact: {KEYVENDORS.phones}</p>
            <p className="px-3 py-1">Email: {KEYVENDORS.email}</p>
            <p className="px-3 py-1 font-semibold">GSTIN: {KEYVENDORS.gstin}</p>
          </div>
        </div>
        {/* right */}
        <div className="flex flex-col">
          <div className="flex h-24 flex-col justify-center px-3 text-[11px]">
            <p><span className="font-semibold">DATE</span> &nbsp; {fmtDate(wo.date)}</p>
            <p><span className="font-semibold">Work Order No:</span> &nbsp; {wo.number || "—"}</p>
            {project?.code && <p><span className="font-semibold">Project Code:</span> &nbsp; {project.code}</p>}
          </div>
          <Bar>Important Links</Bar>
          <div className="flex flex-col items-center border-y border-slate-300 py-3">
            <Logo big />
          </div>
          <div className="flex flex-1 flex-col justify-center divide-y divide-slate-300 border-b border-slate-300 text-center text-[11px]" style={{ color: "#1f7a3d" }}>
            <a href={KEYVENDORS_LINKS.blog} target="_blank" rel="noreferrer" className="block py-1 hover:underline">
              Keyvendors Blogs
            </a>
            <a href={KEYVENDORS_LINKS.youtube} target="_blank" rel="noreferrer" className="block py-1 hover:underline">
              Keyvendors Youtube Channel
            </a>
            <a href={KEYVENDORS_LINKS.review} target="_blank" rel="noreferrer" className="block py-1 hover:underline">
              Review
            </a>
          </div>
        </div>
      </div>

      {/* Party detail */}
      <Bar>Party detail</Bar>
      <div className="border-y border-slate-300 px-3 py-2">
        {sc?.company && <p className="font-semibold">Name: {sc.company}</p>}
        {sc?.contact && <p>Contact Person: {sc.contact}</p>}
        {sc?.phone && <p>Mobile: {sc.phone}</p>}
        {sc && <p>Trade: {tradeLabel[sc.trade]}</p>}
        {sc?.gst && <p className="font-semibold">GSTIN: {sc.gst}</p>}
        {project?.name && <p>Project Name: {project.name}</p>}
        {project?.location && <p>Site: {project.location}</p>}
        {!sc && <p className="text-slate-400">Party details…</p>}
      </div>

      <div className="py-1.5 text-center text-sm font-bold">Work Order</div>
      <div className="border-b border-slate-300 px-3 py-1 font-medium">
        Note: Bill Will be Generated As Per Actual Measurement
      </div>

      {/* Items table */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-[10px] font-bold uppercase" style={{ background: SALMON }}>
            <th className="border border-slate-400 px-1 py-1 w-7">S.No.</th>
            <th className="border border-slate-400 px-2 py-1 text-left">Description</th>
            <th className="border border-slate-400 px-1 py-1 w-12">Unit</th>
            <th className="border border-slate-400 px-1 py-1 w-16">Quantity</th>
            <th className="border border-slate-400 px-1 py-1 w-20 text-right">Rate</th>
            <th className="border border-slate-400 px-1 py-1 w-16">Specific</th>
            <th className="border border-slate-400 px-1 py-1 w-24 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {wo.items.map((it, i) => (
            <tr key={it.id} className="align-top">
              <td className="border border-slate-400 px-1 py-1 text-center">{i + 1}</td>
              <td className="border border-slate-400 px-2 py-1">{it.description}</td>
              <td className="border border-slate-400 px-1 py-1 text-center">{it.unit}</td>
              <td className="border border-slate-400 px-1 py-1 text-center tabular-nums">
                {it.qty ? new Intl.NumberFormat("en-IN").format(it.qty) : ""}
              </td>
              <td className="border border-slate-400 px-1 py-1 text-right tabular-nums">{it.rate ? inr(it.rate) : ""}</td>
              <td className="border border-slate-400 px-1 py-1" />
              <td className="border border-slate-400 px-1 py-1 text-right tabular-nums">{inr(it.qty * it.rate)}</td>
            </tr>
          ))}
          {wo.items.length === 0 && (
            <tr>
              <td colSpan={7} className="border border-slate-400 px-2 py-6 text-center text-slate-400">No items added yet.</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Totals + amount in words */}
      <div className="grid grid-cols-2">
        <div className="border-r border-slate-300 px-3 py-2">
          <p><span className="font-semibold">Amount in Words:</span> {words}</p>
        </div>
        <table className="w-full border-collapse">
          <tbody className="tabular-nums">
            <TRow label="Sub Total" value={inr(totals.subtotal)} />
            <TRow label="Discount" value={"0"} />
            <TRow label="Final Amount" value={inr(totals.taxable)} bold />
            <TRow label={`CGST ${wo.taxRate / 2}%`} value={inr(totals.cgst)} />
            <TRow label={`SGST ${wo.taxRate / 2}%`} value={inr(totals.sgst)} />
            <TRow label="Payable GST" value={inr(totals.cgst + totals.sgst)} />
            <TRow label="Grand Total" value={"₹" + inr(totals.grandTotal)} bold highlight />
          </tbody>
        </table>
      </div>

      {/* Signatures + bank */}
      <div className="grid grid-cols-2 border-t border-slate-300">
        <div className="border-r border-slate-300 px-3 py-2 text-[10px]">
          <p className="font-semibold">Keyvendors India Pvt Ltd — Bank Details</p>
          <p>Bank: {KEYVENDORS.bank.bank}</p>
          <p>Branch: {KEYVENDORS.bank.branch}</p>
          <p>IFSC: {KEYVENDORS.bank.ifsc} · MICR: {KEYVENDORS.bank.micr}</p>
          <p>A/c No.: {KEYVENDORS.bank.account}</p>
        </div>
        <div className="flex flex-col justify-end px-3 py-2 text-center text-[10px]">
          <div className="mt-6 grid grid-cols-2 items-end gap-3">
            <div className="border-t border-slate-400 pt-1">Party Signature</div>
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={DEFAULT_SIGNATURE} alt="Business signature" className="mx-auto mb-1 h-20 w-auto max-w-full object-contain" />
              <div className="border-t border-slate-400 pt-1">Business Signature</div>
            </div>
          </div>
        </div>
      </div>

      <div className="py-1.5 text-center text-[11px] font-medium" style={{ background: SALMON }}>
        Thanks for business with us!!! Please visit us again !!!
      </div>
    </article>
  );
}

function TRow({ label, value, bold, highlight }: { label: string; value: string; bold?: boolean; highlight?: boolean }) {
  return (
    <tr style={highlight ? { background: SALMON } : undefined}>
      <td className={`border border-slate-400 px-2 py-1 text-[10px] ${bold ? "font-semibold" : ""}`}>{label}</td>
      <td className={`border border-slate-400 px-2 py-1 text-right ${bold ? "font-bold" : ""}`}>{value}</td>
    </tr>
  );
}
