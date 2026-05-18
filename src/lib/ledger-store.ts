import { promises as fs } from "node:fs";
import path from "node:path";
import type { ProvenanceLedger } from "@/types";

/**
 * Pluggable storage for published ledgers.
 *
 * The product promise — "reviewers can verify the ledger" — only works if the
 * ledger exists somewhere a reviewer can reach. localStorage is per-author.
 *
 * Two implementations ship today:
 *   - MemoryStore: a process-local Map. Works in dev and during a single
 *     serverless invocation. Lossy across deploys; fine for previews.
 *   - FsStore: writes one file per shareKey under .atlas-shares/. Works in
 *     local dev and in any Node environment with a writable `/tmp`. Vercel
 *     functions can use this only with /tmp, which is per-instance.
 *
 * For production durability the hand-off is to a real KV/Blob store — wire
 * Vercel Blob or Vercel KV by replacing `getStore()` with one of those
 * adapters. The API + viewer don't change.
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

// Cross-invocation singleton (within a process). Vercel serverless invocations
// share this only within the same warm instance, so MemoryStore is a soft
// cache, not durable storage. FsStore in /tmp is similarly per-instance.
declare global {
  // eslint-disable-next-line no-var
  var __atlasLedgerStore: LedgerStore | undefined;
}

export function getStore(): LedgerStore {
  if (globalThis.__atlasLedgerStore) return globalThis.__atlasLedgerStore;
  const backend = process.env.LEDGER_STORE ?? "fs";
  // /tmp on Vercel is writable; in local dev we use a project-relative path so
  // the data survives `next dev` restarts.
  const dir =
    process.env.LEDGER_STORE_DIR ||
    (process.env.VERCEL ? "/tmp/atlas-shares" : ".atlas-shares");
  const store: LedgerStore =
    backend === "memory" ? new MemoryStore() : new FsStore(dir);
  globalThis.__atlasLedgerStore = store;
  return store;
}

/** Derive a short, human-friendlier share key from the ledger's rootHash. We
 * use the first 12 hex chars — enough for ~16 bits of collision resistance
 * across an Atlas-sized corpus, short enough to share in chat. */
export function deriveShareKey(rootHash: string): string {
  const hex = rootHash.replace(/[^a-fA-F0-9]/g, "");
  return hex.slice(0, 12) || rootHash.slice(0, 12);
}
