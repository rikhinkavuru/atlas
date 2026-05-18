import type {
  AnalysisReport,
  RubricScore,
  SubmissionForecast,
} from "@/types";
import { rubricForVenue, type VenueId } from "./rubrics";

/**
 * Per-venue baseline: published accept rate × distribution shape × harshness on
 * the worst-dimension. Numbers are calibrated against:
 *   - NeurIPS 2023: 26% accept (4,019 accepted of ~12,500 submitted)
 *   - ICLR 2024: 31% accept (notable + spotlight + poster)
 *   - ACL 2023 (long papers): 24% accept
 *   - Nature: 8% (papers reaching review; published-given-reviewed)
 *   - JAMA: 5%
 *   - Cell: 10%
 *   - Generic: 40% (mid-tier journal heuristic)
 *
 * `harshness` controls how much the weakest rubric dimension drags the
 * forecast — reviewers anchor on the worst score, top venues anchor harder.
 * `floorScore` is the score the WORST dimension must clear before the venue
 * meaningfully considers the paper (below this the forecast collapses).
 */
const VENUE_PROFILES: Record<
  string,
  {
    name: string;
    baseAccept: number;
    harshness: number;
    floorScore: number;
  }
> = {
  generic: { name: "Generic academic", baseAccept: 0.4, harshness: 1.0, floorScore: 0.35 },
  neurips: { name: "NeurIPS / ICML", baseAccept: 0.26, harshness: 1.45, floorScore: 0.55 },
  iclr: { name: "ICLR", baseAccept: 0.32, harshness: 1.3, floorScore: 0.5 },
  acl: { name: "ACL / EMNLP", baseAccept: 0.24, harshness: 1.5, floorScore: 0.55 },
  nature: { name: "Nature / Science", baseAccept: 0.08, harshness: 2.2, floorScore: 0.65 },
  jama: { name: "JAMA / NEJM", baseAccept: 0.05, harshness: 2.4, floorScore: 0.7 },
  cell: { name: "Cell", baseAccept: 0.1, harshness: 2.0, floorScore: 0.6 },
  thesis: { name: "PhD thesis chapter", baseAccept: 0.85, harshness: 0.6, floorScore: 0.3 },
};

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function bandFor(p: number): SubmissionForecast["band"] {
  if (p < 0.1) return "desk-reject";
  if (p < 0.25) return "weak";
  if (p < 0.5) return "borderline";
  if (p < 0.75) return "competitive";
  return "strong";
}

/**
 * Weighted mean of rubric scores using the venue's own dimension weights when
 * we can match score names to rubric dimensions (case-insensitive prefix). Any
 * unmatched score falls back to weight=1.
 */
function weightedMean(
  scores: RubricScore[],
  venueId: string,
): { mean: number; min: number; weakest: RubricScore | null } {
  if (scores.length === 0) return { mean: 0, min: 0, weakest: null };
  const rubric = rubricForVenue(venueId as VenueId);
  const weightFor = (name: string): number => {
    const norm = name.toLowerCase();
    const match = rubric.dimensions.find(
      (d) =>
        d.name.toLowerCase() === norm ||
        d.name.toLowerCase().startsWith(norm) ||
        norm.startsWith(d.name.toLowerCase()),
    );
    return match?.weight ?? 1;
  };
  let num = 0;
  let den = 0;
  let weakest: RubricScore | null = null;
  let min = 1;
  for (const s of scores) {
    const w = weightFor(s.name);
    num += s.score * w;
    den += w;
    if (s.score < min) {
      min = s.score;
      weakest = s;
    }
  }
  return { mean: num / Math.max(1e-6, den), min, weakest };
}

/**
 * Convert rubric grade → logit space contribution. The weakest dimension drags
 * extra when it falls below the venue's floor, which mirrors how a single bad
 * score (e.g. Soundness 0.4 at NeurIPS) tanks a paper regardless of the rest.
 */
function rubricToLogit(
  scores: RubricScore[],
  venueId: string,
  harshness: number,
  floor: number,
): { logit: number; floorPenalty: number } {
  if (scores.length === 0) return { logit: 0, floorPenalty: 0 };
  const { mean, min } = weightedMean(scores, venueId);
  const eps = 1e-3;
  const clamped = Math.max(eps, Math.min(1 - eps, mean));
  const logit = Math.log(clamped / (1 - clamped));

  // Worst-dimension drag — only applies when the floor is breached, scaling
  // with how far below it the dimension sits. Caps so a single 0 doesn't
  // explode the forecast.
  const breach = Math.max(0, floor - min);
  const floorPenalty = Math.min(2.5, breach * harshness * 2.6);
  return { logit: logit * harshness, floorPenalty };
}

/**
 * Paper-structure signals: limitations, ablations, citation density, etc.
 * Each contributes a small ± logit-space nudge. None of these are scores in
 * the rubric — they're the cheap derived signals reviewers visibly weigh.
 */
function paperStructureBoost(report: AnalysisReport): {
  delta: number;
  positives: string[];
  negatives: string[];
} {
  const positives: string[] = [];
  const negatives: string[] = [];
  let delta = 0;

  // Pull all issue messages joined as a haystack for cheap structure probes.
  const haystack = report.issues
    .map((i) => `${i.message} ${i.quote ?? ""}`)
    .join(" \n ")
    .toLowerCase();

  // Negative signals (issues flagged the absence of important sections).
  const flags: Array<[RegExp, number, string]> = [
    [/no abstract|missing abstract/, -0.35, "Missing abstract"],
    [/no limitations|no explicit limitations/, -0.25, "No limitations section"],
    [/no citations|no references|no citation/, -0.45, "Low citation density"],
    [/no ablation|missing ablation/, -0.2, "No ablation reported"],
    [/no error bar|confidence interval|no significance/, -0.18, "No uncertainty quantification"],
    [/no related work|missing related/, -0.15, "Weak related-work engagement"],
    [/hallucinat|fabricat/, -0.3, "Unverified claims flagged"],
  ];
  for (const [re, w, label] of flags) {
    if (re.test(haystack)) {
      delta += w;
      negatives.push(label);
    }
  }

  // Positive signals (errors/warnings absent + issue counts below threshold).
  const errorCount = report.issues.filter((i) => i.severity === "error").length;
  const warningCount = report.issues.filter((i) => i.severity === "warning").length;
  if (errorCount === 0 && warningCount <= 2) {
    delta += 0.18;
    positives.push("Clean — few warnings, no errors");
  }
  if (report.scores.length >= 5 && report.scores.every((s) => s.score >= 0.6)) {
    delta += 0.2;
    positives.push("All rubric dimensions ≥ 0.6");
  }

  // Cap the structure delta so it can't swing the forecast more than a
  // dimension worth of evidence.
  delta = Math.max(-0.9, Math.min(0.5, delta));
  return { delta, positives, negatives };
}

export interface ForecastExplain {
  rubricLogit: number;
  floorPenalty: number;
  structureDelta: number;
  baseLogit: number;
  positives: string[];
  negatives: string[];
  weakestDimension: string | null;
}

export function computeForecast(
  venueId: string,
  report: AnalysisReport,
): SubmissionForecast & { explain: ForecastExplain } {
  const profile = VENUE_PROFILES[venueId] ?? VENUE_PROFILES.generic;
  const { logit, floorPenalty } = rubricToLogit(
    report.scores,
    venueId,
    profile.harshness,
    profile.floorScore,
  );
  const { delta: structureDelta, positives, negatives } =
    paperStructureBoost(report);
  const baseLogit = Math.log(profile.baseAccept / (1 - profile.baseAccept));

  const adjusted = baseLogit + logit + structureDelta - floorPenalty;
  const p = Math.max(0.005, Math.min(0.995, sigmoid(adjusted)));
  const topPercentile = Math.round(Math.max(1, Math.min(99, (1 - p) * 100)));

  // Drivers (rubric-side): which dimensions move us most relative to the mean.
  const meanScore =
    report.scores.length === 0
      ? 0
      : report.scores.reduce((a, s) => a + s.score, 0) / report.scores.length;
  const drivers = report.scores
    .map((s) => ({
      dimension: s.name,
      delta: (s.score - meanScore) * 100,
      note: s.note,
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 4);

  const { weakest } = weightedMean(report.scores, venueId);

  return {
    venue: venueId,
    venueName: profile.name,
    acceptProbability: p,
    band: bandFor(p),
    topPercentile,
    drivers,
    caveat:
      "Heuristic forecast — weight-aware rubric grade × venue accept rate × paper-structure signals. Replaced by the Atlas Reviewer Model at v0.5.",
    generatedAt: Date.now(),
    explain: {
      rubricLogit: logit,
      floorPenalty,
      structureDelta,
      baseLogit,
      positives,
      negatives,
      weakestDimension: weakest?.name ?? null,
    },
  };
}

export function venueBaseRate(venueId: string): number {
  return (VENUE_PROFILES[venueId] ?? VENUE_PROFILES.generic).baseAccept;
}

/** Forecast across every known venue, ranked by accept probability. */
export function computeMultiVenueForecast(report: AnalysisReport): {
  forecasts: SubmissionForecast[];
  best: SubmissionForecast | null;
  worst: SubmissionForecast | null;
} {
  const ids = Object.keys(VENUE_PROFILES);
  const forecasts = ids
    .map((id) => computeForecast(id, report))
    .sort((a, b) => b.acceptProbability - a.acceptProbability);
  return {
    forecasts,
    best: forecasts[0] ?? null,
    worst: forecasts[forecasts.length - 1] ?? null,
  };
}

export function listVenues(): string[] {
  return Object.keys(VENUE_PROFILES);
}
