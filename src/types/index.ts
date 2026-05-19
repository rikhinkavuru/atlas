export type TabKind = "editor" | "browser" | "search" | "library" | "review";

export interface Tab {
  id: string;
  kind: TabKind;
  title: string;
  paperId?: string;
  url?: string;
  query?: string;
  reviewId?: string;
}

export interface Paper {
  id: string;
  title: string;
  html: string;
  updatedAt: number;
}

export interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  pending?: boolean;
  proposal?: EditProposal;
  citations?: Source[];
  citationCandidates?: CitationCandidate[];
  plan?: EditPlan;
  timestamp: number;
  /** Set when this assistant message represents a failed request. Carries
   * the original prompt + mode so the user can retry without retyping. */
  error?: { prompt: string; mode: string };
}

export interface EditProposal {
  id: string;
  before: string;
  after: string;
  rationale: string;
  status: "pending" | "accepted" | "rejected";
  sources?: ProposalSource[];
  unsupportedClaims?: string[];
}

export interface ProposalSource {
  label: string;
  quote: string;
  url?: string;
  doi?: string;
  origin: "library" | "verified" | "selection" | "draft";
  /** Set when this source has been resolved against an external registry
   *  (CrossRef / OpenAlex / Semantic Scholar / arXiv / Nia). Undefined when
   *  the gating step hasn't run yet. */
  verified?: boolean;
  /** Confidence from the verifier (0–1). */
  confidence?: number;
  /** Provider that resolved it ("crossref" | "openalex" | ...) when verified. */
  resolvedVia?: string;
}

export interface Source {
  title: string;
  url: string;
  snippet?: string;
}

export interface AnalysisIssue {
  id: string;
  severity: "info" | "suggestion" | "warning" | "error";
  category: string;
  section: string;
  quote: string;
  message: string;
  suggestion?: string;
  rubricCriterion?: string;
}

export interface RubricScore {
  name: string;
  score: number;
  note: string;
  evidence?: string[];
  criteria?: string[];
}

export interface AnalysisReport {
  summary: string;
  scores: RubricScore[];
  issues: AnalysisIssue[];
  venue?: string;
  generatedAt: number;
}

export interface CitationCandidate {
  title: string;
  authors: string[];
  year: number | null;
  doi: string | null;
  url: string;
  source: "crossref" | "openalex" | "semanticscholar" | "arxiv" | "nia" | "manual";
  confidence: number;
  snippet?: string;
}

export interface VerificationResult {
  query: string;
  resolved: boolean;
  best: CitationCandidate | null;
  candidates: CitationCandidate[];
  warning?: string;
}

export interface EditPlanStep {
  id: string;
  section: string;
  action: "rewrite" | "insert" | "delete" | "cite" | "comment";
  targetQuote: string;
  why: string;
  draft: string;
  status?: "pending" | "applied" | "skipped";
  /** Citations the model claims as evidence for this step's draft. Set by
   *  the agent in cite-aware plans; populated/checked by /api/verify-proposal. */
  sources?: ProposalSource[];
  /** Per-step unsupported-claim labels, mirroring EditProposal's shape. */
  unsupportedClaims?: string[];
}

export interface EditPlan {
  goal: string;
  steps: EditPlanStep[];
}

export interface LibraryEntry {
  id: string;
  title: string;
  url: string;
  status: "indexing" | "ready" | "failed";
  addedAt: number;
  source: "nia" | "manual";
  niaId?: string;
}

export interface ReviewerItem {
  id: string;
  number: string;
  reviewerLabel: string;
  comment: string;
  response: string;
  status: "todo" | "drafted" | "addressed" | "rejected";
  linkedQuote?: string;
}

export interface ReviewSession {
  id: string;
  paperId?: string;
  title: string;
  rawText: string;
  items: ReviewerItem[];
  createdAt: number;
}

export type ProvenanceKind =
  | "author"
  | "ai-edit"
  | "ai-insert"
  | "ai-cite"
  | "import"
  | "comment"
  | "review-response";

export interface ProvenanceSourceRef {
  label: string;
  origin: "library" | "verified" | "selection" | "draft";
  doi?: string;
  url?: string;
  quote: string;
}

export interface ProvenanceEvent {
  id: string;
  paperId: string;
  timestamp: number;
  kind: ProvenanceKind;
  actor: {
    type: "author" | "ai" | "import";
    label: string;
    /** Canonical ORCID iD (XXXX-XXXX-XXXX-XXXX) when the author has linked
     *  one. Only set for `type: "author"` events. Reviewers can use this to
     *  verify the human signer matches the published-paper authorship. */
    orcid?: string;
  };
  provider?: string;
  model?: string;
  prompt?: string;
  before?: string;
  after?: string;
  sources?: ProvenanceSourceRef[];
  unsupportedClaims?: string[];
  /** Position of the change in the document (character offset into plain text). */
  position?: { from: number; to: number };
  /** Hash of (prev || canonicalised(content)). */
  hash: string;
  prev: string | null;
}

export interface ProvenanceLedger {
  paperId: string;
  paperTitle: string;
  createdAt: number;
  updatedAt: number;
  workspaceId: string;
  events: ProvenanceEvent[];
  /** SHA-256 of last event hash + workspaceId. */
  rootHash: string;
  /** ECDSA-P256 signature over rootHash. */
  signature?: string;
  /** Public key the signature was produced with. */
  publicKey?: {
    kty: "EC";
    crv: "P-256";
    x: string;
    y: string;
  };
  /** First 16 hex chars of SHA-256(publicKey). Stable fingerprint for display. */
  publicKeyFingerprint?: string;
  version: 1;
}

export interface ProvenanceSummary {
  totalEvents: number;
  authorEvents: number;
  aiEvents: number;
  citeEvents: number;
  importEvents: number;
  authoredChars: number;
  aiEditedChars: number;
  importedChars: number;
  sourcedClaims: number;
  unsourcedClaims: number;
  authorshipBreakdown: {
    author: number;
    ai: number;
    sourced: number;
    imported: number;
  };
  integrity: "valid" | "broken" | "unsigned";
  brokenAtIndex?: number;
  signature:
    | { status: "valid"; fingerprint: string }
    | { status: "invalid"; fingerprint?: string }
    | { status: "missing" };
  generatedAt: number;
}

export type BindingKind = "wandb" | "github" | "arxiv" | "jupyter" | "doi" | "url";

export interface DataBinding {
  id: string;
  paperId: string;
  passage: string;
  url: string;
  kind: BindingKind;
  createdAt: number;
  lastCheckedAt?: number;
  status: "fresh" | "stale" | "missing" | "unknown";
  metadata?: {
    title?: string;
    version?: string;
    lastModified?: string;
    etag?: string;
    contentHash?: string;
    [k: string]: unknown;
  };
  lastSeenHash?: string;
  notes?: string;
}

/**
 * An author commit — keystroke-level edits coalesced into a single record
 * once the author pauses for ~30s or commits a >50-char change. Distinct
 * from ProvenanceEvent: those record AI / import / cite actions that need
 * cryptographic provenance; author edits are tracked locally for
 * track-changes UI but don't go in the signed chain.
 *
 * When real collaborative editing ships (Yjs/Liveblocks), each peer's
 * commits land here with their own actorId — the schema doesn't change.
 */
export interface AuthorEdit {
  id: string;
  paperId: string;
  timestamp: number;
  /** Stable identifier for the human author. "self" until multi-user lands. */
  actorId: string;
  actorLabel: string;
  /** Net word change since the previous commit. Positive = added. */
  wordsDelta: number;
  /** Net character change since the previous commit. */
  charsDelta: number;
  /** Short snippet of the content state at commit time (200 chars). */
  snippet: string;
}

export interface SubmissionForecast {
  venue: string;
  venueName: string;
  acceptProbability: number;
  band: "desk-reject" | "weak" | "borderline" | "competitive" | "strong";
  topPercentile: number;
  drivers: Array<{
    dimension: string;
    delta: number;
    note: string;
  }>;
  caveat: string;
  generatedAt: number;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}
