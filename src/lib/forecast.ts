import type {
  AnalysisReport,
  RubricScore,
  SubmissionForecast,
} from "@/types";

/** Per-venue baseline accept rate × shape of distribution. Heuristic but calibrated to public data. */
const VENUE_PROFILES: Record<
  string,
  { name: string; baseAccept: number; harshness: number }
> = {
  generic: { name: "Generic academic", baseAccept: 0.4, harshness: 1.0 },
  neurips: { name: "NeurIPS / ICML", baseAccept: 0.26, harshness: 1.45 },
  iclr: { name: "ICLR", baseAccept: 0.32, harshness: 1.3 },
  acl: { name: "ACL / EMNLP", baseAccept: 0.24, harshness: 1.5 },
  nature: { name: "Nature / Science", baseAccept: 0.08, harshness: 2.2 },
  jama: { name: "JAMA / NEJM", baseAccept: 0.05, harshness: 2.4 },
  cell: { name: "Cell", baseAccept: 0.1, harshness: 2.0 },
  thesis: { name: "PhD thesis chapter", baseAccept: 0.85, harshness: 0.6 },
};

/** Map a 0..1 rubric score into a logit space so harsh venues penalise low scores harder. */
function rubricToLogit(scores: RubricScore[], harshness: number): number {
  if (scores.length === 0) return 0;
  const mean =
    scores.reduce((acc, s) => acc + s.score, 0) / scores.length;
  // Stretch with a logit-like transform around 0.5, sharpened by harshness.
  const eps = 1e-3;
  const clamped = Math.max(eps, Math.min(1 - eps, mean));
  const logit = Math.log(clamped / (1 - clamped));
  // Penalise weakest dimension (reviewers fixate on the worst score).
  const min = Math.min(...scores.map((s) => s.score));
  const drag = (0.55 - min) * harshness * 1.4;
  return logit * harshness - drag;
}

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

export function computeForecast(
  venueId: string,
  report: AnalysisReport,
): SubmissionForecast {
  const profile = VENUE_PROFILES[venueId] ?? VENUE_PROFILES.generic;
  const logit = rubricToLogit(report.scores, profile.harshness);
  // Centre around the venue base rate.
  const baseLogit = Math.log(profile.baseAccept / (1 - profile.baseAccept));
  const adjusted = baseLogit + logit;
  const p = Math.max(0.005, Math.min(0.995, sigmoid(adjusted)));
  // Rough "top X% of venue" estimate.
  const topPercentile = Math.round(
    Math.max(1, Math.min(99, (1 - p) * 100)),
  );

  // Drivers: which dimensions are pulling the forecast up/down most.
  const meanScore =
    report.scores.length === 0
      ? 0
      : report.scores.reduce((a, s) => a + s.score, 0) /
        report.scores.length;
  const drivers = report.scores
    .map((s) => ({
      dimension: s.name,
      delta: (s.score - meanScore) * 100,
      note: s.note,
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 4);

  return {
    venue: venueId,
    venueName: profile.name,
    acceptProbability: p,
    band: bandFor(p),
    topPercentile,
    drivers,
    caveat:
      "Heuristic forecast based on the analyzer's current rubric grade and the venue's published acceptance rate. Replaced by the Atlas Reviewer Model fine-tune at v0.5.",
    generatedAt: Date.now(),
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
