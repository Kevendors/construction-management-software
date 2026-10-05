import { DEFAULT_SIGNATURE, KEYVENDORS } from "@/lib/quotation/company";
import type { WorkProgressReportState } from "@/app/reports/work-progress/actions";

const SALMON = "#e79b84";
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

function Section({ title, body }: { title: string; body: string }) {
  if (!body) return null;
  return (
    <div className="border-t border-slate-300 px-3 py-2">
      <p className="text-[11px] font-bold uppercase" style={{ color: "#1A5FA8" }}>{title}</p>
      <p className="mt-1 whitespace-pre-wrap text-[11px] text-slate-700">{body}</p>
    </div>
  );
}

/** Pixel-faithful Keyvendors Work Progress Report (matches Quotation/Invoice branding). */
export function WorkProgressReportDocument({
  s,
  projectName,
}: {
  s: WorkProgressReportState;
  projectName: string;
}) {
  return (
    <article
      id="wpr-doc"
      className="mx-auto w-full max-w-[820px] border border-slate-400 bg-white text-[11px] leading-snug text-slate-900 shadow-sm print:max-w-none print:shadow-none"
    >
      <div className="py-2 text-center text-2xl font-extrabold tracking-wide text-white" style={{ background: SALMON }}>
        Work Progress Report
      </div>

      <div className="grid grid-cols-[1.5fr_1fr]">
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
          </div>
        </div>
        <div>
          <div className="flex h-24 flex-col justify-center px-3 text-[11px]">
            <p><span className="font-semibold">Report No:</span> &nbsp; {s.number || "—"}</p>
            <p><span className="font-semibold">DATE</span> &nbsp; {fmtDate(s.date)}</p>
            {(s.periodStart || s.periodEnd) && (
              <p><span className="font-semibold">Period:</span> &nbsp; {fmtDate(s.periodStart)} – {fmtDate(s.periodEnd)}</p>
            )}
          </div>
          <Bar>Project</Bar>
          <div className="flex flex-col items-center justify-center gap-2 border-y border-slate-300 px-3 py-4 text-center">
            <p className="font-semibold">{projectName || "—"}</p>
            {typeof s.percentComplete === "number" && (
              <p className="text-2xl font-extrabold" style={{ color: "#1A5FA8" }}>{s.percentComplete}% Complete</p>
            )}
          </div>
        </div>
      </div>

      <Section title="Work Completed" body={s.workCompleted} />
      <Section title="Plan for Next Period" body={s.nextPlan} />
      <Section title="Issues / Delays" body={s.issues} />

      {s.photoUrls?.length > 0 && (
        <div className="border-t border-slate-300 px-3 py-2">
          <p className="text-[11px] font-bold uppercase" style={{ color: "#1A5FA8" }}>Site Photos</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {s.photoUrls.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={url} alt={`Site photo ${i + 1}`} className="h-28 w-full rounded border border-slate-300 object-cover" />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col items-end border-t border-slate-300 px-3 py-2 text-center text-[10px]">
        <div className="mt-2 w-48">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.signatureUrl || DEFAULT_SIGNATURE} alt="Business signature" className="mx-auto mb-1 h-20 w-full object-contain" />
          <div className="border-t border-slate-400 pt-1">For {KEYVENDORS.name}</div>
        </div>
      </div>

      <div className="py-1.5 text-center text-[11px] font-medium" style={{ background: SALMON }}>
        Thanks for business with us!!! Please visit us again !!!
      </div>
    </article>
  );
}
