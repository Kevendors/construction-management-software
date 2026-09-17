"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileSpreadsheet, FileText, Upload, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { uploadQuotationFileAction } from "../upload-actions";
import { toQuoteState } from "@/lib/extraction/to-quote-state";
import type { ExtractedQuote } from "@/lib/extraction/schema";

const ACCEPT = ".pdf,.xlsx,.xls,.csv,application/pdf,application/vnd.ms-excel,text/csv," +
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
}

type Stage = "idle" | "uploading" | "extracting" | "error";

/**
 * Extraction runs entirely in the browser — no server round trip, no
 * external service. `pdf.ts`/`excel.ts` are dynamically imported so their
 * (fairly large) parsing libraries only ever load on this page, not in
 * every bundle that happens to import from this route.
 */
async function extractLocally(file: File): Promise<ExtractedQuote> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") {
    const { extractFromPdf } = await import("@/lib/extraction/pdf");
    const bytes = new Uint8Array(await file.arrayBuffer());
    return extractFromPdf(bytes);
  }
  const { extractFromWorkbook } = await import("@/lib/extraction/excel");
  const bytes = new Uint8Array(await file.arrayBuffer());
  return extractFromWorkbook(bytes);
}

/**
 * Attach a quotation prepared outside SiteHub (PDF/Excel/CSV) and pre-fill
 * the builder from it for review. The file itself is uploaded first and
 * independently of extraction, so a failed or low-confidence extraction
 * still leaves the source attached and the user can fill in the quotation
 * by hand.
 */
export default function UploadQuotationPage() {
  const router = useRouter();
  const [stage, setStage] = React.useState<Stage>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setStage("uploading");
    let path: string;
    let fileUrl: string | null;
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await uploadQuotationFileAction(file.name, dataUrl);
      if (res.error || !res.file) {
        setError(res.error ?? "Could not upload that file.");
        setStage("error");
        return;
      }
      path = res.file.path;
      fileUrl = res.file.url;
    } catch {
      setError("Could not read that file.");
      setStage("error");
      return;
    }

    setStage("extracting");
    let extracted: ExtractedQuote | null = null;
    let extractionNotice: string | undefined;
    try {
      extracted = await extractLocally(file);
      if (extracted.lines.length === 0) {
        extracted = null;
        extractionNotice = "Couldn't find a recognisable item table in this file — enter the quotation manually below.";
      }
    } catch {
      extractionNotice = "Couldn't read this file automatically — enter the quotation manually below.";
    }

    // Hand off to the builder either way — with extracted data when it
    // worked, or just the attached file when it didn't (manual entry).
    // Same localStorage prefill mechanism "Convert to Invoice" uses.
    try {
      localStorage.setItem(
        "sitehub:newQuotationPrefill",
        JSON.stringify({
          state: extracted ? toQuoteState(extracted) : undefined,
          lowConfidence: extracted?.lowConfidence ?? [],
          sourceFile: { path, name: file.name, url: fileUrl },
          extractionNotice,
        })
      );
    } catch {
      /* ignore (quota/private-browsing) — the file is uploaded either way */
    }
    router.push("/quotations/new");
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link
        href="/quotations"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Quotations
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload an Existing Quotation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Attach a quotation prepared outside SiteHub as a PDF, Excel, or CSV file. Client
            details and line items are extracted automatically where possible, entirely on your
            device — you&apos;ll review and correct everything before it&apos;s saved.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => stage === "idle" || stage === "error" ? inputRef.current?.click() : undefined}
            className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
              dragging ? "border-primary bg-primary/5" : "border-border"
            } ${stage === "idle" || stage === "error" ? "cursor-pointer hover:border-primary/50" : ""}`}
          >
            {stage === "uploading" || stage === "extracting" ? (
              <>
                <UploadCloud className="h-8 w-8 animate-pulse text-muted-foreground" />
                <p className="text-sm font-medium">
                  {stage === "uploading" ? "Uploading…" : "Reading the quotation…"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {stage === "extracting" && "A scanned PDF can take a minute or more — it's being read on your device."}
                </p>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">Click to choose a file, or drag it here</p>
                <p className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> PDF</span>
                  <span className="inline-flex items-center gap-1"><FileSpreadsheet className="h-3.5 w-3.5" /> Excel / CSV</span>
                </p>
              </>
            )}
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="ml-3"
                onClick={() => {
                  setStage("idle");
                  setError(null);
                }}
              >
                Try again
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Prefer to type it in yourself?{" "}
            <Link href="/quotations/new" className="text-primary hover:underline">
              Start a blank quotation
            </Link>{" "}
            instead.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
