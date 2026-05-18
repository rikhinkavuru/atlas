import { NextRequest } from "next/server";
import { summariseLedger } from "@/lib/provenance";
import type {
  ProvenanceEvent,
  ProvenanceLedger,
  ProvenanceSummary,
} from "@/types";

export const runtime = "nodejs";

interface Match {
  event: ProvenanceEvent;
  score: number;
  reason: "exact" | "substring" | "fuzzy";
  matchedQuote?: string;
}

interface Response {
  ok: boolean;
  query: string;
  matches: Match[];
  summary?: ProvenanceSummary;
  message?: string;
}

/**
 * Given a claim (sentence or short phrase) and a paper's provenance ledger,
 * return the event(s) that most plausibly produced that claim. Lets reviewers
 * point at one suspicious sentence and immediately see its origin without
 * having to scroll the whole ledger.
 */
export async function POST(req: NextRequest) {
  let body: { ledger?: ProvenanceLedger; claim?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { ok: false, query: "", matches: [], message: "Body must be JSON." },
      { status: 400 },
    );
  }
  const claim = (body.claim ?? "").trim();
  const ledger = body.ledger;
  if (!ledger || !Array.isArray(ledger.events)) {
    return Response.json(
      {
        ok: false,
        query: claim,
        matches: [],
        message:
          "Expected { ledger: { events: [...] }, claim: '...' } in the body.",
      },
      { status: 400 },
    );
  }
  if (claim.length < 16) {
    return Response.json(
      {
        ok: false,
        query: claim,
        matches: [],
        message:
          "Claim must be at least 16 characters — pass a sentence fragment, not a single word.",
      },
      { status: 400 },
    );
  }
  if (claim.length > 2000) {
    return Response.json(
      {
        ok: false,
        query: claim,
        matches: [],
        message: "Claim too long — paste at most 2,000 characters.",
      },
      { status: 400 },
    );
  }

  const normalised = normalise(claim);
  const matches: Match[] = [];

  for (const event of ledger.events) {
    const candidates: Array<{ text: string; weight: number }> = [];
    if (event.after) candidates.push({ text: event.after, weight: 1 });
    if (event.before) candidates.push({ text: event.before, weight: 0.5 });
    for (const src of event.sources ?? []) {
      candidates.push({ text: src.quote, weight: 0.4 });
    }

    let bestScore = 0;
    let bestReason: Match["reason"] = "fuzzy";
    let bestQuote: string | undefined;

    for (const c of candidates) {
      const cn = normalise(c.text);
      if (!cn) continue;
      if (cn === normalised) {
        if (1 * c.weight > bestScore) {
          bestScore = 1 * c.weight;
          bestReason = "exact";
          bestQuote = c.text;
        }
        continue;
      }
      if (cn.includes(normalised) || normalised.includes(cn)) {
        const long = Math.max(cn.length, normalised.length);
        const short = Math.min(cn.length, normalised.length);
        const score = (short / long) * 0.9 * c.weight;
        if (score > bestScore) {
          bestScore = score;
          bestReason = "substring";
          bestQuote = c.text;
        }
        continue;
      }
      const j = jaccard(normalised, cn);
      const score = j * c.weight;
      if (score > bestScore) {
        bestScore = score;
        bestReason = "fuzzy";
        bestQuote = c.text;
      }
    }
    if (bestScore >= 0.18) {
      matches.push({
        event,
        score: round(bestScore, 3),
        reason: bestReason,
        matchedQuote: bestQuote,
      });
    }
  }
  matches.sort((a, b) => b.score - a.score);

  const summary = await summariseLedger(ledger);

  return Response.json({
    ok: true,
    query: claim,
    matches: matches.slice(0, 6),
    summary,
  } satisfies Response);
}

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function jaccard(a: string, b: string): number {
  const ta = new Set(a.split(" ").filter((t) => t.length > 2));
  const tb = new Set(b.split(" ").filter((t) => t.length > 2));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function round(n: number, d: number): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
