import { KEYVENDORS, OTHER_SERVICES } from "@/lib/quotation/company";
import type { ComputedLine, ComputedQuote, QuoteState } from "@/lib/quotation/compute";

const SALMON = "#e79b84";
const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n || 0);
const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "—";

function Logo({ big }: { big?: boolean }) {
  // Square (stacked) mark for the vertical "Important Links" panel,
  // landscape (horizontal) mark for the header.
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

function displayQty(l: ComputedLine) {
  if (l.unit === "LUMPSUM") return "Lump sum";
  const q = l.usesSqft ? (l.qty || 0) * (l.sqft || 0) : l.qty || 0;
  return q ? new Intl.NumberFormat("en-IN").format(q) : "";
}

/** Pixel-faithful Keyvendors quotation (on-screen preview + print). */
export function QuotationDocument({ s, c }: { s: QuoteState; c: ComputedQuote }) {
  return (
    <article
      id="quote-doc"
      // print-color-adjust forces the salmon section bars / banners (and their
      // white text) to render in print & PDF — browsers otherwise strip page
      // background colours and recolour the text, flattening the layout.
      style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as React.CSSProperties}
      className="mx-auto w-full max-w-[820px] border border-slate-400 bg-white text-[11px] leading-snug text-slate-900 shadow-sm print:max-w-none print:shadow-none"
    >
      {/* Title banner */}
      <div className="py-2 text-center text-2xl font-extrabold tracking-wide text-white" style={{ background: SALMON }}>
        Quotation
      </div>

      {/* Header: From (left) + Date/Important Links (right) */}
      <div className="grid grid-cols-[1.5fr_1fr]">
        {/* left */}
        <div className="border-r border-slate-400">
          <div className="flex h-24 items-center justify-center px-4 py-1">
            <Logo />
          </div>
          <Bar>From</Bar>
          <div className="divide-y divide-slate-300 border-y border-slate-300">
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
        <div>
          <div className="flex h-24 flex-col justify-center px-3 text-[11px]">
            <p><span className="font-semibold">DATE</span> &nbsp; {fmtDate(s.date)}</p>
            <p><span className="font-semibold">Ref / Quote No:</span> &nbsp; {s.number || "—"}</p>
            {s.validTill && <p><span className="font-semibold">Valid Till:</span> &nbsp; {fmtDate(s.validTill)}</p>}
          </div>
          <Bar>Important Links</Bar>
          <div className="flex flex-col items-center border-y border-slate-300 py-3">
            <Logo big />
          </div>
          <div className="divide-y divide-slate-300 border-b border-slate-300 text-center text-[11px]" style={{ color: "#1f7a3d" }}>
            <p className="py-1">Keyvendors Blogs</p>
            <p className="py-1">Keyvendors Youtube Channel</p>
            <p className="py-1">Review</p>
          </div>
        </div>
      </div>

      {/* Client Details */}
      <Bar>Client Details</Bar>
      <div className="border-y border-slate-300 px-3 py-2">
        {s.clientName && <p className="font-semibold">Name: {s.clientName}</p>}
        {s.company && <p className="font-semibold">{s.company}</p>}
        {s.address && <p>Address: {s.address}</p>}
        {s.siteLocation && <p>Site: {s.siteLocation}</p>}
        {s.contact && <p>Mobile: {s.contact}</p>}
        {s.email && <p>Email: {s.email}</p>}
        {s.clientGstin && <p className="font-semibold">GSTIN: {s.clientGstin}</p>}
        {!s.clientName && !s.company && <p className="text-slate-400">Client details…</p>}
      </div>

      <div className="py-1.5 text-center text-sm font-bold">Quotation</div>
      {s.quoteName && <div className="border-y border-slate-300 px-3 py-1 text-center font-semibold">{s.quoteName}</div>}
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
          {c.lines.map((l, i) => (
            <tr key={l.id} className="align-top">
              <td className="border border-slate-400 px-1 py-1 text-center">{i + 1}</td>
              <td className="border border-slate-400 px-2 py-1">{l.description}</td>
              <td className="border border-slate-400 px-1 py-1 text-center">{l.unit}</td>
              <td className="border border-slate-400 px-1 py-1 text-center tabular-nums">{displayQty(l)}</td>
              <td className="border border-slate-400 px-1 py-1 text-right tabular-nums">{l.rate ? inr(l.rate) : ""}</td>
              <td className="border border-slate-400 px-1 py-1" />
              <td className="border border-slate-400 px-1 py-1 text-right tabular-nums">{inr(l.amount)}</td>
            </tr>
          ))}
          {c.lines.length === 0 && (
            <tr>
              <td colSpan={7} className="border border-slate-400 px-2 py-6 text-center text-slate-400">No items added yet.</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Totals + amount in words */}
      <div className="grid grid-cols-2">
        <div className="border-r border-slate-300 px-3 py-2">
          <p><span className="font-semibold">Amount in Words:</span> {c.words}</p>
        </div>
        <table className="w-full border-collapse">
          <tbody className="tabular-nums">
            <TRow label="Sub Total" value={inr(c.subtotal)} />
            <TRow label="Discount" value={c.discount ? "- " + inr(c.discount) : "0"} />
            {c.additionalCharges > 0 && <TRow label={s.additionalLabel || "Additional"} value={inr(c.additionalCharges)} />}
            <TRow label="Final Amount" value={inr(c.finalAmount)} bold />
            {s.taxMode === "intra" ? (
              <>
                <TRow label={`CGST ${c.gstRate / 2}%`} value={inr(c.cgst)} />
                <TRow label={`SGST ${c.gstRate / 2}%`} value={inr(c.sgst)} />
              </>
            ) : (
              <TRow label={`IGST ${c.gstRate}%`} value={inr(c.igst)} />
            )}
            <TRow label="Payable GST" value={inr(c.payableGst)} />
            <TRow label="Grand Total" value={"₹" + inr(c.grandTotal)} bold highlight />
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
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="border-t border-slate-400 pt-1">Client&apos;s Signature</div>
            <div className="border-t border-slate-400 pt-1">Business Signature</div>
          </div>
        </div>
      </div>

      {/* Terms */}
      {s.terms && (
        <div className="border-t border-slate-300 px-3 py-2 text-[10px]">
          <p className="font-semibold">Note / Terms &amp; Conditions:</p>
          <p className="mt-1 whitespace-pre-line text-slate-700">{s.terms}</p>
          {s.notes && <p className="mt-2 whitespace-pre-line text-slate-700">{s.notes}</p>}
        </div>
      )}

      {/* Services */}
      <div className="border-t border-slate-300 px-3 py-2 text-[10px]">
        <p className="font-semibold">We Also Provide These Services:</p>
        <p className="mt-1 text-slate-700">{OTHER_SERVICES.join(" · ")}</p>
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
