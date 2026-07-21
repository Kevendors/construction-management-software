"use server";

import { getAuthContext } from "@/lib/auth/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminRole } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { logActivity } from "@/lib/activity/log";

export interface ActionResult {
  id?: string;
  error?: string;
}

/**
 * Super-admin-only: set or clear a project's site geo-fence. Pass all three
 * values to enable the fence, or all nulls to disable it.
 */
export async function updateProjectGeofenceAction(
  projectId: string,
  lat: number | null,
  lng: number | null,
  radiusM: number | null
): Promise<ActionResult> {
  // Mock mode: the client store applies the change locally.
  if (!isSupabaseConfigured()) return { id: projectId };

  const ctx = await getAuthContext();
  if (!ctx || !isAdminRole(ctx.role)) return { error: "Not authorized." };
  if (!ctx.orgId) return { error: "No organization found." };

  const clearing = lat == null && lng == null && radiusM == null;
  if (!clearing) {
    if (
      lat == null || lng == null || radiusM == null ||
      !Number.isFinite(lat) || Math.abs(lat) > 90 ||
      !Number.isFinite(lng) || Math.abs(lng) > 180 ||
      !Number.isFinite(radiusM) || radiusM < 10 || radiusM > 100000
    ) {
      return { error: "Enter a valid latitude, longitude and radius (10–100,000 m)." };
    }
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("projects")
    .update({
      geofence_lat: lat,
      geofence_lng: lng,
      geofence_radius_m: radiusM == null ? null : Math.round(radiusM),
    })
    .eq("id", projectId)
    .eq("org_id", ctx.orgId);
  if (error) return { error: error.message };

  await logActivity({
    action: "updated",
    entityType: "project",
    entityId: projectId,
    summary: clearing ? "Cleared the site geo-fence" : `Set the site geo-fence (${radiusM}m radius)`,
  });
  return { id: projectId };
}
