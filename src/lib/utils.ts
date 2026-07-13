import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Up-to-two-letter initials from a display name (fallback for empty avatars). */
export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const letters = (parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "");
  return letters.toUpperCase() || "?";
}

/** Format a number as INR currency. */
export function formatINR(value: number, opts: { compact?: boolean } = {}) {
  if (opts.compact) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Plain number with Indian grouping. */
export function formatNumber(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits }).format(value);
}

export function formatPercent(value: number, digits = 1) {
  return `${value.toFixed(digits)}%`;
}

/** Today's date as a local `YYYY-MM-DD` string — use as the `max` on date
 *  inputs that record something that already happened (no future dates). */
export function todayISO() {
  return new Date().toLocaleDateString("en-CA");
}
