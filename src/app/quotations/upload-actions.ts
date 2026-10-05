"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "quotation-files";
// Long enough to stay valid through the whole upload -> review -> save
// session (a very large item list can take a while to check line by line).
const SIGNED_TTL = 60 * 60 * 24; // 1 day

async function currentOrgId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  return (data?.org_id as string | undefined) ?? null;
}

function decodeDataUrl(dataUrl: string): { buffer: Buffer; contentType: string } | null {
  const m = /^data:(.+?);base64,([\s\S]*)$/.exec(dataUrl);
  if (!m) return null;
  return { buffer: Buffer.from(m[2], "base64"), contentType: m[1] };
}

function extFor(contentType: string, fileName: string): string {
  if (contentType === "application/pdf") return "pdf";
  const fromName = fileName.split(".").pop()?.toLowerCase();
  if (fromName && ["xlsx", "xls", "csv"].includes(fromName)) return fromName;
  if (contentType.includes("spreadsheet") || contentType.includes("excel")) return "xlsx";
  if (contentType === "text/csv") return "csv";
  return "bin";
}

export interface UploadedQuotationFile {
  path: string;
  name: string;
  url: string | null;
  contentType: string;
}

export interface UploadResult {
  file?: UploadedQuotationFile;
  error?: string;
}

/**
 * Store an externally-prepared quotation file. Extraction itself now runs
 * client-side (src/lib/extraction/{pdf,excel}.ts) — this action only ever
 * stores the original so it stays attached to the quotation as the source
 * of record, regardless of how extraction goes.
 */
export async function uploadQuotationFileAction(
  fileName: string,
  dataUrl: string
): Promise<UploadResult> {
  const supabase = await createClient();
  const orgId = await currentOrgId(supabase);
  if (!orgId) return { error: "You must be signed in to upload." };

  const decoded = decodeDataUrl(dataUrl);
  if (!decoded) return { error: "Could not read that file." };

  const MAX_BYTES = 32 * 1024 * 1024; // matches next.config.ts's Server Action body limit headroom
  if (decoded.buffer.byteLength > MAX_BYTES) {
    return { error: "That file is larger than 32MB — please upload a smaller file." };
  }

  const ext = extFor(decoded.contentType, fileName);
  if (!["pdf", "xlsx", "xls", "csv"].includes(ext)) {
    return { error: "Please upload a PDF, Excel (.xlsx/.xls) or CSV file." };
  }

  const path = `${orgId}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const admin = createAdminClient();
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(path, decoded.buffer, { contentType: decoded.contentType, upsert: false });
  if (upErr) return { error: upErr.message };

  const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
  return {
    file: { path, name: fileName, url: signed?.signedUrl ?? null, contentType: decoded.contentType },
  };
}

/** Fresh signed URL for an already-uploaded quotation source file. */
export async function getQuotationFileUrlAction(path: string): Promise<{ url?: string; error?: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
  if (error) return { error: error.message };
  return { url: data?.signedUrl };
}

export interface QuotationSourceInfo {
  sourceFilePath: string | null;
  sourceFileName: string | null;
  fileUrl: string | null;
  lowConfidence: string[];
  /** "boq" when this quotation was built from a client-supplied Bill of Quantities. */
  docType: "quotation" | "boq";
}

const EMPTY_SOURCE: QuotationSourceInfo = {
  sourceFilePath: null,
  sourceFileName: null,
  fileUrl: null,
  lowConfidence: [],
  docType: "quotation",
};

/**
 * Source-file info for a saved quotation, with a fresh signed URL. Returns
 * the empty shape (rather than throwing) when 0023 hasn't been applied yet —
 * same 42703 tolerance as linkQuotationToProjectAction.
 */
export async function getQuotationSourceAction(id: string): Promise<QuotationSourceInfo> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select("source, source_file_path, source_file_name, extraction_review")
    .eq("id", id)
    .maybeSingle();
  if (error || !data?.source_file_path) return EMPTY_SOURCE;
  const admin = createAdminClient();
  const { data: signed } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(data.source_file_path as string, SIGNED_TTL);
  const review = data.extraction_review as { lowConfidence?: string[] } | null;
  return {
    sourceFilePath: data.source_file_path as string,
    sourceFileName: (data.source_file_name as string | null) ?? null,
    fileUrl: signed?.signedUrl ?? null,
    lowConfidence: review?.lowConfidence ?? [],
    docType: data.source === "boq" ? "boq" : "quotation",
  };
}

// ----------------------------------------------------------------------------
// Work Order (by Client) — pure record-keeping proof attached to a Quotation.
// Reuses the same quotation-files bucket and signed-URL pattern as the
// quotation's own source file (migration 0028). Does not drive any status
// change or automation — see docs/superpowers/specs/2026-10-03-
// document-workflow-design.md, section 2.
// ----------------------------------------------------------------------------

export interface QuotationWorkOrder {
  id: string;
  quotationId: string;
  filePath: string;
  fileName: string;
  fileUrl: string | null;
  referenceNumber: string | null;
  date: string | null;
  note: string | null;
  createdAt: string;
}

interface WorkOrderRow {
  id: string;
  quotation_id: string;
  file_path: string;
  file_name: string;
  reference_number: string | null;
  date: string | null;
  note: string | null;
  created_at: string;
}

async function signWorkOrder(admin: ReturnType<typeof createAdminClient>, r: WorkOrderRow): Promise<QuotationWorkOrder> {
  const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(r.file_path, SIGNED_TTL);
  return {
    id: r.id,
    quotationId: r.quotation_id,
    filePath: r.file_path,
    fileName: r.file_name,
    fileUrl: signed?.signedUrl ?? null,
    referenceNumber: r.reference_number,
    date: r.date,
    note: r.note,
    createdAt: r.created_at,
  };
}

/** All work orders attached to a quotation, newest first. Empty before 0028 or on any error. */
export async function getQuotationWorkOrdersAction(quotationId: string): Promise<QuotationWorkOrder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotation_work_orders")
    .select("id, quotation_id, file_path, file_name, reference_number, date, note, created_at")
    .eq("quotation_id", quotationId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  const admin = createAdminClient();
  return Promise.all((data as WorkOrderRow[]).map((r) => signWorkOrder(admin, r)));
}

/** Attach a client-supplied Work Order file to a quotation. */
export async function uploadClientWorkOrderAction(
  quotationId: string,
  fileName: string,
  dataUrl: string,
  referenceNumber: string,
  date: string,
  note: string
): Promise<{ workOrder?: QuotationWorkOrder; error?: string }> {
  const supabase = await createClient();
  const orgId = await currentOrgId(supabase);
  if (!orgId) return { error: "You must be signed in to attach a work order." };

  const decoded = decodeDataUrl(dataUrl);
  if (!decoded) return { error: "Could not read that file." };

  const MAX_BYTES = 32 * 1024 * 1024;
  if (decoded.buffer.byteLength > MAX_BYTES) {
    return { error: "That file is larger than 32MB — please upload a smaller file." };
  }

  const ext = extFor(decoded.contentType, fileName);
  const path = `${orgId}/wo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const admin = createAdminClient();
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(path, decoded.buffer, { contentType: decoded.contentType, upsert: false });
  if (upErr) return { error: upErr.message };

  const { data, error } = await supabase
    .from("quotation_work_orders")
    .insert({
      org_id: orgId,
      quotation_id: quotationId,
      file_path: path,
      file_name: fileName,
      reference_number: referenceNumber || null,
      date: date || null,
      note: note || null,
    })
    .select("id, quotation_id, file_path, file_name, reference_number, date, note, created_at")
    .single();
  if (error) return { error: error.message };
  return { workOrder: await signWorkOrder(admin, data as WorkOrderRow) };
}

/** Remove an attached Work Order. RLS decides who may. */
export async function deleteQuotationWorkOrderAction(id: string): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotation_work_orders")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "That work order no longer exists, or you can't remove it." };
  return { id };
}
