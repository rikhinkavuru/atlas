import { NextRequest } from "next/server";
import type {
  EditPlan,
  EditPlanStep,
  EditProposal,
  ProposalSource,
  VerificationResult,
} from "@/types";

export const runtime = "nodejs";

interface PostBody {
  /** A single edit-mode proposal — verify its sources before insertion. */
  proposal?: EditProposal;
  /** A plan-mode multi-step edit — verify each step's sources. */
  plan?: EditPlan;
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
  const niaKey = req.headers.get("x-nia-key") ?? "";
  const origin = new URL(req.url).origin;

  if (body.proposal) {
    const updated = await verifyEditProposal(body.proposal, origin, niaKey);
    return Response.json({ ok: true, proposal: updated });
  }
  if (body.plan) {
    const updated = await verifyEditPlan(body.plan, origin, niaKey);
    return Response.json({ ok: true, plan: updated });
  }
  return Response.json(
    { ok: false, error: "proposal_or_plan_required" },
    { status: 400 },
  );
}

async function verifyEditProposal(
  proposal: EditProposal,
  origin: string,
  niaKey: string,
): Promise<EditProposal> {
  const sources: ProposalSource[] = Array.isArray(proposal.sources)
    ? proposal.sources
    : [];

  const verified = await Promise.all(
    sources.map((s) => verifyOne(s, origin, niaKey)),
  );

  const unverifiedLabels = verified
    .filter(
      (s) =>
        s.origin !== "selection" &&
        s.origin !== "draft" &&
        s.verified === false,
    )
    .map((s) => s.label || s.doi || s.url || s.quote.slice(0, 60));

  return {
    ...proposal,
    sources: verified,
    unsupportedClaims: dedup([
      ...(Array.isArray(proposal.unsupportedClaims)
        ? proposal.unsupportedClaims
        : []),
      ...unverifiedLabels,
    ]),
  };
}

async function verifyEditPlan(
  plan: EditPlan,
  origin: string,
  niaKey: string,
): Promise<EditPlan> {
  // Verify each step in parallel. Each step may declare sources, or contain
  // inline citation tokens in `draft` we should resolve.
  const verifiedSteps = await Promise.all(
    plan.steps.map(async (step) => verifyStep(step, origin, niaKey)),
  );
  return { ...plan, steps: verifiedSteps };
}

async function verifyStep(
  step: EditPlanStep,
  origin: string,
  niaKey: string,
): Promise<EditPlanStep> {
  // Sources declared explicitly by the model: verify each.
  const declared: ProposalSource[] = Array.isArray(step.sources)
    ? step.sources
    : [];
  const verifiedSources = await Promise.all(
    declared.map((s) => verifyOne(s, origin, niaKey)),
  );

  // Inline tokens embedded in `step.draft` — look for [Author20XX]-style or
  // bare DOIs and verify those too. Resolved tokens get added as verified
  // sources; unresolved ones go in unsupportedClaims.
  const inlineCitations = extractInlineCitations(step.draft ?? "");
  const inlineVerified = await Promise.all(
    inlineCitations.map(async (token) => {
      try {
        const r = await fetch(`${origin}/api/verify-citation`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(niaKey ? { "x-nia-key": niaKey } : {}),
          },
          body: JSON.stringify({ query: token }),
          signal: AbortSignal.timeout(7500),
        });
        if (!r.ok) return { token, ok: false as const };
        const data = (await r.json()) as VerificationResult;
        if (data.resolved && data.best) {
          return {
            token,
            ok: true as const,
            source: {
              label: token,
              quote:
                data.best.snippet ??
                `${data.best.title} — ${data.best.authors.slice(0, 3).join(", ")}`,
              url: data.best.url,
              doi: data.best.doi ?? undefined,
              origin: "verified" as const,
              verified: true,
              confidence: data.best.confidence,
              resolvedVia: data.best.source,
            } satisfies ProposalSource,
          };
        }
        return { token, ok: false as const };
      } catch {
        return { token, ok: false as const };
      }
    }),
  );

  const resolvedFromInline = inlineVerified
    .filter((v) => v.ok)
    .map((v) => v.source);
  const unresolvedFromInline = inlineVerified
    .filter((v) => !v.ok)
    .map((v) => v.token);

  const unverifiedDeclared = verifiedSources
    .filter(
      (s) =>
        s.origin !== "selection" &&
        s.origin !== "draft" &&
        s.verified === false,
    )
    .map((s) => s.label || s.doi || s.url || s.quote.slice(0, 60));

  return {
    ...step,
    sources: [...verifiedSources, ...resolvedFromInline],
    unsupportedClaims: dedup([
      ...(Array.isArray(step.unsupportedClaims) ? step.unsupportedClaims : []),
      ...unverifiedDeclared,
      ...unresolvedFromInline,
    ]),
  };
}

function extractInlineCitations(draft: string): string[] {
  // Bracket-style author-year tokens: [Smith2024] or [Smith et al. 2024]
  const bracketRe = /\[([A-Z][A-Za-z]+(?:\s+et\s+al\.?)?\s*\d{4}[a-z]?)\]/g;
  // DOIs anywhere in the draft body.
  const doiRe = /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+/gi;
  const out: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = bracketRe.exec(draft))) {
    const t = m[1].trim();
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  while ((m = doiRe.exec(draft))) {
    const t = m[0].trim();
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out.slice(0, 8); // cap so a step with 50 citations doesn't fan out wildly
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
