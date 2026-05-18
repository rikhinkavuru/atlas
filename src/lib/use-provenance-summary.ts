"use client";

import { useEffect, useState } from "react";
import type { ProvenanceLedger, ProvenanceSummary } from "@/types";
import { summariseLedger } from "./provenance";

// Module-level cache so two components watching the same ledger (currently
// TrustMeter in TopBar and ProvenanceTimeline in LeftSidebar) don't each
// trigger their own Web-Crypto verification pass.
//
// Keyed on rootHash + updatedAt — both change whenever the ledger gets a new
// event, so cache invalidation is automatic. The map holds at most a few
// entries (one per open paper) so unbounded growth isn't a concern.
const summaryCache = new Map<
  string,
  { promise: Promise<ProvenanceSummary>; summary?: ProvenanceSummary }
>();

function cacheKey(l: ProvenanceLedger): string {
  return `${l.rootHash}:${l.updatedAt}`;
}

async function getOrComputeSummary(
  ledger: ProvenanceLedger,
): Promise<ProvenanceSummary> {
  const key = cacheKey(ledger);
  const hit = summaryCache.get(key);
  if (hit) return hit.promise;
  const promise = summariseLedger(ledger);
  summaryCache.set(key, { promise });
  const summary = await promise;
  summaryCache.set(key, { promise, summary });
  return summary;
}

// Computes a ProvenanceSummary for the given ledger. Async because
// summariseLedger verifies hash-chain integrity + signature with Web Crypto.
// Returns null while computing or when no ledger is present.
//
// Shared by ProvenanceTimeline (sidebar) and TrustMeter (top bar) so the
// expensive verification only runs once per ledger update.
export function useProvenanceSummary(
  ledger: ProvenanceLedger | undefined,
): { summary: ProvenanceSummary | null; busy: boolean } {
  const [summary, setSummary] = useState<ProvenanceSummary | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ledger) {
      setSummary(null);
      setBusy(false);
      return;
    }
    // Synchronous cache hit — no busy flash.
    const hit = summaryCache.get(cacheKey(ledger));
    if (hit?.summary) {
      setSummary(hit.summary);
      setBusy(false);
      return;
    }
    let cancelled = false;
    setBusy(true);
    getOrComputeSummary(ledger).then((s) => {
      if (cancelled) return;
      setSummary(s);
      setBusy(false);
    });
    return () => {
      cancelled = true;
    };
  }, [ledger]);

  return { summary, busy };
}
