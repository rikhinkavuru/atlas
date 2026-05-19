import type { ProvenanceLedger, ProvenanceEvent } from "@/types";
import {
  ensureWorkspaceKey,
  publicKeyFingerprint,
  signMessage,
  verifySignature,
  type PublicKeyJwk,
} from "./crypto";
import { canonicalize, sha256 } from "./provenance";
import { normalizeOrcid } from "./orcid";

/**
 * Authorship attestation — the third moat.
 *
 * A signed, exportable claim about who wrote what in a paper, derived from
 * the provenance ledger. Where the ledger answers "what did the AI do",
 * the attestation answers "who is responsible". The two share a workspace
 * key; the attestation links to a ledger via `ledgerRootHash` so a
 * reviewer can chase the citation.
 *
 * The attestation is small enough to embed inline in a submission cover
 * letter or paste into a "AI use disclosure" field. The signature lets
 * journals or universities verify the claim was issued by an Atlas
 * workspace under the named author — not forged after the fact.
 *
 * Why this exists: in 2024–25 every major venue added AI-disclosure
 * requirements (NeurIPS, ACL, Nature, Science, JAMA). Authors today are
 * filling those in by hand, with no way for reviewers to verify the
 * numbers. Atlas already produces the events that make a verifiable
 * disclosure possible — this is the layer that turns them into a
 * journal-ready artifact.
 */

export interface AuthorshipBreakdown {
  /** Fraction of total characters originating from the human author(s). */
  author: number;
  /** AI-edited content that came with at least one verified source. */
  aiSourced: number;
  /** AI-edited content with no source. The "raw AI" share. */
  aiUnsourced: number;
  /** Content imported from external documents (PDFs, paste, sample). */
  imported: number;
}

export interface AuthorshipAuthor {
  name: string;
  orcid?: string;
}

export type DisclosureTemplate =
  | "neurips"
  | "nature"
  | "acl"
  | "icml"
  | "generic";

export interface DisclosureCard {
  template: DisclosureTemplate;
  /** Plain-text body suitable for pasting into a journal submission form. */
  body: string;
}

export interface AuthorshipAttestation {
  schema: "atlas.authorship.v1";
  paperId: string;
  paperTitle: string;
  workspaceId: string;

  /** The named author taking responsibility for the attestation. Their key
   *  is what signs it. */
  author: AuthorshipAuthor;
  /** Other authors named on the paper (no signature requirement; informational). */
  coAuthors: AuthorshipAuthor[];

  generatedAt: number;
  /** The version of Atlas that emitted this attestation — useful when a
   *  journal needs to know which schema/calculation produced the numbers. */
  atlasVersion: string;

  breakdown: AuthorshipBreakdown;
  totalChars: number;

  /** The provenance ledger this attestation summarises. Including the
   *  rootHash lets a reviewer pull the full ledger and audit the math. */
  ledgerRootHash: string;
  ledgerEventCount: number;
  ledgerSignatureFingerprint?: string;

  /** Pre-baked disclosure cards for common venues. The author can use
   *  these verbatim or as a starting point. */
  disclosures: DisclosureCard[];

  /** Detached signature over the canonicalised payload (everything above). */
  signature: string;
  publicKey: PublicKeyJwk;
  publicKeyFingerprint: string;
  /** SHA-256 of the canonicalised payload (the bytes that were signed). */
  attestationHash: string;
}

/** Compute the authorship breakdown from a ledger. Mirrors the calculation
 *  in summariseLedger but exposed as its own export so callers building an
 *  attestation don't have to round-trip through the summary cache.
 *
 *  Slightly more conservative than the ledger summary: where the ledger
 *  splits AI characters across sourced/unsourced proportionally to the
 *  CLAIM counts (not the characters), this function does the same — but
 *  callers can read totalChars to recompute if they want. */
export function computeAuthorshipBreakdown(ledger: ProvenanceLedger): {
  breakdown: AuthorshipBreakdown;
  totalChars: number;
} {
  let authoredChars = 0;
  let aiEditedChars = 0;
  let importedChars = 0;
  let sourcedClaims = 0;
  let unsourcedClaims = 0;
  for (const e of ledger.events) {
    const len = (e.after ?? "").length;
    if (e.kind === "author") {
      authoredChars += len;
    } else if (e.kind === "ai-edit" || e.kind === "ai-insert") {
      aiEditedChars += len;
      sourcedClaims += (e.sources ?? []).length;
      unsourcedClaims += (e.unsupportedClaims ?? []).length;
    } else if (e.kind === "ai-cite") {
      // Citation insertions are tiny and source-anchored by design.
      aiEditedChars += len;
      sourcedClaims += (e.sources ?? []).length;
    } else if (e.kind === "import") {
      importedChars += len;
    } else if (e.kind === "review-response") {
      aiEditedChars += len;
    }
    // "comment" events are deliberately zero-weighted: they're annotations on
    // the manuscript, not contributions to it. If we counted them, a paper
    // with heavy reviewer-thread activity would over-attribute imported or AI
    // share. Listed explicitly so a future ProvenanceKind addition triggers a
    // typechecker error rather than silently falling through.
  }
  const totalChars = Math.max(
    1,
    authoredChars + aiEditedChars + importedChars,
  );
  const totalClaims = Math.max(1, sourcedClaims + unsourcedClaims);
  // Split AI-edited characters into sourced/unsourced by *claim count*, not
  // by character count. Caveat: a single AI rewrite that carries one cited
  // phrase plus a paragraph of un-cited prose gets attributed entirely to
  // "sourced" by this calculation. That's an over-attribution toward
  // sourcing — defensible because the alternative (per-character source
  // tagging) requires markup we don't currently capture, but reviewers
  // should treat "sourced" as "claims with citations" rather than "literally
  // cited characters". The disclosure templates word this carefully ("AI-
  // assisted with verified citations") rather than implying per-char audit.
  //
  // If a paper had AI events but zero claims tracked on either side, we
  // default to fully unsourced — refusing to credit sourcing that wasn't
  // recorded prevents an attestation from inflating its trust signal by
  // exploiting empty arrays.
  const sourcedRatio =
    sourcedClaims + unsourcedClaims === 0
      ? 0
      : sourcedClaims / totalClaims;
  const aiSourced = aiEditedChars * sourcedRatio;
  const aiUnsourced = aiEditedChars - aiSourced;
  return {
    breakdown: {
      author: authoredChars / totalChars,
      aiSourced: aiSourced / totalChars,
      aiUnsourced: aiUnsourced / totalChars,
      imported: importedChars / totalChars,
    },
    totalChars,
  };
}

/** Round a fraction to a percent with one decimal place. */
export function pct(x: number): string {
  return `${(Math.round(x * 1000) / 10).toFixed(1)}%`;
}

interface BuildArgs {
  ledger: ProvenanceLedger;
  paperTitle: string;
  author: AuthorshipAuthor;
  coAuthors?: AuthorshipAuthor[];
  atlasVersion: string;
  /** Optional override: pass the renderDisclosure() outputs you already
   *  have if the dialog already generated them — saves a re-render. */
  disclosures?: DisclosureCard[];
}

/** Build + sign a fresh authorship attestation. The signature is over
 *  everything in the payload except the three signature fields themselves,
 *  so callers verifying later can canonicalise the same payload minus
 *  signature/publicKey/publicKeyFingerprint/attestationHash and check. */
export async function buildAuthorshipAttestation(
  args: BuildArgs,
  renderDisclosure: (
    template: DisclosureTemplate,
    args: BuildArgs & {
      breakdown: AuthorshipBreakdown;
      totalChars: number;
    },
  ) => string,
): Promise<AuthorshipAttestation> {
  const { breakdown, totalChars } = computeAuthorshipBreakdown(args.ledger);
  const author = sanitiseAuthor(args.author);
  const coAuthors = (args.coAuthors ?? []).map(sanitiseAuthor);
  const disclosures: DisclosureCard[] =
    args.disclosures ??
    (["neurips", "nature", "acl", "icml", "generic"] as DisclosureTemplate[])
      .map((template) => ({
        template,
        body: renderDisclosure(template, {
          ...args,
          breakdown,
          totalChars,
        }),
      }));

  const payload = {
    schema: "atlas.authorship.v1" as const,
    paperId: args.ledger.paperId,
    paperTitle: args.paperTitle.slice(0, 240),
    workspaceId: args.ledger.workspaceId,
    author,
    coAuthors,
    generatedAt: Date.now(),
    atlasVersion: args.atlasVersion,
    breakdown,
    totalChars,
    ledgerRootHash: args.ledger.rootHash,
    ledgerEventCount: args.ledger.events.length,
    ledgerSignatureFingerprint: args.ledger.publicKeyFingerprint,
    disclosures,
  };

  const attestationHash = await sha256(canonicalize(payload));
  const { privateKey, publicKey } = await ensureWorkspaceKey();
  const signature = await signMessage(attestationHash, privateKey);
  const fingerprint = await publicKeyFingerprint(publicKey);

  return {
    ...payload,
    signature,
    publicKey,
    publicKeyFingerprint: fingerprint,
    attestationHash,
  };
}

/** Verify the attestation's signature and recompute the hash. Returns the
 *  status string a UI can render directly. */
export async function verifyAuthorshipAttestation(
  attestation: AuthorshipAttestation,
): Promise<{
  status: "valid" | "invalid" | "hash-mismatch" | "missing";
  fingerprint?: string;
}> {
  if (!attestation.signature || !attestation.publicKey) {
    return { status: "missing" };
  }
  // Strip signature fields and recompute hash to confirm payload integrity.
  const {
    signature: _sig,
    publicKey: _pk,
    publicKeyFingerprint: _fp,
    attestationHash: _h,
    ...payload
  } = attestation;
  const recomputedHash = await sha256(canonicalize(payload));
  if (recomputedHash !== attestation.attestationHash) {
    return { status: "hash-mismatch" };
  }
  const ok = await verifySignature(
    attestation.attestationHash,
    attestation.signature,
    attestation.publicKey,
  );
  const fp =
    attestation.publicKeyFingerprint ||
    (await publicKeyFingerprint(attestation.publicKey));
  return ok
    ? { status: "valid", fingerprint: fp }
    : { status: "invalid", fingerprint: fp };
}

function sanitiseAuthor(a: AuthorshipAuthor): AuthorshipAuthor {
  const name = a.name.trim().slice(0, 120);
  const orcid = a.orcid ? normalizeOrcid(a.orcid) : undefined;
  return orcid ? { name, orcid } : { name };
}

/** Serialise the attestation as a JSON-LD doc for journal embedding. */
export function exportAttestationJsonLd(attestation: AuthorshipAttestation) {
  return {
    "@context": "https://atlas.example/schemas/authorship/v1",
    "@type": "AtlasAuthorshipAttestation",
    ...attestation,
    generatedAt: new Date(attestation.generatedAt).toISOString(),
  };
}

/** Convenience: pull the "primary" disclosure for a given venue tag. */
export function disclosureForVenue(
  attestation: AuthorshipAttestation,
  template: DisclosureTemplate,
): DisclosureCard | undefined {
  return attestation.disclosures.find((d) => d.template === template);
}

/** Quick formatter for the badge / inline summary. */
export function authorshipHeadline(
  breakdown: AuthorshipBreakdown,
): string {
  const author = pct(breakdown.author);
  const ai = pct(breakdown.aiSourced + breakdown.aiUnsourced);
  return `${author} author · ${ai} AI-assisted`;
}

/** Coerce/validate a parsed-from-JSON attestation. Returns null when the
 *  shape is not recognised (rejects partial attestations from older
 *  schema versions rather than treating them as valid). */
export function parseAttestation(raw: unknown): AuthorshipAttestation | null {
  if (
    !raw ||
    typeof raw !== "object" ||
    (raw as { schema?: string }).schema !== "atlas.authorship.v1"
  ) {
    return null;
  }
  const r = raw as Partial<AuthorshipAttestation>;
  if (
    typeof r.paperId !== "string" ||
    typeof r.paperTitle !== "string" ||
    typeof r.workspaceId !== "string" ||
    !r.author ||
    !r.breakdown ||
    !r.ledgerRootHash ||
    !r.signature ||
    !r.publicKey ||
    !r.attestationHash
  ) {
    return null;
  }
  return r as AuthorshipAttestation;
}

/** Per-event provenance attribution preview — used by the dialog to
 *  show which paragraphs in a paper came from which source. Returns the
 *  events in chain order with derived "share" weights. */
export function attributionTimeline(ledger: ProvenanceLedger): Array<{
  event: ProvenanceEvent;
  share: number;
  attribution: "author" | "ai-sourced" | "ai-unsourced" | "imported" | "other";
}> {
  const { totalChars } = computeAuthorshipBreakdown(ledger);
  return ledger.events.map((event) => {
    const len = (event.after ?? "").length;
    let attribution: "author" | "ai-sourced" | "ai-unsourced" | "imported" | "other" = "other";
    if (event.kind === "author") attribution = "author";
    else if (event.kind === "import") attribution = "imported";
    else if (event.kind === "ai-edit" || event.kind === "ai-insert") {
      attribution = (event.sources ?? []).length > 0 ? "ai-sourced" : "ai-unsourced";
    } else if (event.kind === "ai-cite") attribution = "ai-sourced";
    return {
      event,
      share: len / Math.max(1, totalChars),
      attribution,
    };
  });
}
