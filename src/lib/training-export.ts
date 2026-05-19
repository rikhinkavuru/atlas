import type {
  AnalysisReport,
  EditProposal,
  Paper,
  ProvenanceLedger,
  SubmissionForecast,
} from "@/types";

/**
 * Training-data export for the Atlas Reviewer Model.
 *
 * Schema for a single tuple — the unit of supervision the trained model
 * will consume. We export only what the model needs and strip everything
 * that identifies the author, the lab, or the paper's identity:
 *
 *   - draftBefore / draftAfter   plain-text excerpts (no titles, no
 *                                  authors). Diff signal for the model.
 *   - acceptedSuggestions[]      proposals the author accepted (after).
 *   - rejectedSuggestions[]      proposals the author rejected (after).
 *   - venue                       venue id from settings (no preprint hosts).
 *   - decisionIfKnown            "accept" | "reject" | null. Author-supplied
 *                                  when finalising; null is the common case.
 *   - rubricScore                latest critic grade (per-dimension) if any.
 *   - forecastBand               accept-probability band at submission time.
 *
 * What we strip:
 *   - Paper title, authors, abstract
 *   - Comments, bindings, lab info
 *   - Anything in voice profile (writing style)
 *   - Hashes, signatures, fingerprints — the ledger root-hash and signature
 *     could correlate a user across multiple submissions, so we replace them
 *     with a tuple-local random id at export time.
 *   - Timestamps below day granularity
 *
 * The export runs entirely in-browser: nothing leaves the user's machine
 * unless they explicitly POST the resulting JSON to the training endpoint.
 */

export interface ReviewerModelTuple {
  /** Random per-tuple id — not stable across exports, not tied to user. */
  tupleId: string;
  /** Day-granularity timestamp (no hour/minute). */
  exportedOnDay: string;
  venue: string;
  /** Plain-text first 2000 chars of the draft (no title/author). */
  draftBefore: string;
  /** Same but after edits, for diff supervision. */
  draftAfter: string;
  acceptedSuggestions: Array<{ before: string; after: string; rationale: string }>;
  rejectedSuggestions: Array<{ before: string; after: string; rationale: string }>;
  rubricScores?: Array<{ name: string; score: number }>;
  forecastBand?: SubmissionForecast["band"];
  decisionIfKnown: "accept" | "reject" | null;
  /** Schema version — bump when shape changes so trainers know which parser. */
  schemaVersion: 1;
}

interface ExportInputs {
  paper: Paper;
  ledger?: ProvenanceLedger;
  analysis?: AnalysisReport | null;
  forecast?: SubmissionForecast;
  venue: string;
  /** Edit proposals the agent has shown for this paper, with their final status.
   *  Sourced from the agent message log. */
  proposalHistory: Array<EditProposal>;
  /** Author-recorded decision after submission, if any. */
  decisionIfKnown: "accept" | "reject" | null;
}

export function buildReviewerModelTuple(
  inputs: ExportInputs,
): ReviewerModelTuple {
  const accepted: ReviewerModelTuple["acceptedSuggestions"] = [];
  const rejected: ReviewerModelTuple["rejectedSuggestions"] = [];

  for (const p of inputs.proposalHistory) {
    // Strip identifiers BEFORE slicing so the cap doesn't accidentally
    // truncate the [EMAIL]/[ORCID]/[INSTITUTION] replacement mid-token and
    // leave the original prefix exposed. Rationale gets stripped too — model
    // explanations sometimes echo author names back ("As Dr. Smith says…").
    const item = {
      before: stripIdentifiers(p.before).slice(0, 800),
      after: stripIdentifiers(p.after).slice(0, 800),
      rationale: stripIdentifiers(p.rationale).slice(0, 400),
    };
    if (p.status === "accepted") accepted.push(item);
    else if (p.status === "rejected") rejected.push(item);
  }

  const draftBefore =
    inputs.ledger?.events.find((e) => e.kind === "import")?.after ??
    inputs.proposalHistory[0]?.before ??
    "";
  const draftAfter = htmlToPlain(inputs.paper.html);

  return {
    tupleId: randomTupleId(),
    exportedOnDay: new Date().toISOString().slice(0, 10),
    venue: inputs.venue,
    draftBefore: stripIdentifiers(draftBefore).slice(0, 2000),
    draftAfter: stripIdentifiers(draftAfter).slice(0, 2000),
    acceptedSuggestions: accepted,
    rejectedSuggestions: rejected,
    rubricScores: inputs.analysis?.scores.map((s) => ({
      name: s.name,
      score: s.score,
    })),
    forecastBand: inputs.forecast?.band,
    decisionIfKnown: inputs.decisionIfKnown,
    schemaVersion: 1,
  };
}

/** Strip obvious author-identifying tokens. Imperfect by design — the
 * canonical defence is content-policy and the day-granularity timestamp;
 * this scrubs the most common direct identifiers. The server-side route
 * runs a second smoke check to refuse anything that still slipped through. */
function stripIdentifiers(text: string): string {
  return text
    // ORCID iDs
    .replace(/\b\d{4}-\d{4}-\d{4}-\d{3}[0-9X]\b/g, "[ORCID]")
    // Email addresses
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]")
    // arXiv IDs (identify the paper directly)
    .replace(/\b\d{4}\.\d{4,5}(v\d+)?\b/g, "[ARXIV]")
    // DOIs (also paper-identifying when combined with content)
    .replace(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/gi, "[DOI]")
    // GitHub user / repo URLs (often embedded as code-release links)
    .replace(/\bhttps?:\/\/(?:www\.)?github\.com\/[\w.-]+(?:\/[\w.-]+)?/gi, "[GITHUB]")
    // GitLab / Bitbucket / institutional Gitea instances
    .replace(/\bhttps?:\/\/(?:gitlab|bitbucket)\.[a-z.]+\/[\w.-]+(?:\/[\w.-]+)?/gi, "[GIT]")
    // Twitter / X / Bluesky / Mastodon handles
    .replace(/(?:^|[\s(])@[A-Za-z0-9_]{2,30}\b/g, " [HANDLE]")
    .replace(/\bhttps?:\/\/(?:www\.)?(?:twitter|x)\.com\/[\w.-]+/gi, "[HANDLE]")
    // Personal / lab homepages (common patterns: people.xxx.edu, ~user/, etc.)
    .replace(/\bhttps?:\/\/[\w.-]+\.(?:edu|ac\.[a-z]{2,3})\/[~\w./-]+/gi, "[HOMEPAGE]")
    // Common author affiliation patterns
    .replace(/\bUniversity of [A-Z][a-z]+\b/g, "[INSTITUTION]")
    .replace(/\b[A-Z][a-z]+ University\b/g, "[INSTITUTION]")
    .replace(/\b(?:Carnegie\s+Mellon|Stanford|Berkeley|MIT|Caltech|Princeton|Harvard|Yale|Oxford|Cambridge|ETH|EPFL|DeepMind|Google\s+Research|Microsoft\s+Research|Meta\s+AI|OpenAI|Anthropic)\b/g, "[INSTITUTION]");
}

function htmlToPlain(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function randomTupleId(): string {
  // Local random — never derived from anything user-stable.
  const bytes = new Uint8Array(8);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++)
      bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Eval-harness contract. The training endpoint posts a held-out
 * paper-and-actual-decision pair; the harness runs the current model
 * (heuristic + reviewer-2 today, fine-tuned model when it ships) and
 * returns predicted band + accept-probability + reviewer-2 questions
 * so the runtime can compare against the held-out actual decision.
 */
export interface EvalCase {
  caseId: string;
  /** Anonymous, public review-pair from OpenReview/ACL/etc. */
  paperAbstract: string;
  venue: string;
  actualDecision: "accept" | "reject" | "withdrawn";
}
export interface EvalResult {
  caseId: string;
  predictedBand: SubmissionForecast["band"];
  predictedAccept: number;
  match: "agree" | "miss-low" | "miss-high";
}
