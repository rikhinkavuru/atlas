import type { VenueId } from "./rubrics";

// Word-count budgets for the venues Atlas knows about. Numbers are approximate
// — most venues quote a page limit (e.g. NeurIPS main = 9 pages excluding refs)
// which translates to a rough word ceiling at typical 600 wpm density. We pick
// the lower end so the progress bar trips amber before reviewers do.
//
// `null` means "no limit" — the StatusBar omits the progress chip in that case.
export const VENUE_WORD_LIMITS: Record<VenueId, number | null> = {
  generic: null,
  neurips: 5400, // 9 pages main text
  iclr: 5400, // 9 pages main text (same envelope as NeurIPS)
  acl: 4800, // 8 pages main text
  nature: 4000, // Nature Article body
  jama: 3500, // JAMA Original Investigation
  cell: 8000, // Cell Article body
  thesis: null,
};

export interface VenueBudget {
  limit: number;
  used: number;
  remaining: number;
  /** 0–1, clamped */
  ratio: number;
  /** "ok" < 75%, "near" 75–95%, "tight" 95–100%, "over" >100% */
  state: "ok" | "near" | "tight" | "over";
}

export function venueBudget(venue: VenueId, words: number): VenueBudget | null {
  const limit = VENUE_WORD_LIMITS[venue];
  if (!limit) return null;
  const ratio = words / limit;
  const remaining = limit - words;
  const state: VenueBudget["state"] =
    ratio > 1 ? "over" : ratio >= 0.95 ? "tight" : ratio >= 0.75 ? "near" : "ok";
  return { limit, used: words, remaining, ratio: Math.min(1, ratio), state };
}
