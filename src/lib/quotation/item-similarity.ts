import type { MasterItem } from "./item-master";

// Local, deterministic text matching -- no AI API of any kind, matching this
// project's standing decision against paid AI services. Good enough to catch
// "same item, retyped slightly differently" (the common case); it has no real
// understanding of meaning, so genuinely different items that happen to share
// wording (different sizes, different years, different trades) will often
// still score high -- this is why callers always ask the person before
// reusing a match, never merge automatically.

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenSet(s: string): Set<string> {
  return new Set(normalizeText(s).split(" ").filter((w) => w.length > 2));
}

/** Dice coefficient over normalized word tokens: 2*|A∩B| / (|A|+|B|), 0..1. */
export function textSimilarity(a: string, b: string): number {
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return (2 * inter) / (ta.size + tb.size);
}

/** Below this, two descriptions are treated as unrelated (tuned against this org's real quotation/invoice data). */
export const SIMILARITY_SUGGEST_THRESHOLD = 0.55;

export interface SimilarMasterMatch {
  item: MasterItem;
  score: number;
}

/** Best existing master-list match for freshly typed text, if close enough to be worth suggesting. */
export function findSimilarMasterItem(text: string, master: MasterItem[]): SimilarMasterMatch | null {
  const trimmed = text.trim();
  if (trimmed.length < 8) return null; // too short for word-overlap to mean anything
  let best: SimilarMasterMatch | null = null;
  for (const item of master) {
    const score = textSimilarity(trimmed, item.name);
    if (score >= SIMILARITY_SUGGEST_THRESHOLD && (!best || score > best.score)) {
      best = { item, score };
    }
  }
  return best;
}
