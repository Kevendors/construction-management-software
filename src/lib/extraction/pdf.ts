import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import type { PDFPageProxy } from "pdfjs-dist";
import Tesseract from "tesseract.js";
import { extractHeaderFields, extractLinesFromText } from "./line-heuristics";
import { emptyExtractedQuote, type ExtractedQuote } from "./schema";

/**
 * Browser-only PDF extraction — text-layer reading when the PDF has one,
 * OCR (Tesseract.js) when it doesn't. Runs entirely client-side: the browser
 * already has Canvas built in, so page rendering for OCR needs no native
 * dependency the way server-side rendering would.
 *
 * pdf.js needs its worker script's URL; `new URL(..., import.meta.url)` lets
 * the bundler resolve and serve it as a static asset. Guarded so importing
 * this module outside a browser (SSR) can't throw.
 */
if (typeof window !== "undefined") {
  GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
}

// Below this many non-whitespace characters per page, treat the document as
// having no usable text layer (a scan or a photo) rather than a thin one.
const MIN_CHARS_PER_PAGE_FOR_TEXT = 40;
// Render scale for OCR — high enough for reasonable character recognition
// without producing an unreasonably large canvas on a multi-page document.
const OCR_RENDER_SCALE = 2.5;

interface PositionedText {
  str: string;
  transform: number[];
}

/**
 * Group a page's text items into visual lines by y-position, left-to-right
 * within each line by x-position. PDF.js reports text in whatever order the
 * PDF's content stream wrote it, which is frequently not reading order —
 * this reconstructs it well enough for the row heuristic in
 * line-heuristics.ts, which only needs "roughly one row per line", not a
 * pixel-perfect table grid.
 */
async function pageTextLines(page: PDFPageProxy): Promise<{ lines: string[]; charCount: number }> {
  const content = await page.getTextContent();
  // pdf.js's TextItem type isn't re-exported from the package's top-level
  // entry, so this is a runtime filter (TextMarkedContent entries lack
  // `str`/`transform`) followed by a single cast rather than a type
  // predicate against an unimported type.
  const items = content.items.filter(
    (it) => typeof it === "object" && it !== null && "str" in it && "transform" in it
  ) as PositionedText[];
  const charCount = items.reduce((n, it) => n + it.str.trim().length, 0);

  const rows: { y: number; parts: { x: number; str: string }[] }[] = [];
  for (const it of items) {
    if (!it.str.trim()) continue;
    const x = it.transform[4];
    const y = it.transform[5];
    let row = rows.find((r) => Math.abs(r.y - y) < 3);
    if (!row) {
      row = { y, parts: [] };
      rows.push(row);
    }
    row.parts.push({ x, str: it.str });
  }
  // PDF user-space y grows upward, so the top of the page has the largest y.
  rows.sort((a, b) => b.y - a.y);
  const lines = rows.map((r) =>
    r.parts
      .sort((a, b) => a.x - b.x)
      .map((p) => p.str)
      .join(" ")
  );
  return { lines, charCount };
}

async function renderPageToCanvas(page: PDFPageProxy): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale: OCR_RENDER_SCALE });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvas, viewport }).promise;
  return canvas;
}

/** Extract a quotation from a PDF's raw bytes. */
export async function extractFromPdf(bytes: Uint8Array): Promise<ExtractedQuote> {
  const doc = await getDocument({ data: bytes }).promise;
  const base = emptyExtractedQuote();

  const perPageLines: string[][] = [];
  let totalChars = 0;
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const { lines, charCount } = await pageTextLines(page);
    perPageLines.push(lines);
    totalChars += charCount;
  }

  const looksScanned = totalChars < doc.numPages * MIN_CHARS_PER_PAGE_FOR_TEXT;
  let allLines: string[];
  let ocrUsed = false;

  if (!looksScanned) {
    allLines = perPageLines.flat();
  } else {
    // No usable text layer — this is a scan or a photo. Fall back to OCR,
    // reusing one worker across every page rather than paying its startup
    // cost per page.
    ocrUsed = true;
    const worker = await Tesseract.createWorker("eng");
    const ocrLines: string[] = [];
    try {
      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const canvas = await renderPageToCanvas(page);
        const { data } = await worker.recognize(canvas);
        ocrLines.push(...data.text.split("\n"));
      }
    } finally {
      await worker.terminate();
    }
    allLines = ocrLines;
  }

  const fullText = allLines.join("\n");
  const headerFields = extractHeaderFields(fullText);
  const { lines, lowConfidence, gstRate, discount } = extractLinesFromText(allLines);

  // OCR reads characters, not table structure — it's meaningfully less
  // reliable than a real text layer even where the row heuristic itself
  // didn't flag anything, so every OCR'd line's figures get a second look.
  const ocrLowConfidence = ocrUsed ? lines.flatMap((_, i) => [`lines[${i}].qty`, `lines[${i}].rate`]) : [];

  return {
    ...base,
    ...headerFields,
    lines,
    gstRate: gstRate ?? base.gstRate,
    discount: discount ?? base.discount,
    lowConfidence: Array.from(new Set([...headerFields.lowConfidence, ...lowConfidence, ...ocrLowConfidence])),
  };
}
