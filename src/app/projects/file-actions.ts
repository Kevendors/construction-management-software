"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/auth/context";

const BUCKET = "project-files";
const SIGNED_TTL = 60 * 60 * 24 * 7; // 1 week

type FileKind = "photo" | "pdf" | "dwg" | "doc";

export interface ProjectFileView {
  id: string;
  name: string;
  kind: FileKind;
  sizeKb: number;
  uploadedAt: string;
  uploadedByName: string | null;
  url: string | null;
}

async function currentContext(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { orgId: null, userId: null };
  const { data } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  return { orgId: (data?.org_id as string | undefined) ?? null, userId: user.id };
}

function decodeDataUrl(dataUrl: string): { buffer: Buffer; contentType: string; ext: string } | null {
  const m = /^data:(.+?);base64,([\s\S]*)$/.exec(dataUrl);
  if (!m) return null;
  const contentType = m[1];
  const ext = extFor(contentType, "");
  return { buffer: Buffer.from(m[2], "base64"), contentType, ext };
}

function extFor(contentType: string, fallback: string): string {
  if (contentType === "application/pdf") return "pdf";
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType.startsWith("image/")) return "jpg";
  return fallback || "bin";
}

function kindFor(name: string, contentType: string): FileKind {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (contentType.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return "photo";
  if (contentType === "application/pdf" || ext === "pdf") return "pdf";
  if (["dwg", "dxf"].includes(ext)) return "dwg";
  return "doc";
}

/** Upload a file (as a data URL) and record it against the project. */
export async function uploadProjectFileAction(
  projectId: string,
  fileName: string,
  dataUrl: string
): Promise<{ file?: ProjectFileView; error?: string }> {
  const supabase = await createClient();
  const { orgId, userId } = await currentContext(supabase);
  if (!orgId) return { error: "You must be signed in." };
  if (!projectId) return { error: "Project is required." };

  const decoded = decodeDataUrl(dataUrl);
  if (!decoded) return { error: "Could not read that file." };

  const sizeKb = Math.max(1, Math.round(decoded.buffer.byteLength / 1024));
  const kind = kindFor(fileName, decoded.contentType);

  const { data: row, error: insErr } = await supabase
    .from("project_files")
    .insert({
      org_id: orgId,
      project_id: projectId,
      name: fileName,
      kind,
      size_kb: sizeKb,
      uploaded_by_id: userId,
    })
    .select("id, name, kind, size_kb, uploaded_at")
    .single();
  if (insErr) return { error: insErr.message };

  const fileId = row.id as string;
  const path = `${orgId}/${projectId}/${fileId}.${decoded.ext}`;
  const admin = createAdminClient();
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(path, decoded.buffer, { contentType: decoded.contentType, upsert: true });
  if (upErr) {
    await supabase.from("project_files").delete().eq("id", fileId);
    return { error: upErr.message };
  }
  await supabase.from("project_files").update({ storage_path: path }).eq("id", fileId);

  const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
  return {
    file: {
      id: fileId,
      name: row.name as string,
      kind: row.kind as FileKind,
      sizeKb: row.size_kb as number,
      uploadedAt: row.uploaded_at as string,
      uploadedByName: null,
      url: signed?.signedUrl ?? null,
    },
  };
}

/** List a project's uploaded files with fresh signed URLs. */
export async function listProjectFilesAction(projectId: string): Promise<ProjectFileView[]> {
  const supabase = await createClient();
  const { orgId } = await currentContext(supabase);
  if (!orgId) return [];

  const { data, error } = await supabase
    .from("project_files")
    .select("id, name, kind, size_kb, uploaded_at, storage_path, profiles:uploaded_by_id(name)")
    .eq("project_id", projectId)
    .order("uploaded_at", { ascending: false });
  if (error || !data) return [];

  const admin = createAdminClient();
  const paths = data.map((r) => r.storage_path).filter((p): p is string => Boolean(p));
  const signedByPath = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrls(paths, SIGNED_TTL);
    (signed ?? []).forEach((s, i) => {
      if (s.signedUrl && !s.error) signedByPath.set(paths[i], s.signedUrl);
    });
  }

  return data.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    kind: r.kind as FileKind,
    sizeKb: r.size_kb as number,
    uploadedAt: r.uploaded_at as string,
    uploadedByName:
      (Array.isArray(r.profiles) ? r.profiles[0]?.name : (r.profiles as { name?: string } | null)?.name) ?? null,
    url: r.storage_path ? signedByPath.get(r.storage_path) ?? null : null,
  }));
}

/** Delete a project file (row + object). */
export async function deleteProjectFileAction(id: string): Promise<{ ok?: boolean; error?: string }> {
  const ctx = await getAuthContext();
  if (!ctx || (ctx.role !== "super_admin" && ctx.role !== "pm"))
    return { error: "Only a Super Admin or Project Manager can delete files." };

  const supabase = await createClient();
  const { orgId } = await currentContext(supabase);
  if (!orgId) return { error: "You must be signed in." };

  const { data: row } = await supabase
    .from("project_files")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("project_files").delete().eq("id", id);
  if (error) return { error: error.message };

  if (row?.storage_path) {
    const admin = createAdminClient();
    await admin.storage.from(BUCKET).remove([row.storage_path as string]);
  }
  return { ok: true };
}
