import type { AnalysisReport, AnalysisIssue, RubricScore } from "@/types";
import { rubricForVenue, type VenueId } from "./rubrics";

/**
 * Reviewer-2 simulator — predicts the questions a strict, venue-savvy
 * reviewer is most likely to raise on this paper. We derive these from
 * (weakest-rubric-dimension, structural absences, explicit issue list)
 * rather than asking an LLM, so the panel is instant and works offline.
 *
 * An LLM-backed `/api/reviewer-2` route refines the heuristic when a key
 * is set, but the user always sees a useful baseline.
 */

export interface Reviewer2Question {
  id: string;
  /** Short, reviewer-tone question text. */
  question: string;
  /** Which rubric/structural concern this question maps to. */
  concern: string;
  /** Severity proxy — drives the order and dot color. */
  severity: "watch" | "concern" | "blocker";
  /** Pre-drafted starting point for a rebuttal paragraph. */
  rebuttalDraft: string;
  /** Verbatim quote from the analysis (if any) that triggered the question. */
  evidence?: string;
}

const SEVERITY_RANK: Record<Reviewer2Question["severity"], number> = {
  blocker: 3,
  concern: 2,
  watch: 1,
};

interface DerivationContext {
  venue: VenueId;
  report: AnalysisReport;
  weakest: RubricScore | null;
}

/**
 * Build the heuristic list. Always returns at least 3 entries even on a clean
 * paper — Reviewer 2 always finds something — but those entries shift toward
 * "watch" severity (curious questions, not blockers).
 */
export function deriveReviewer2Questions(
  venue: VenueId,
  report: AnalysisReport,
): Reviewer2Question[] {
  const weakest = pickWeakest(report.scores);
  const ctx: DerivationContext = { venue, report, weakest };
  const out: Reviewer2Question[] = [];

  // 1) Weakest-dimension question — Reviewer 2 always anchors on the floor.
  if (weakest) {
    out.push(weakestDimensionQuestion(ctx));
  }

  // 2) Structural absences — pull from the issue list with regex probes.
  const haystack = report.issues
    .map((i) => `${i.message} ${i.quote ?? ""}`)
    .join("\n")
    .toLowerCase();

  if (/no limitations|missing limitations/.test(haystack)) {
    out.push({
      id: "q_limitations",
      question:
        "What are the threats to validity of this work? I don't see a limitations section.",
      concern: "Missing limitations",
      severity: "concern",
      rebuttalDraft:
        "We thank the reviewer for raising this. We have now added a Limitations subsection (§X) that names the principal threats to validity, including [scope of dataset], [confounders], and [assumptions about the deployment setting]. We argue these do not invalidate the central claim because…",
    });
  }
  if (/no ablation|missing ablation/.test(haystack)) {
    out.push({
      id: "q_ablation",
      question:
        "Without an ablation, I can't tell which component drives the gain. Can you isolate the contribution?",
      concern: "Missing ablation",
      severity: "blocker",
      rebuttalDraft:
        "We agree this isolation is important. In the revision (Table X) we ran ablations removing [component A], [component B], and [component C] individually. The results show that [A] accounts for X.X of the X.X-point improvement; the other two contribute marginally but compound when combined.",
    });
  }
  if (/no error bar|no significance|confidence interval|p[\s-]?value/i.test(haystack)) {
    out.push({
      id: "q_uncertainty",
      question:
        "I don't see confidence intervals or significance tests on the headline result. Is this difference within noise?",
      concern: "No uncertainty quantification",
      severity: "blocker",
      rebuttalDraft:
        "We re-ran the headline experiment with 5 seeds and report mean ± std in the camera-ready Table X. The improvement is XX.X ± Y.Y vs the baseline at XX.X ± Y.Y; a paired t-test gives p < 0.0X.",
    });
  }
  if (/no citation|low citation density|missing citation/.test(haystack)) {
    out.push({
      id: "q_citations",
      question:
        "Several non-trivial claims are made without citation. Can the authors ground them in prior work?",
      concern: "Under-cited claims",
      severity: "concern",
      rebuttalDraft:
        "We agree and have added supporting citations to [claim 1], [claim 2], and [claim 3], drawing on [Author Year], [Author Year], and [Author Year] respectively.",
    });
  }
  if (/no related work|missing related/.test(haystack)) {
    out.push({
      id: "q_relatedwork",
      question:
        "How does this work differ from [closest prior]? The related-work paragraph reads like a list rather than a positioning statement.",
      concern: "Weak related-work positioning",
      severity: "concern",
      rebuttalDraft:
        "We have restructured the related-work section around three axes — [axis A], [axis B], [axis C] — and explicitly contrast our contribution with [closest prior 1] (which differs in [X]) and [closest prior 2] (which differs in [Y]).",
    });
  }
  if (/hallucinat|fabricat|unsupported claim/.test(haystack)) {
    out.push({
      id: "q_unsupported",
      question:
        "I flagged passages that read like claims the authors haven't sourced. Can you justify these or remove them?",
      concern: "Unsupported claims",
      severity: "blocker",
      rebuttalDraft:
        "We removed unsupported claims X and Y, and re-grounded claim Z with [Author Year]. The provenance ledger attached to this submission documents every revision touching these passages.",
    });
  }

  // 3) Venue-specific concerns — small per-venue overlay on top of the
  // structural questions. The list is intentionally short; if the model
  // wants more, the LLM endpoint adds them later.
  const venueExtras = venueSpecificQuestions(ctx);
  out.push(...venueExtras);

  // 4) Dedup, rank, and cap at 5. Always return at least 3 — Reviewer 2
  // always finds something to say.
  const deduped: Reviewer2Question[] = [];
  const seenConcerns = new Set<string>();
  for (const q of out) {
    if (seenConcerns.has(q.concern)) continue;
    seenConcerns.add(q.concern);
    deduped.push(q);
  }
  deduped.sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity],
  );

  if (deduped.length < 3) {
    deduped.push(...fillerQuestions(ctx).slice(0, 3 - deduped.length));
  }
  return deduped.slice(0, 5);
}

function pickWeakest(scores: RubricScore[]): RubricScore | null {
  if (scores.length === 0) return null;
  return scores.reduce(
    (acc, s) => (s.score < acc.score ? s : acc),
    scores[0],
  );
}

function weakestDimensionQuestion(ctx: DerivationContext): Reviewer2Question {
  const w = ctx.weakest!;
  const issue = ctx.report.issues.find(
    (i: AnalysisIssue) => i.category.toLowerCase() === w.name.toLowerCase(),
  );
  const severity: Reviewer2Question["severity"] =
    w.score < 0.45 ? "blocker" : w.score < 0.65 ? "concern" : "watch";
  return {
    id: `q_weakest_${slug(w.name)}`,
    question:
      w.score < 0.5
        ? `The ${w.name.toLowerCase()} dimension is the weakest aspect of this paper. What concrete evidence supports the claims here?`
        : `${w.name} is the lowest-graded dimension in my read. Can you point me to the strongest single piece of evidence for it?`,
    concern: `Weak on ${w.name}`,
    severity,
    rebuttalDraft:
      issue?.suggestion
        ? `We have addressed this directly in the revision. ${issue.suggestion} See §X for the updated treatment.`
        : `We thank the reviewer for highlighting this. In the revision we strengthened the ${w.name.toLowerCase()} treatment by [concrete change 1] and [concrete change 2]. Specifically, [evidence].`,
    evidence: issue?.quote,
  };
}

function venueSpecificQuestions(
  ctx: DerivationContext,
): Reviewer2Question[] {
  const out: Reviewer2Question[] = [];
  switch (ctx.venue) {
    case "neurips":
    case "iclr":
      out.push({
        id: "q_reproducibility",
        question:
          "What's the compute budget, what's the random-seed protocol, and where will the code live? Reproducibility checklist matters here.",
        concern: "Reproducibility checklist",
        severity: "concern",
        rebuttalDraft:
          "We will release code at [URL] under [license] before the camera-ready deadline. The reported numbers use 5 seeds (seeds 0–4) on [hardware], with hyperparameters as described in §X.",
      });
      break;
    case "acl":
      out.push({
        id: "q_multilingual",
        question:
          "All experiments are on English. Does the approach generalise to other language families?",
        concern: "Single-language evaluation",
        severity: "watch",
        rebuttalDraft:
          "We agree. In the revision we add a brief multilingual evaluation on [language A] and [language B] (Table X), where we observe [result]. We discuss the limits of generalisation in the new Limitations section.",
      });
      break;
    case "nature":
      out.push({
        id: "q_nonspecialist",
        question:
          "The paper is written for the in-group. A non-specialist Nature reader needs the first paragraph to explain why this matters outside the subfield.",
        concern: "Importance framing for general audience",
        severity: "concern",
        rebuttalDraft:
          "We re-wrote the opening paragraph to lead with the broader significance: [one-sentence stakes a non-specialist reader can act on], then [why this paper closes that gap].",
      });
      break;
    case "jama":
      out.push({
        id: "q_picot",
        question:
          "I can't extract a clean PICOT statement from the abstract. What is the population, intervention, comparator, outcome, and time frame?",
        concern: "PICOT clarity",
        severity: "blocker",
        rebuttalDraft:
          "We added an explicit PICOT statement to the abstract: Population [P], Intervention [I], Comparator [C], Outcome [O], Time frame [T].",
      });
      break;
    case "cell":
      out.push({
        id: "q_mechanism",
        question:
          "The phenotype is convincing, but I don't see a clean mechanism. Loss-of-function and gain-of-function experiments would close this.",
        concern: "Mechanism not isolated",
        severity: "concern",
        rebuttalDraft:
          "We added LOF (via [knockout/knockdown]) and GOF (via [overexpression]) experiments in Figure X, which together implicate [mechanism] as causal rather than correlative.",
      });
      break;
    default:
      break;
  }
  return out;
}

function fillerQuestions(ctx: DerivationContext): Reviewer2Question[] {
  const rubric = rubricForVenue(ctx.venue);
  // Generic curious-reviewer questions keyed to whichever rubric dimension we
  // haven't already asked about. Watch-severity so they don't dominate.
  return rubric.dimensions.slice(0, 2).map((d, i) => ({
    id: `q_filler_${i}`,
    question: `Can you say more about ${d.name.toLowerCase()}? The current treatment is competent but light on detail.`,
    concern: `Curious about ${d.name}`,
    severity: "watch" as const,
    rebuttalDraft: `In the revision we expanded ${d.name.toLowerCase()} with [detail 1], [detail 2], and a forward pointer to §X.`,
  }));
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export interface Reviewer2Bundle {
  /** Always present — heuristic baseline. */
  baseline: Reviewer2Question[];
  /** Refined by LLM when API call succeeded. */
  refined?: Reviewer2Question[];
  /** Provider used for the refinement, if any. */
  refinedBy?: string;
  generatedAt: number;
}
