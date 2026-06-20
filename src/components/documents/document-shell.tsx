import Link from "next/link";
import { ArrowLeft, HardHat } from "lucide-react";
import { PrintButton } from "./print-button";

/**
 * A4 document wrapper for printable PO / Work Order views.
 * The action bar (back + print) is hidden when printing; @media print rules in
 * globals.css strip the app sidebar/topbar so only this document remains.
 */
export function DocumentShell({
  backHref,
  backLabel,
  docType,
  children,
}: {
  backHref: string;
  backLabel: string;
  docType: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[820px]">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {backLabel}
        </Link>
        <PrintButton />
      </div>

      <article className="rounded-lg border border-border bg-white p-8 text-sm text-slate-900 shadow-sm print:border-0 print:p-0 print:shadow-none">
        {/* firm header */}
        <header className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 text-amber-500">
              <HardHat className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Charu Construction & Design</h1>
              <p className="text-xs text-slate-500">
                Architecture · Building · Interiors · GSTIN 09AAACH0000A1Z5
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-base font-bold uppercase tracking-wide text-slate-900">{docType}</p>
          </div>
        </header>

        {children}

        <footer className="mt-8 border-t border-slate-200 pt-3 text-center text-[11px] text-slate-400">
          This is a system-generated document from SiteHub.
        </footer>
      </article>
    </div>
  );
}
