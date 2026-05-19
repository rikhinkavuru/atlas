import { NextRequest } from "next/server";
import { computeForecast } from "@/lib/forecast";
import { rubricForVenue, type VenueId } from "@/lib/rubrics";
import type { AnalysisReport, AnalysisIssue, RubricScore } from "@/types";
import type { EvalCase, EvalResult } from "@/lib/training-export";

export const runtime = "nodejs";

/**
 * Eval harness for the Reviewer Model.
 *
 * Today this runs the heuristic + reviewer-2 simulator against a held-out
 * batch of (paper-abstract, venue, actual-decision) cases. When the trained
 * model ships, the implementation here swaps to call the model; the response
 * shape stays stable so eval dashboards keep working.
 *
 * Body: { cases: EvalCase[] }
 * Response: { results: EvalResult[], agreementRate: number, schemaVersion: 1 }
 */

interface PostBody {
  cases: EvalCase[];
}

export async function POST(req: NextRequest) {
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return Response.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const cases = Array.isArray(body.cases) ? body.cases : [];
  if (cases.length === 0) {
    return Response.json(
      { ok: false, error: "cases_required" },
      { status: 400 },
    );
  }
  if (cases.length > 100) {
    return Response.json(
      { ok: false, error: "max_100_cases_per_call" },
      { status: 413 },
    );
  }

  const results: EvalResult[] = cases.map((c) => evalOne(c));
  const labelled = results.filter((r) => r.match !== undefined);
  const agreeing = results.filter((r) => r.match === "agree").length;
  const agreementRate =
    labelled.length > 0 ? agreeing / labelled.length : 0;

  return Response.json({
    ok: true,
    schemaVersion: 1,
    /** Identifies which critic the eval ran against. Bumps when we swap to
     * the trained model. */
    critic: "heuristic-v1",
    agreementRate,
    results,
  });
}

function evalOne(c: EvalCase): EvalResult {
  const venueId = (c.venue || "generic") as VenueId;
  const report = synthesise(c.paperAbstract, venueId);
  const forecast = computeForecast(venueId, report);
  const predicted = forecast.acceptProbability >= 0.5;
  const actualAccept = c.actualDecision === "accept";
  const match: EvalResult["match"] = actualAccept
    ? predicted
      ? "agree"
      : "miss-low"
    : predicted
      ? "miss-high"
      : "agree";
  return {
    caseId: c.caseId,
    predictedBand: forecast.band,
    predictedAccept: forecast.acceptProbability,
    match,
  };
}

function synthesise(abstract: string, venueId: VenueId): AnalysisReport {
  const text = (abstract ?? "").toLowerCase();
  const has = (re: RegExp) => re.test(text);
  const rubric = rubricForVenue(venueId);
  const scores: RubricScore[] = rubric.dimensions.map((d) => ({
    name: d.name,
    score: signalScore(d.name, has, text.length),
    note: "Synthesised from abstract for eval purposes.",
  }));
  const issues: AnalysisIssue[] = [];
  if (!has(/baseline|outperform|improve/)) {
    issues.push({
      id: "i_b",
      severity: "warning",
      category: "Soundness",
      section: "Abstract",
      quote: "",
      message: "No baseline comparison in the abstract.",
    });
  }
  return {
    summary: "Eval-time synthesised grade.",
    scores,
    issues,
    venue: rubric.name,
    generatedAt: Date.now(),
  };
}

function signalScore(
  name: string,
  has: (re: RegExp) => boolean,
  textLen: number,
): number {
  let s = 0.6;
  const n = name.toLowerCase();
  if (n.includes("clarity") && textLen < 200) s -= 0.15;
  if (
    (n.includes("rigor") || n.includes("method") || n.includes("soundness")) &&
    !has(/baseline|compared|outperform/)
  )
    s -= 0.15;
  if (n.includes("novel") && !has(/novel|first|new|state[\s-]?of[\s-]?the[\s-]?art/))
    s -= 0.1;
  if (n.includes("reproduc") && !has(/code|open|github|release/)) s -= 0.15;
  return Math.max(0.05, Math.min(0.95, s));
}
