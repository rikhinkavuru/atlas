import { NextRequest } from "next/server";
import { deriveShareKey, getStore, type PublishedLedger } from "@/lib/ledger-store";
import { requireTier } from "@/lib/tier";
import type { ProvenanceLedger } from "@/types";

export const runtime = "nodejs";

interface PublishBody {
  ledger: ProvenanceLedger;
  paperTitle?: string;
}

/**
 * Publish a ledger so reviewers can fetch it from a URL we control.
 *
 * The shareKey is derived from the ledger's rootHash — re-publishing a
 * never-modified ledger returns the same URL (idempotent), while any edit
 * after the seal produces a new key. Reviewers can therefore distinguish
 * "the version the author shared with me" from "what's in the workspace now."
 */
export async function POST(req: NextRequest) {
  // Publishing a ledger is a Pro feature — see /pricing. Free tier still
  // gets the local /verify route to validate their own ledger from a JSON
  // file; only the durable hosted URL is gated.
  const tierBlock = await requireTier(req, "pro");
  if (tierBlock) return tierBlock;

  let body: PublishBody;
  try {
    body = (await req.json()) as PublishBody;
  } catch {
    return Response.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const ledger = body.ledger;
  if (!ledger?.events || !Array.isArray(ledger.events) || !ledger.rootHash) {
    return Response.json(
      { ok: false, error: "ledger_invalid" },
      { status: 400 },
    );
  }
  // Defensive cap — published ledgers are signed JSON; anything over 1 MB is
  // almost certainly malformed or hostile.
  const approxSize = JSON.stringify(ledger).length;
  if (approxSize > 1_048_576) {
    return Response.json(
      { ok: false, error: "ledger_too_large", approxSize },
      { status: 413 },
    );
  }

  const shareKey = deriveShareKey(ledger.rootHash);
  const record: PublishedLedger = {
    shareKey,
    paperTitle:
      body.paperTitle?.slice(0, 200) ||
      ledger.paperTitle?.slice(0, 200) ||
      "Untitled paper",
    ledger,
    publishedAt: Date.now(),
  };
  await getStore().put(record);

  return Response.json({
    ok: true,
    shareKey,
    /** Relative path so the client can resolve against window.location.origin. */
    sharePath: `/p/${shareKey}`,
  });
}
