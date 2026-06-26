"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "dpr-photos";
const SIGNED_TTL = 60 * 60 * 24 * 7; // 1 week

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

function decodeDataUrl(dataUrl: string): { buffer: Buffer; contentType: string; ext: string } | null {
  const m = /^data:(.+?);base64,([\s\S]*)$/.exec(dataUrl);
  if (!m) return null;
  const contentType = m[1];
  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  return { buffer: Buffer.from(m[2], "base64"), contentType, ext };
}

/**
 * Upload a DPR's photos (resized JPEG data URLs) to the private dpr-photos
 * bucket under `${orgId}/${dprId}/${i}.jpg` and return short-lived signed URLs.
 * Photos are keyed by DPR id, so no schema column is needed — the dpr row's
 * `photos` count tells us how many to read back later.
 */
export async function uploadDprPhotos(
  dprId: string,
  dataUrls: string[]
): Promise<string[]> {
  const supabase = await createClient();
  const orgId = await currentOrgId(supabase);
  if (!orgId) return [];

  // Confirm the DPR belongs to the caller's org (RLS-scoped read).
  const { data: dpr } = await supabase.from("dprs").select("id").eq("id", dprId).maybeSingle();
  if (!dpr) return [];

  const admin = createAdminClient();
  const paths: string[] = [];
  for (let i = 0; i < dataUrls.length; i++) {
    const decoded = decodeDataUrl(dataUrls[i]);
    if (!decoded) continue;
    const path = `${orgId}/${dprId}/${i}.${decoded.ext}`;
    const { error } = await admin.storage
      .from(BUCKET)
      .upload(path, decoded.buffer, { contentType: decoded.contentType, upsert: true });
    if (error) {
      console.error("[dpr-actions] upload failed", path, error.message);
      continue;
    }
    paths.push(path);
  }
  if (!paths.length) return [];

  const { data: signed } = await admin.storage.from(BUCKET).createSignedUrls(paths, SIGNED_TTL);
  return (signed ?? [])
    .map((s) => s.signedUrl)
    .filter((u): u is string => Boolean(u));
}

/**
 * Mint signed URLs for the photos of many DPRs at once (used on load). Paths
 * are derived from each DPR's stored photo count.
 */
export async function getDprPhotoUrls(
  dprs: { id: string; photos: number }[]
): Promise<Record<string, string[]>> {
  const supabase = await createClient();
  const orgId = await currentOrgId(supabase);
  if (!orgId) return {};

  const withPhotos = dprs.filter((d) => d.photos > 0);
  if (!withPhotos.length) return {};

  // jpg is the standard output of our resizer; the path index maps 1:1 to count.
  const flat: { id: string; path: string }[] = [];
  for (const d of withPhotos) {
    for (let i = 0; i < d.photos; i++) flat.push({ id: d.id, path: `${orgId}/${d.id}/${i}.jpg` });
  }

  const admin = createAdminClient();
  const { data: signed } = await admin.storage
    .from(BUCKET)
    .createSignedUrls(
      flat.map((f) => f.path),
      SIGNED_TTL
    );

  const out: Record<string, string[]> = {};
  (signed ?? []).forEach((s, idx) => {
    if (!s.signedUrl || s.error) return;
    const id = flat[idx].id;
    (out[id] ??= []).push(s.signedUrl);
  });
  return out;
}
