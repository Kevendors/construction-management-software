import { KEYVENDORS } from "@/lib/quotation/company";
import type { ChallanState } from "@/app/challans/actions";

const SALMON = "#e79b84";
const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "—";

function Logo() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/keyvendors-landscape.png" alt="Keyvendors" className="h-auto w-full object-contain" />;
}

function Bar({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 py-1 text-center text-[11px] font-bold uppercase text-slate-900" style={{ background: SALMON }}>
      {children}
    </div>
  );
}

/** Pixel-faithful Keyvendors Delivery Challan (matches Quotation/Invoice branding). */
export function ChallanDocument({ s, projectName, projectLocation }: { s: ChallanState; projectName: string; projectLocation: string }) {
  return (
    <article
      id="challan-doc"
      className="mx-auto w-full max-w-[820px] border border-slate-400 bg-white text-[11px] leading-snug text-slate-900 shadow-sm print:max-w-none print:shadow-none"
    >
      <div className="py-2 text-center text-2xl font-extrabold tracking-wide text-white" style={{ background: SALMON }}>
        Delivery Challan
      </div>

      <div className="grid grid-cols-[1.5fr_1fr]">
        <div className="border-r border-slate-400">
          <div className="flex h-20 items-center justify-center px-4 py-1">
            <Logo />
          </div>
          <Bar>From</Bar>
          <div className="divide-y divide-slate-300 border-y border-slate-300">
            <p className="px-3 py-1">
              <span className="font-semibold">Company name : </span>
              <span className="font-semibold" style={{ color: "#1A5FA8" }}>{KEYVENDORS.name}</span>
            </p>
            <p className="px-3 py-1 text-slate-600">Address: {KEYVENDORS.address}</p>
            <p className="px-3 py-1">Contact: {KEYVENDORS.phones}</p>
          </div>
          <Bar>To (Project Site)</Bar>
          <div className="border-b border-slate-300 px-3 py-2">
            <p className="font-semibold">{projectName || "—"}</p>
            {projectLocation && <p className="text-slate-600">{projectLocation}</p>}
          </div>
        </div>
        <div>
          <div className="flex h-20 flex-col justify-center px-3 text-[11px]">
            <p><span className="font-semibold">Challan No:</span> &nbsp; {s.number || "—"}</p>
            <p><span className="font-semibold">DATE</span> &nbsp; {fmtDate(s.date)}</p>
          </div>
          <Bar>Transport Details</Bar>
          <div className="divide-y divide-slate-300 border-b border-slate-300">
            <p className="px-3 py-1">Vehicle No: {s.vehicleNumber || "—"}</p>
            <p className="px-3 py-1">Transporter: {s.transporterName || "—"}</p>
          </div>
        </div>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="text-[10px] font-bold uppercase" style={{ background: SALMON }}>
            <th className="border border-slate-400 px-1 py-1 w-10">S.No.</th>
            <th className="border border-slate-400 px-2 py-1 text-left">Description</th>
            <th className="border border-slate-400 px-1 py-1 w-20">Unit</th>
            <th className="border border-slate-400 px-1 py-1 w-20">Qty</th>
          </tr>
        </thead>
        <tbody>
          {s.lines.filter((l) => l.description.trim()).map((l, i) => (
            <tr key={l.id} className="align-top">
              <td className="border border-slate-400 px-1 py-1 text-center">{i + 1}</td>
              <td className="border border-slate-400 px-2 py-1">{l.description}</td>
              <td className="border border-slate-400 px-1 py-1 text-center">{l.unit}</td>
              <td className="border border-slate-400 px-1 py-1 text-center tabular-nums">{l.qty}</td>
            </tr>
          ))}
          {s.lines.filter((l) => l.description.trim()).length === 0 && (
            <tr>
              <td colSpan={4} className="border border-slate-400 px-2 py-6 text-center text-slate-400">No items added yet.</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="border-t border-slate-300 px-3 py-2 text-center text-[11px] font-semibold">
        Not for Sale — Goods sent {s.purposeNote ? `for ${s.purposeNote}` : "for site use"}
      </div>

      <div className="grid grid-cols-2 border-t border-slate-300 text-center text-[10px]">
        <div className="border-r border-slate-300 px-3 py-6">
          <div className="border-t border-slate-400 pt-1">Receiver&apos;s Signature</div>
        </div>
        <div className="px-3 py-6">
          <div className="border-t border-slate-400 pt-1">For {KEYVENDORS.name}</div>
        </div>
      </div>
    </article>
  );
}
