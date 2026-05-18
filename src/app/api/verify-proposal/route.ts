import { NextRequest } from "next/server";
import type {
  EditProposal,
  ProposalSource,
  VerificationResult,
} from "@/types";

export const runtime = "nodejs";

interface PostBody {
  proposal: EditProposal;
}

/**
 * Gate citations on a proposal before they reach the editor.
 *
 * For each source with a DOI or URL, we hit /api/verify-citation (which fans
 * out to CrossRef / OpenAlex / Semantic Scholar / Nia). Sources that don't
 * resolve get `verified: false` AND get added to `unsupportedClaims` so the
 * editor flashes them as risky. Sources whose origin is "selection" or
 * "draft" are trusted as-is — they were already in the user's document.
 *
 * The full source list survives — we don't drop anything — so the user can
 * decide. The ledger will record the verified-vs-unverified split.
 */
export async function POST(req: NextRequest) {
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return Response.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const proposal = body.proposal;
  if (!proposal || typeof proposal !== "object") {
    return Response.json(
      { ok: false, error: "proposal_required" },
      { status: 400 },
    );
  }

  const niaKey = req.headers.get("x-nia-key") ?? "";
  const origin = new URL(req.url).origin;

  const sources: ProposalSource[] = Array.isArray(proposal.sources)
    ? proposal.sources
    : [];

  const verified = await Promise.all(
    sources.map((s) => verifyOne(s, origin, niaKey)),
  );

  const unverifiedLabels = verified
    .filter((s) => s.origin !== "selection" && s.origin !== "draft" && s.verified === false)
    .map((s) => s.label || s.doi || s.url || s.quote.slice(0, 60));

  const updatedProposal: EditProposal = {
    ...proposal,
    sources: verified,
    unsupportedClaims: dedup([
      ...(Array.isArray(proposal.unsupportedClaims)
        ? proposal.unsupportedClaims
        : []),
      ...unverifiedLabels,
    ]),
  };

  return Response.json({ ok: true, proposal: updatedProposal });
}

async function verifyOne(
  src: ProposalSource,
  origin: string,
  niaKey: string,
): Promise<ProposalSource> {
  // Internal-origin sources are inherently trusted — they came from the
  // user's draft or our verified library, not the model's imagination.
  if (src.origin === "selection" || src.origin === "draft") {
    return { ...src, verified: true, confidence: 1, resolvedVia: src.origin };
  }
  // Already library-verified: pass through but mark verified so UI can show it.
  if (src.origin === "library" || src.origin === "verified") {
    return {
      ...src,
      verified: true,
      confidence: src.confidence ?? 0.9,
      resolvedVia: src.origin,
    };
  }
  const query = (src.doi || src.url || src.label || "").trim();
  if (!query) {
    return { ...src, verified: false };
  }
  try {
    const r = await fetch(`${origin}/api/verify-citation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(niaKey ? { "x-nia-key": niaKey } : {}),
      },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(7500),
    });
    if (!r.ok) return { ...src, verified: false };
    const data = (await r.json()) as VerificationResult;
    if (data.resolved && data.best) {
      return {
        ...src,
        verified: true,
        confidence: data.best.confidence,
        resolvedVia: data.best.source,
        // Backfill DOI/URL if we resolved by title.
        doi: src.doi || data.best.doi || undefined,
        url: src.url || data.best.url || undefined,
      };
    }
    return { ...src, verified: false, confidence: data.best?.confidence };
  } catch {
    return { ...src, verified: false };
  }
}

function dedup(arr: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of arr) {
    const k = s.toLowerCase().trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}
