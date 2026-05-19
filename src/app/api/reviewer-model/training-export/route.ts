import { NextRequest } from "next/server";
import type { ReviewerModelTuple } from "@/lib/training-export";

export const runtime = "nodejs";

/**
 * Accept a single anonymised training tuple from an opted-in user.
 *
 * The endpoint exists today as the published contract — the training corpus
 * isn't being collected yet (see /reviewer-model "Until the first training
 * run, nothing leaves your browser"). When collection opens, this route is
 * what the client POSTs to. Until then it validates and acknowledges, but
 * does not durably store the tuple.
 *
 * Anti-abuse: we hard-cap the payload size and the per-IP rate (in-process,
 * best-effort). Real durability + training-run management lives off-platform.
 */

interface AcceptedResponse {
  ok: true;
  /** Always echoes the tupleId so the client can show "received: <id>". */
  tupleId: string;
  /** Whether the tuple was stored (today: never) or only validated. */
  stored: boolean;
  /** When the next training run cutoff is, if planned. null = no run yet. */
  nextTrainingRunDay: string | null;
}

interface RejectedResponse {
  ok: false;
  error: string;
}

// Best-effort in-process rate limit. Vercel serverless will reset across cold
// starts; that's fine — a real abuse signal looks like sustained traffic from
// one IP within a warm instance, which this catches. Production deployment
// should add Vercel Edge Config or a WAF.
const PER_IP_LIMIT = 20;
const PER_IP_WINDOW_MS = 60_000;
declare global {
  // eslint-disable-next-line no-var
  var __atlasTrainExportRate: Map<string, number[]> | undefined;
}
function rateAllowed(ip: string): boolean {
  if (!globalThis.__atlasTrainExportRate) {
    globalThis.__atlasTrainExportRate = new Map();
  }
  const buckets = globalThis.__atlasTrainExportRate;
  const now = Date.now();
  const list = buckets.get(ip) ?? [];
  const recent = list.filter((t) => now - t < PER_IP_WINDOW_MS);
  recent.push(now);
  buckets.set(ip, recent);
  return recent.length <= PER_IP_LIMIT;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  if (!rateAllowed(ip)) {
    return Response.json(
      { ok: false, error: "rate_limited" } satisfies RejectedResponse,
      { status: 429 },
    );
  }

  let body: { tuple?: ReviewerModelTuple };
  try {
    body = (await req.json()) as { tuple?: ReviewerModelTuple };
  } catch {
    return Response.json(
      { ok: false, error: "bad_json" } satisfies RejectedResponse,
      { status: 400 },
    );
  }
  const tuple = body.tuple;
  const validation = validateTuple(tuple);
  if (!validation.ok) {
    return Response.json(
      { ok: false, error: validation.error } satisfies RejectedResponse,
      { status: 400 },
    );
  }

  // Today we do NOT durably store. The collection switch flips when the
  // first training run is announced; until then the route is a strict
  // validator + ack so the client integration can be wired and tested.
  return Response.json({
    ok: true,
    tupleId: tuple!.tupleId,
    stored: false,
    nextTrainingRunDay: null,
  } satisfies AcceptedResponse);
}

function validateTuple(
  t: ReviewerModelTuple | undefined,
): { ok: true } | { ok: false; error: string } {
  if (!t || typeof t !== "object") return { ok: false, error: "tuple_missing" };
  if (t.schemaVersion !== 1)
    return { ok: false, error: "schema_version_unsupported" };
  if (typeof t.tupleId !== "string" || !/^[a-f0-9]{8,32}$/.test(t.tupleId)) {
    return { ok: false, error: "tupleId_invalid" };
  }
  if (
    typeof t.exportedOnDay !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(t.exportedOnDay)
  ) {
    return { ok: false, error: "exportedOnDay_must_be_yyyy_mm_dd" };
  }
  if (typeof t.venue !== "string" || t.venue.length > 60) {
    return { ok: false, error: "venue_invalid" };
  }
  if (typeof t.draftBefore !== "string" || t.draftBefore.length > 2500) {
    return { ok: false, error: "draftBefore_too_large" };
  }
  if (typeof t.draftAfter !== "string" || t.draftAfter.length > 2500) {
    return { ok: false, error: "draftAfter_too_large" };
  }
  if (!Array.isArray(t.acceptedSuggestions) || !Array.isArray(t.rejectedSuggestions)) {
    return { ok: false, error: "suggestions_must_be_arrays" };
  }
  if (t.acceptedSuggestions.length + t.rejectedSuggestions.length > 50) {
    return { ok: false, error: "too_many_suggestions" };
  }
  if (
    t.decisionIfKnown !== null &&
    t.decisionIfKnown !== "accept" &&
    t.decisionIfKnown !== "reject"
  ) {
    return { ok: false, error: "decision_invalid" };
  }
  // Anti-PII smoke check: refuse tuples that look like they still contain
  // an email or ORCID despite the strip — they'd have been stripped on the
  // client; if not, the client has a bug or someone is sending raw data.
  const haystack = `${t.draftBefore}\n${t.draftAfter}`;
  if (/\d{4}-\d{4}-\d{4}-\d{3}[0-9X]/.test(haystack)) {
    return { ok: false, error: "pii_orcid_detected" };
  }
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(haystack)) {
    return { ok: false, error: "pii_email_detected" };
  }
  return { ok: true };
}
