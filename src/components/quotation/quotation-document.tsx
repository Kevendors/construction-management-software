import { KEYVENDORS, OTHER_SERVICES } from "@/lib/quotation/company";
import type { ComputedQuote, QuoteState } from "@/lib/quotation/compute";

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n || 0);
const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "—";

/** Pixel-faithful Keyvendors quotation, used for on-screen preview + print. */
export function QuotationDocument({ s, c }: { s: QuoteState; c: ComputedQuote }) {
  return (
    <article
      id="quote-doc"
      className="mx-auto w-full max-w-[820px] bg-white p-6 text-[12px] leading-snug text-slate-900 shadow-sm print:max-w-none print:p-0 print:shadow-none"
    >
      {/* Title banner */}
      <div className="rounded-t-md bg-amber-500 py-2 text-center text-xl font-extrabold tracking-wide text-slate-900">
        QUOTATION
      </div>

      {/* Header: brand + date/ref + from / client / links */}
      <div className="grid grid-cols-2 gap-4 border border-t-0 border-slate-300 p-4">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-900 text-amber-500 text-lg font-black">K</span>
            <span className="text-lg font-extrabold tracking-tight text-slate-900">KEYVENDORS</span>
          </div>
          <div className="bg-amber-100 px-2 py-1 text-center text-[11px] font-bold uppercase">From</div>
          <p className="mt-1 font-semibold">{KEYVENDORS.name}</p>
          <p className="text-slate-600">Address: {KEYVENDORS.address}</p>
          <p>Contact Person: {KEYVENDORS.contactPerson}</p>
          <p>Contact: {KEYVENDORS.phones}</p>
          <p>Email: {KEYVENDORS.email}</p>
          <p className="font-semibold">GSTIN: {KEYVENDORS.gstin}</p>
        </div>
        <div className="text-right">
          <p><span className="font-semibold">DATE:</span> {fmtDate(s.date)}</p>
          <p><span className="font-semibold">Ref / Quote No:</span> {s.number || "—"}</p>
          {s.validTill && <p><span className="font-semibold">Valid Till:</span> {fmtDate(s.validTill)}</p>}
          <div className="mt-4 bg-amber-100 px-2 py-1 text-center text-[11px] font-bold uppercase">Client Details</div>
          <div className="mt-1 text-left">
            {s.clientName && <p className="font-semibold">{s.clientName}</p>}
            {s.company && <p>{s.company}</p>}
            {s.contact && <p>Contact: {s.contact}</p>}
            {s.email && <p>Email: {s.email}</p>}
            {s.address && <p className="text-slate-600">{s.address}</p>}
            {s.siteLocation && <p className="text-slate-600">Site: {s.siteLocation}</p>}
            {s.clientGstin && <p className="font-semibold">GSTIN: {s.clientGstin}</p>}
          </div>
        </div>
      </div>

      {s.quoteName && (
        <div className="border border-t-0 border-slate-300 bg-slate-50 px-3 py-1.5 text-center font-semibold">
          {s.quoteName}
        </div>
      )}
      <div className="border border-t-0 border-slate-300 px-3 py-1.5 text-[11px] font-medium">
        Note: Bill will be generated as per actual measurement.
      </div>

      {/* Items table */}
      <table className="w-full border-collapse border border-t-0 border-slate-300">
        <thead>
          <tr className="bg-slate-100 text-[11px] uppercase">
            <th className="border border-slate-300 px-2 py-1 text-left w-8">S.No.</th>
            <th className="border border-slate-300 px-2 py-1 text-left">Description</th>
            <th className="border border-slate-300 px-2 py-1 w-12">Unit</th>
            <th className="border border-slate-300 px-2 py-1 w-12">Qty</th>
            <th className="border border-slate-300 px-2 py-1 w-14">Sq.ft</th>
            <th className="border border-slate-300 px-2 py-1 w-20 text-right">Rate</th>
            <th className="border border-slate-300 px-2 py-1 w-24 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {c.lines.map((l, i) => (
            <tr key={l.id} className="align-top">
              <td className="border border-slate-300 px-2 py-1 text-center">{i + 1}</td>
              <td className="border border-slate-300 px-2 py-1">{l.description}</td>
              <td className="border border-slate-300 px-2 py-1 text-center">{l.unit}</td>
              <td className="border border-slate-300 px-2 py-1 text-center tabular-nums">{l.qty || ""}</td>
              <td className="border border-slate-300 px-2 py-1 text-center tabular-nums">{l.usesSqft ? l.sqft || "" : "—"}</td>
              <td className="border border-slate-300 px-2 py-1 text-right tabular-nums">{l.rate ? inr(l.rate) : ""}</td>
              <td className="border border-slate-300 px-2 py-1 text-right tabular-nums">{inr(l.amount)}</td>
            </tr>
          ))}
          {c.lines.length === 0 && (
            <tr>
              <td colSpan={7} className="border border-slate-300 px-2 py-6 text-center text-slate-400">
                No items added yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end">
        <table className="w-72 border-collapse border border-t-0 border-slate-300">
          <tbody className="tabular-nums">
            <Row label="Sub Total" value={inr(c.subtotal)} />
            {c.discount > 0 && <Row label="Discount" value={"- " + inr(c.discount)} />}
            {c.additionalCharges > 0 && <Row label={s.additionalLabel || "Additional Charges"} value={inr(c.additionalCharges)} />}
            <Row label="Final Amount" value={inr(c.finalAmount)} bold />
            {s.taxMode === "intra" ? (
              <>
                <Row label={`CGST ${c.gstRate / 2}%`} value={inr(c.cgst)} />
                <Row label={`SGST ${c.gstRate / 2}%`} value={inr(c.sgst)} />
              </>
            ) : (
              <Row label={`IGST ${c.gstRate}%`} value={inr(c.igst)} />
            )}
            <Row label="Payable GST" value={inr(c.payableGst)} />
            <Row label="Grand Total" value={"₹" + inr(c.grandTotal)} bold highlight />
          </tbody>
        </table>
      </div>

      <div className="border border-t-0 border-slate-300 px-3 py-1.5">
        <span className="font-semibold">Amount in Words:</span> {c.words}
      </div>

      {/* Bank + signatures */}
      <div className="grid grid-cols-2 gap-4 border border-t-0 border-slate-300 p-3">
        <div className="text-[11px]">
          <p className="font-semibold">Bank Details</p>
          <p>{KEYVENDORS.bank.accountName}</p>
          <p>Bank: {KEYVENDORS.bank.bank}</p>
          <p>Branch: {KEYVENDORS.bank.branch}</p>
          <p>IFSC: {KEYVENDORS.bank.ifsc} · MICR: {KEYVENDORS.bank.micr}</p>
          <p>A/c No.: {KEYVENDORS.bank.account}</p>
        </div>
        <div className="flex flex-col justify-end text-center text-[11px]">
          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="border-t border-slate-400 pt-1">Client&apos;s Signature</div>
            <div className="border-t border-slate-400 pt-1">Business Signature</div>
          </div>
        </div>
      </div>

      {/* Terms */}
      {s.terms && (
        <div className="border border-t-0 border-slate-300 p-3 text-[11px]">
          <p className="font-semibold">Terms &amp; Conditions / Notes</p>
          <p className="mt-1 whitespace-pre-line text-slate-700">{s.terms}</p>
          {s.notes && <p className="mt-2 whitespace-pre-line text-slate-700">{s.notes}</p>}
        </div>
      )}

      {/* Other services */}
      <div className="border border-t-0 border-slate-300 p-3 text-[11px]">
        <p className="font-semibold">We Also Provide These Services:</p>
        <p className="mt-1 text-slate-700">{OTHER_SERVICES.join(" · ")}</p>
      </div>

      <div className="rounded-b-md bg-amber-100 py-1.5 text-center text-[11px] font-medium">
        Thanks for your business with us! Please visit us again.
      </div>
    </article>
  );
}

function Row({ label, value, bold, highlight }: { label: string; value: string; bold?: boolean; highlight?: boolean }) {
  return (
    <tr className={highlight ? "bg-amber-100" : ""}>
      <td className={`border border-slate-300 px-2 py-1 text-[11px] ${bold ? "font-semibold" : ""}`}>{label}</td>
      <td className={`border border-slate-300 px-2 py-1 text-right ${bold ? "font-bold" : ""}`}>{value}</td>
    </tr>
  );
}
