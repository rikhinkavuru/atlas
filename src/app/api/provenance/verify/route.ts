import { NextRequest } from "next/server";
import { summariseLedger } from "@/lib/provenance";
import type { ProvenanceLedger } from "@/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { ledger?: ProvenanceLedger };
  try {
    body = (await req.json()) as { ledger?: ProvenanceLedger };
  } catch {
    return Response.json(
      { error: "invalid_json", message: "Body must be JSON." },
      { status: 400 },
    );
  }
  const ledger = body.ledger;
  if (!ledger || !ledger.events || !Array.isArray(ledger.events)) {
    return Response.json(
      {
        error: "invalid_ledger",
        message: "Expected { ledger: { paperId, events, ... } }.",
      },
      { status: 400 },
    );
  }
  try {
    const summary = await summariseLedger(ledger);
    return Response.json({
      paperId: ledger.paperId,
      paperTitle: ledger.paperTitle,
      workspaceId: ledger.workspaceId,
      rootHash: ledger.rootHash,
      version: ledger.version,
      summary,
    });
  } catch (err) {
    return Response.json(
      {
        error: "verification_failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
