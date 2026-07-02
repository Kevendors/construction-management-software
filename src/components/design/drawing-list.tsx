"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, FileBox, History } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getUser } from "@/lib/mock/selectors";
import { drawingStatusMeta } from "@/lib/labels";
import type { Drawing } from "@/lib/types";

const disciplineLabel: Record<Drawing["discipline"], string> = {
  architectural: "Architectural",
  structural: "Structural",
  mep: "MEP",
  interior: "Interior",
};

function DrawingCard({ drawing }: { drawing: Drawing }) {
  const [open, setOpen] = useState(false);
  const meta = drawingStatusMeta[drawing.status];
  return (
    <Card>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
          <FileBox className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{drawing.title}</p>
          <p className="text-xs text-muted-foreground">
            {disciplineLabel[drawing.discipline]} · Rev {drawing.currentRev} ·{" "}
            {drawing.versions.length} version{drawing.versions.length === 1 ? "" : "s"}
          </p>
        </div>
        <Badge variant={meta.variant}>{meta.label}</Badge>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <CardContent className="border-t border-border pt-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <History className="h-3.5 w-3.5" /> Revision History
          </p>
          <ol className="space-y-3">
            {[...drawing.versions].reverse().map((v) => {
              const by = getUser(v.byId);
              return (
                <li key={v.rev} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                    {v.rev}
                  </span>
                  <div className="flex-1 border-b border-border pb-3 last:border-0">
                    <p className="text-sm">{v.notes}</p>
                    <p className="text-xs text-muted-foreground">
                      {by?.name} ·{" "}
                      {new Date(v.date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}{" "}
                      · {(v.fileKb / 1024).toFixed(1)} MB
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </CardContent>
      )}
    </Card>
  );
}

export function DrawingList({ drawings }: { drawings: Drawing[] }) {
  if (drawings.length === 0)
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No drawings uploaded yet.
        </CardContent>
      </Card>
    );
  return (
    <div className="space-y-3">
      {drawings.map((d) => (
        <DrawingCard key={d.id} drawing={d} />
      ))}
    </div>
  );
}
