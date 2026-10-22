"use client";

import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SimilarMasterMatch } from "@/lib/quotation/item-similarity";

/**
 * Shown under a custom item's description once it looks similar to something
 * already in the Master List. A suggestion only -- never auto-applied -- so a
 * genuinely different item (different size, different year, different trade)
 * that just shares wording is never silently merged into the wrong entry.
 */
export function SimilarItemSuggestion({
  match,
  onUseExisting,
  onDismiss,
}: {
  match: SimilarMasterMatch;
  onUseExisting: () => void;
  onDismiss: () => void;
}) {
  const preview = match.item.name.length > 90 ? `${match.item.name.slice(0, 90)}…` : match.item.name;
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs">
      <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
      <div className="min-w-0 flex-1">
        <p className="text-foreground">
          This looks similar to an existing Master List item: <span className="font-medium">{preview}</span>
        </p>
        <div className="mt-1 flex gap-2">
          <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={onUseExisting}>
            Use this item
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={onDismiss}>
            Keep as new
          </Button>
        </div>
      </div>
    </div>
  );
}
