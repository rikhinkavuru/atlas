import { promises as fs } from "node:fs";
import path from "node:path";
import type { ProvenanceLedger } from "@/types";

/**
 * Pluggable storage for published ledgers.
 *
 * The product promise — "reviewers can verify the ledger" — only works if the
 * ledger exists somewhere a reviewer can reach. localStorage is per-author.
 *
 * Three backends, selected by env at runtime:
 *   - BlobStore  — Vercel Blob (durable, scales, recommended for prod).
 *                  Activated automatically when BLOB_READ_WRITE_TOKEN is set.
 *   - FsStore    — One file per shareKey on local disk (dev default).
 *                  Survives `next dev` restarts. Lossy on Vercel because
 *                  /tmp is per-instance.
 *   - MemoryStore — Process-local Map. Only used when LEDGER_STORE=memory.
 *
 * Override the selection by setting LEDGER_STORE=blob|fs|memory.
 */

export interface PublishedLedger {
  shareKey: string;
  /** Atlas paper title at the moment of publishing (denormalised for display). */
  paperTitle: string;
  ledger: ProvenanceLedger;
  publishedAt: number;
}

export interface LedgerStore {
  put(record: PublishedLedger): Promise<void>;
  get(shareKey: string): Promise<PublishedLedger | null>;
}

class MemoryStore implements LedgerStore {
  private map = new Map<string, PublishedLedger>();
  async put(record: PublishedLedger) {
    this.map.set(record.shareKey, record);
  }
  async get(shareKey: string) {
    return this.map.get(shareKey) ?? null;
  }
}

class FsStore implements LedgerStore {
  constructor(private dir: string) {}
  private fp(shareKey: string) {
    // Restrict to hex/base36 chars only — never trust the URL path to be safe.
    if (!/^[a-zA-Z0-9_-]+$/.test(shareKey)) throw new Error("bad shareKey");
    return path.join(this.dir, `${shareKey}.json`);
  }
  async put(record: PublishedLedger) {
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(this.fp(record.shareKey), JSON.stringify(record));
  }
  async get(shareKey: string) {
    try {
      const raw = await fs.readFile(this.fp(shareKey), "utf-8");
      return JSON.parse(raw) as PublishedLedger;
    } catch {
      return null;
    }
  }
}

class BlobStore implements LedgerStore {
  // We pin the prefix so multiple unrelated environments can share a token
  // without colliding. The prefix doubles as a filter for cleanup tooling.
  private prefix = "atlas-ledgers/";

  private blobPath(shareKey: string): string {
    if (!/^[a-zA-Z0-9_-]+$/.test(shareKey)) throw new Error("bad shareKey");
    return `${this.prefix}${shareKey}.json`;
  }

  async put(record: PublishedLedger): Promise<void> {
    // Dynamic import keeps @vercel/blob out of the bundle when the store is
    // unused (the FsStore + MemoryStore paths don't need it).
    const { put } = await import("@vercel/blob");
    await put(this.blobPath(record.shareKey), JSON.stringify(record), {
      access: "public",
      // Use a fixed pathname rather than the random suffix the SDK adds by
      // default — the rootHash-derived shareKey IS our identifier.
      addRandomSuffix: false,
      contentType: "application/json",
      // The published record is immutable for a given shareKey; long cache.
      cacheControlMaxAge: 60 * 60 * 24 * 365,
      allowOverwrite: true,
    });
  }

  async get(shareKey: string): Promise<PublishedLedger | null> {
    if (!/^[a-zA-Z0-9_-]+$/.test(shareKey)) return null;
    const { head } = await import("@vercel/blob");
    try {
      // head() returns the metadata including the public URL we can fetch.
      const meta = await head(this.blobPath(shareKey));
      if (!meta?.url) return null;
      const r = await fetch(meta.url, { cache: "no-store" });
      if (!r.ok) return null;
      const raw = await r.text();
      return JSON.parse(raw) as PublishedLedger;
    } catch {
      // head() throws on missing blob — treat as not found.
      return null;
    }
  }
}

// Cross-invocation singleton (within a process). Vercel serverless invocations
// share this only within the same warm instance, so MemoryStore is a soft
// cache, not durable storage. FsStore in /tmp is similarly per-instance.
declare global {
  // eslint-disable-next-line no-var
  var __atlasLedgerStore: LedgerStore | undefined;
}

function pickBackend(): "blob" | "fs" | "memory" {
  const override = process.env.LEDGER_STORE?.toLowerCase();
  if (override === "blob" || override === "fs" || override === "memory") {
    return override;
  }
  // Auto-detect: Blob if the token is wired, otherwise FsStore. We never
  // silently default to memory in prod — a misconfigured deploy would lose
  // every publish without a warning otherwise.
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  return "fs";
}

export function getStore(): LedgerStore {
  if (globalThis.__atlasLedgerStore) return globalThis.__atlasLedgerStore;
  const backend = pickBackend();
  // /tmp on Vercel is writable; in local dev we use a project-relative path so
  // the data survives `next dev` restarts.
  const dir =
    process.env.LEDGER_STORE_DIR ||
    (process.env.VERCEL ? "/tmp/atlas-shares" : ".atlas-shares");
  const store: LedgerStore =
    backend === "blob"
      ? new BlobStore()
      : backend === "memory"
        ? new MemoryStore()
        : new FsStore(dir);
  globalThis.__atlasLedgerStore = store;
  return store;
}

export function ledgerBackend(): "blob" | "fs" | "memory" {
  return pickBackend();
}

/** Derive a short, human-friendlier share key from the ledger's rootHash. We
 * use the first 12 hex chars — enough for ~16 bits of collision resistance
 * across an Atlas-sized corpus, short enough to share in chat. */
export function deriveShareKey(rootHash: string): string {
  const hex = rootHash.replace(/[^a-fA-F0-9]/g, "");
  return hex.slice(0, 12) || rootHash.slice(0, 12);
}
