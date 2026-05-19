import { NextRequest } from "next/server";
import {
  deriveAttestationShareKey,
  getAttestationStore,
  type PublishedAttestation,
} from "@/lib/authorship-store";
import { parseAttestation } from "@/lib/authorship";
import { requireTier } from "@/lib/tier";

export const runtime = "nodejs";

interface PublishBody {
  attestation: unknown;
}

/**
 * Publish a signed authorship attestation so reviewers / journals can fetch
 * it from a URL we control. The shareKey is derived from the attestation's
 * own hash — re-publishing the same attestation is idempotent.
 *
 * Like ledger publishing, this is gated to Pro+. The free tier can still
 * paste an attestation into /verify/authorship for local verification —
 * only the durable hosted URL is paid.
 */
export async function POST(req: NextRequest) {
  const tierBlock = await requireTier(req, "pro");
  if (tierBlock) return tierBlock;

  let body: PublishBody;
  try {
    body = (await req.json()) as PublishBody;
  } catch {
    return Response.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const attestation = parseAttestation(body.attestation);
  if (!attestation) {
    return Response.json(
      { ok: false, error: "attestation_invalid" },
      { status: 400 },
    );
  }
  const approxSize = JSON.stringify(attestation).length;
  if (approxSize > 524_288) {
    return Response.json(
      { ok: false, error: "attestation_too_large", approxSize },
      { status: 413 },
    );
  }

  const shareKey = deriveAttestationShareKey(attestation.attestationHash);
  const record: PublishedAttestation = {
    shareKey,
    attestation,
    publishedAt: Date.now(),
  };
  await getAttestationStore().put(record);

  return Response.json({
    ok: true,
    shareKey,
    sharePath: `/a/${shareKey}`,
  });
}
