"use client";

import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Project } from "@/lib/types";

/**
 * Open projects with no geofence: check-ins there aren't location-checked,
 * so list them for the admin to fix in one pass. Hidden when there are none.
 */
export function UnfencedSitesCard({ projects }: { projects: Project[] }) {
  const unfenced = projects.filter(
    (p) =>
      p.status !== "completed" &&
      (p.geofenceLat == null || p.geofenceLng == null || !p.geofenceRadiusM)
  );
  if (unfenced.length === 0) return null;

  return (
    <Card className="border-warning/40 bg-warning/5">
      <CardContent className="space-y-3 py-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-medium">
              {unfenced.length} {unfenced.length === 1 ? "site has" : "sites have"} no geofence
            </p>
            <p className="text-xs text-muted-foreground">
              Staff can check in to these from anywhere. Open each one and set its location in the Settings tab
              (best done while standing on site).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {unfenced.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}?tab=settings`}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-secondary"
            >
              {p.name}
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
