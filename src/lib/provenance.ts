import type {
  ProvenanceEvent,
  ProvenanceKind,
  ProvenanceLedger,
  ProvenanceSourceRef,
  ProvenanceSummary,
} from "@/types";
import {
  ensureWorkspaceKey,
  publicKeyFingerprint,
  signMessage,
  verifySignature,
  type PublicKeyJwk,
} from "./crypto";

/** Universal SHA-256 hex digest. Uses Web Crypto in browser, Node crypto on server. */
export async function sha256(input: string): Promise<string> {
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    const buf = await window.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(input),
    );
    return bufToHex(buf);
  }
  // Server / Node
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(input).digest("hex");
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Stable JSON for hashing — sorted keys, no whitespace. Skips inherited /
 *  prototype-polluting keys so a crafted object can't smuggle bytes into the
 *  canonical form. */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(
      ([k, v]) =>
        v !== undefined &&
        k !== "__proto__" &&
        k !== "constructor" &&
        k !== "prototype" &&
        Object.prototype.hasOwnProperty.call(value, k),
    )
    .sort(([a], [b]) => a.localeCompare(b));
  return (
    "{" +
    entries
      .map(([k, v]) => JSON.stringify(k) + ":" + canonicalize(v))
      .join(",") +
    "}"
  );
}

/** Generate or retrieve a stable workspace id (used in the chain root). */
export function getWorkspaceId(): string {
  if (typeof window === "undefined") return "ssr-workspace";
  const KEY = "atlas:workspace-id";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id =
      "ws_" +
      Array.from(window.crypto.getRandomValues(new Uint8Array(8)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    window.localStorage.setItem(KEY, id);
  }
  return id;
}

interface EventInput {
  paperId: string;
  kind: ProvenanceKind;
  actor: ProvenanceEvent["actor"];
  provider?: string;
  model?: string;
  prompt?: string;
  before?: string;
  after?: string;
  sources?: ProvenanceSourceRef[];
  unsupportedClaims?: string[];
  position?: { from: number; to: number };
}

/** Build a hash-chained event from the previous event's hash. */
export async function buildEvent(
  prev: ProvenanceEvent | null,
  input: EventInput,
): Promise<ProvenanceEvent> {
  const id =
    "ev_" +
    Math.random().toString(36).slice(2, 7) +
    "_" +
    Date.now().toString(36);
  const ts = Date.now();
  const prevHash = prev ? prev.hash : null;
  const contentForHash = {
    id,
    timestamp: ts,
    kind: input.kind,
    actor: input.actor,
    provider: input.provider,
    model: input.model,
    prompt: input.prompt,
    before: input.before,
    after: input.after,
    sources: input.sources,
    unsupportedClaims: input.unsupportedClaims,
    position: input.position,
    paperId: input.paperId,
  };
  const hash = await sha256(
    canonicalize({ prev: prevHash, content: contentForHash }),
  );
  return {
    ...contentForHash,
    prev: prevHash,
    hash,
  };
}

/** Recompute the chain and root hash for a ledger; returns whether the chain validates. */
export async function verifyLedger(
  ledger: ProvenanceLedger,
): Promise<{ valid: boolean; brokenAtIndex?: number; rootHash: string }> {
  let prevHash: string | null = null;
  for (let i = 0; i < ledger.events.length; i++) {
    const ev = ledger.events[i];
    const expected = await sha256(
      canonicalize({
        prev: prevHash,
        content: {
          id: ev.id,
          timestamp: ev.timestamp,
          kind: ev.kind,
          actor: ev.actor,
          provider: ev.provider,
          model: ev.model,
          prompt: ev.prompt,
          before: ev.before,
          after: ev.after,
          sources: ev.sources,
          unsupportedClaims: ev.unsupportedClaims,
          position: ev.position,
          paperId: ev.paperId,
        },
      }),
    );
    if (expected !== ev.hash || ev.prev !== prevHash) {
      return { valid: false, brokenAtIndex: i, rootHash: prevHash ?? "" };
    }
    prevHash = ev.hash;
  }
  const rootInput = canonicalize({
    workspaceId: ledger.workspaceId,
    paperId: ledger.paperId,
    last: prevHash,
  });
  const rootHash = await sha256(rootInput);
  return { valid: rootHash === ledger.rootHash, rootHash };
}

/** Compute the root hash for a freshly-built ledger. */
export async function computeRootHash(
  workspaceId: string,
  paperId: string,
  lastHash: string | null,
): Promise<string> {
  return sha256(canonicalize({ workspaceId, paperId, last: lastHash }));
}

/** Sign the ledger's root hash with the workspace key. Returns { signature, publicKey, fingerprint }. */
export async function signRoot(rootHash: string): Promise<{
  signature: string;
  publicKey: PublicKeyJwk;
  fingerprint: string;
}> {
  const { privateKey, publicKey } = await ensureWorkspaceKey();
  const signature = await signMessage(rootHash, privateKey);
  const fingerprint = await publicKeyFingerprint(publicKey);
  return { signature, publicKey, fingerprint };
}

/** Verify the ledger's signature against the embedded public key. */
export async function verifyLedgerSignature(
  ledger: ProvenanceLedger,
): Promise<ProvenanceSummary["signature"]> {
  if (!ledger.signature || !ledger.publicKey) {
    return { status: "missing" };
  }
  const ok = await verifySignature(
    ledger.rootHash,
    ledger.signature,
    ledger.publicKey,
  );
  const fp = ledger.publicKeyFingerprint
    ? ledger.publicKeyFingerprint
    : await publicKeyFingerprint(ledger.publicKey);
  return ok
    ? { status: "valid", fingerprint: fp }
    : { status: "invalid", fingerprint: fp };
}

/** Summarise authorship breakdown + integrity from a ledger. */
export async function summariseLedger(
  ledger: ProvenanceLedger,
): Promise<ProvenanceSummary> {
  const integrity = await verifyLedger(ledger);
  const signature = await verifyLedgerSignature(ledger);
  const stats = {
    totalEvents: ledger.events.length,
    authorEvents: 0,
    aiEvents: 0,
    citeEvents: 0,
    importEvents: 0,
    authoredChars: 0,
    aiEditedChars: 0,
    importedChars: 0,
    sourcedClaims: 0,
    unsourcedClaims: 0,
  };
  for (const e of ledger.events) {
    const len = (e.after ?? "").length;
    if (e.kind === "author") {
      stats.authorEvents++;
      stats.authoredChars += len;
    } else if (e.kind === "ai-edit" || e.kind === "ai-insert") {
      stats.aiEvents++;
      stats.aiEditedChars += len;
      stats.sourcedClaims += (e.sources ?? []).length;
      stats.unsourcedClaims += (e.unsupportedClaims ?? []).length;
    } else if (e.kind === "ai-cite") {
      stats.aiEvents++;
      stats.citeEvents++;
      stats.sourcedClaims += (e.sources ?? []).length;
    } else if (e.kind === "import") {
      stats.importEvents++;
      stats.importedChars += len;
    } else if (e.kind === "review-response") {
      stats.aiEvents++;
      stats.aiEditedChars += len;
    }
  }
  const totalChars = Math.max(
    1,
    stats.authoredChars + stats.aiEditedChars + stats.importedChars,
  );
  // Distinguish sourced AI vs unsourced AI for the breakdown.
  const sourcedAi =
    stats.sourcedClaims > 0
      ? (stats.aiEditedChars * stats.sourcedClaims) /
        Math.max(1, stats.sourcedClaims + stats.unsourcedClaims)
      : 0;
  const unsourcedAi = stats.aiEditedChars - sourcedAi;
  return {
    ...stats,
    authorshipBreakdown: {
      author: stats.authoredChars / totalChars,
      ai: unsourcedAi / totalChars,
      sourced: sourcedAi / totalChars,
      imported: stats.importedChars / totalChars,
    },
    integrity: integrity.valid ? "valid" : "broken",
    brokenAtIndex: integrity.brokenAtIndex,
    signature,
    generatedAt: Date.now(),
  };
}

/** Serialise the ledger as a JSON-LD-style document for embedding alongside the paper. */
export function exportLedgerJsonLd(ledger: ProvenanceLedger) {
  return {
    "@context": "https://atlas.example/schemas/provenance/v1",
    "@type": "AtlasProvenanceLedger",
    paperId: ledger.paperId,
    paperTitle: ledger.paperTitle,
    workspaceId: ledger.workspaceId,
    version: ledger.version,
    createdAt: new Date(ledger.createdAt).toISOString(),
    updatedAt: new Date(ledger.updatedAt).toISOString(),
    rootHash: ledger.rootHash,
    events: ledger.events.map((e) => ({
      "@type": "AtlasProvenanceEvent",
      ...e,
      timestamp: new Date(e.timestamp).toISOString(),
    })),
  };
}

/** Detect that an event was generated by the AI for downstream styling. */
export function isAiEvent(kind: ProvenanceKind): boolean {
  return kind === "ai-edit" || kind === "ai-insert" || kind === "ai-cite" || kind === "review-response";
}
