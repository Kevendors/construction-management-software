"use client";

import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EARLY_CHECKOUT_REASONS, MAX_EARLY_REASON } from "@/lib/attendance/compute";

export const EARLY_OTHER_REASON = "Other";

/** The reason to send for the early-check-out step ("" until one is chosen/typed). */
export function earlyReasonOf(choice: string, other: string): string {
  return choice === EARLY_OTHER_REASON ? other.trim() : choice;
}

/**
 * "Early check-out" step shared by the site (CheckInFlow, mode "out") and
 * office (OfficeCheckInFlow) check-out flows — mirrors CheckInFlow's
 * outside-site reason UI. Before 6:00 PM IST a reason is required and the day
 * becomes Half-Day (the server re-checks and applies it).
 */
export function EarlyCheckoutStep({
  choice,
  other,
  onChoice,
  onOther,
  onCancel,
  onContinue,
  continueLabel = "Continue",
}: {
  choice: string;
  other: string;
  onChoice: (v: string) => void;
  onOther: (v: string) => void;
  onCancel: () => void;
  onContinue: () => void;
  continueLabel?: string;
}) {
  const reason = earlyReasonOf(choice, other);
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-sm">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <p>
          <span className="font-semibold">Early check-out.</span> You&apos;re checking out before 6:00 PM. This day will
          be marked Half-Day. Please give a reason.
        </p>
      </div>
      <div className="grid gap-2">
        {[...EARLY_CHECKOUT_REASONS, EARLY_OTHER_REASON].map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => onChoice(r)}
            className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
              choice === r ? "border-primary bg-primary/5 font-medium" : "border-border hover:bg-secondary"
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      {choice === EARLY_OTHER_REASON && (
        <textarea
          value={other}
          onChange={(e) => onOther(e.target.value)}
          maxLength={MAX_EARLY_REASON}
          rows={2}
          placeholder="Type the reason"
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
        />
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-12" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="h-12" disabled={!reason} onClick={onContinue}>
          {continueLabel}
        </Button>
      </div>
    </div>
  );
}
