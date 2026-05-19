import { promises as fs } from "node:fs";
import path from "node:path";
import type { AuthorshipAttestation } from "./authorship";

/**
 * Parallel storage layer for published authorship attestations.
 *
 * Same backend strategy as ledger-store (BlobStore → FsStore → MemoryStore)
 * but with its own prefix so a single Blob token can host both artifacts
 * without collision and a single LEDGER_STORE_DIR can hold both kinds of
 * file. We intentionally do NOT reuse ledger-store's store object: the
 * artifact types differ, and inlining the duplication keeps both stores
 * independently auditable (an authorship publish never mutates the
 * ledger store, by construction).
 */

export interface PublishedAttestation {
  shareKey: string;
  attestation: AuthorshipAttestation;
  publishedAt: number;
}

export interface AttestationStore {
  put(record: PublishedAttestation): Promise<void>;
  get(shareKey: string): Promise<PublishedAttestation | null>;
}

class MemoryStore implements AttestationStore {
  private map = new Map<string, PublishedAttestation>();
  async put(record: PublishedAttestation) {
    this.map.set(record.shareKey, record);
  }
  async get(shareKey: string) {
    return this.map.get(shareKey) ?? null;
  }
}

class FsStore implements AttestationStore {
  constructor(private dir: string) {}
  private fp(shareKey: string) {
    if (!/^[a-zA-Z0-9_-]+$/.test(shareKey)) throw new Error("bad shareKey");
    return path.join(this.dir, `${shareKey}.json`);
  }
  async put(record: PublishedAttestation) {
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(this.fp(record.shareKey), JSON.stringify(record));
  }
  async get(shareKey: string) {
    try {
      const raw = await fs.readFile(this.fp(shareKey), "utf-8");
      return JSON.parse(raw) as PublishedAttestation;
    } catch {
      return null;
    }
  }
}

class BlobStore implements AttestationStore {
  // Distinct prefix from ledger-store to keep the two stores from
  // colliding even when they share a token.
  private prefix = "atlas-authorship/";

  private blobPath(shareKey: string): string {
    if (!/^[a-zA-Z0-9_-]+$/.test(shareKey)) throw new Error("bad shareKey");
    return `${this.prefix}${shareKey}.json`;
  }

  async put(record: PublishedAttestation): Promise<void> {
    const { put } = await import("@vercel/blob");
    await put(this.blobPath(record.shareKey), JSON.stringify(record), {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
      cacheControlMaxAge: 60 * 60 * 24 * 365,
      allowOverwrite: true,
    });
  }

  async get(shareKey: string): Promise<PublishedAttestation | null> {
    if (!/^[a-zA-Z0-9_-]+$/.test(shareKey)) return null;
    const { head } = await import("@vercel/blob");
    try {
      const meta = await head(this.blobPath(shareKey));
      if (!meta?.url) return null;
      const r = await fetch(meta.url, { cache: "no-store" });
      if (!r.ok) return null;
      const raw = await r.text();
      return JSON.parse(raw) as PublishedAttestation;
    } catch {
      return null;
    }
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __atlasAttestationStore: AttestationStore | undefined;
}

function pickBackend(): "blob" | "fs" | "memory" {
  const override = process.env.LEDGER_STORE?.toLowerCase();
  if (override === "blob" || override === "fs" || override === "memory") {
    return override;
  }
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  return "fs";
}

export function getAttestationStore(): AttestationStore {
  if (globalThis.__atlasAttestationStore) {
    return globalThis.__atlasAttestationStore;
  }
  const backend = pickBackend();
  const dir =
    process.env.LEDGER_STORE_DIR ||
    (process.env.VERCEL ? "/tmp/atlas-attestations" : ".atlas-attestations");
  const store: AttestationStore =
    backend === "blob"
      ? new BlobStore()
      : backend === "memory"
        ? new MemoryStore()
        : new FsStore(dir);
  globalThis.__atlasAttestationStore = store;
  return store;
}

/** Derive a short share key from the attestation hash. Mirrors the
 *  ledger-store derivation so URLs look consistent. */
export function deriveAttestationShareKey(attestationHash: string): string {
  const hex = attestationHash.replace(/[^a-fA-F0-9]/g, "");
  return hex.slice(0, 12) || attestationHash.slice(0, 12);
}
