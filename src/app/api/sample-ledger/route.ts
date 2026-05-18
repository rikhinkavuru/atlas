import {
  buildEvent,
  computeRootHash,
  signRoot,
} from "@/lib/provenance";
import type { ProvenanceEvent, ProvenanceLedger } from "@/types";

export const runtime = "nodejs";

/**
 * Returns a freshly built, hash-chained, signed sample ledger so reviewers
 * landing on /verify have something realistic to drop into the verifier
 * without owning a paper of their own yet.
 */
export async function GET() {
  const workspaceId = "ws_sample_atlas_public";
  const paperId = "p_sample_atlasrag";
  const paperTitle =
    "AtlasRAG · Long-Context Retrieval-Augmented Generation for Scientific QA";

  const seeds: Array<Parameters<typeof buildEvent>[1]> = [
    {
      paperId,
      kind: "import",
      actor: { type: "import", label: "PDF · Vaswani 2017" },
      after:
        "Attention Is All You Need — sequence transduction models based on attention, dispensing with recurrence and convolutions entirely.",
    },
    {
      paperId,
      kind: "ai-edit",
      actor: { type: "ai", label: "Atlas Agent · anthropic" },
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      prompt: "tighten the related-work paragraph",
      before:
        "Dense retrieval over scientific text has been studied extensively. Specter and SciNCL learn paper-level embeddings, while ColBERTv2 generalises to fine-grained passage retrieval.",
      after:
        "Dense retrieval over scientific text is well-studied: SPECTER and SciNCL learn paper-level embeddings, ColBERTv2 generalises to passage-level.",
      sources: [
        {
          label: "Khattab & Zaharia · ColBERTv2",
          origin: "verified",
          doi: "10.18653/v1/2022.naacl-main.272",
          url: "https://doi.org/10.18653/v1/2022.naacl-main.272",
          quote:
            "ColBERTv2 trains a single late-interaction model that we use as a stronger retrieval baseline.",
        },
        {
          label: "Cohan et al. · SPECTER",
          origin: "verified",
          doi: "10.18653/v1/2020.acl-main.207",
          url: "https://doi.org/10.18653/v1/2020.acl-main.207",
          quote:
            "SPECTER produces paper-level embeddings using the citation graph as supervision.",
        },
      ],
    },
    {
      paperId,
      kind: "ai-cite",
      actor: { type: "ai", label: "Citation library" },
      after: "[Vaswani2017]",
      sources: [
        {
          label: "Vaswani et al. · Attention Is All You Need",
          origin: "library",
          doi: "10.48550/arXiv.1706.03762",
          url: "https://arxiv.org/abs/1706.03762",
          quote:
            "We propose a new simple network architecture, the Transformer, based solely on attention mechanisms.",
        },
      ],
    },
    {
      paperId,
      kind: "author",
      actor: { type: "author", label: "Rikhin · author" },
      after:
        "We argue for a middle path: long-context reading lets the reader reason across surviving evidence after retrieval narrows the haystack.",
    },
    {
      paperId,
      kind: "ai-edit",
      actor: { type: "ai", label: "Atlas Agent · openai" },
      provider: "openai",
      model: "gpt-4o-mini",
      prompt: "make the experimental claim more rigorous",
      before:
        "AtlasRAG achieves 71.3% exact-match accuracy compared to a strong dense baseline.",
      after:
        "AtlasRAG achieves 71.3% (95% CI 70.1–72.5) exact-match accuracy compared to a strong dense baseline of 59.9%.",
      sources: [
        {
          label: "(internal · evaluation results table 2)",
          origin: "draft",
          quote:
            "Table 2 reports per-seed exact-match scores. AtlasRAG: 71.3% (σ=0.6).",
        },
      ],
      unsupportedClaims: [
        "claim that the 11.4-point delta is statistically significant",
      ],
    },
  ];

  const events: ProvenanceEvent[] = [];
  let prev: ProvenanceEvent | null = null;
  for (const seed of seeds) {
    const ev = await buildEvent(prev, seed);
    events.push(ev);
    prev = ev;
  }
  const rootHash = await computeRootHash(workspaceId, paperId, prev!.hash);
  let signature: string | undefined;
  let publicKey: ProvenanceLedger["publicKey"];
  let publicKeyFingerprint: string | undefined;
  try {
    const signed = await signRoot(rootHash);
    signature = signed.signature;
    publicKey = signed.publicKey;
    publicKeyFingerprint = signed.fingerprint;
  } catch {
    // Older runtime — return unsigned ledger; verifier handles "missing" cleanly.
  }
  const ledger: ProvenanceLedger = {
    paperId,
    paperTitle,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 14,
    updatedAt: Date.now(),
    workspaceId,
    events,
    rootHash,
    signature,
    publicKey,
    publicKeyFingerprint,
    version: 1,
  };
  return Response.json({ ledger });
}
