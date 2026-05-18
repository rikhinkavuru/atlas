"use client";

import { useState } from "react";
import {
  ReportHeader,
  AuthorshipChart,
  BadgeEmbed,
  ChainTimeline,
  type Report,
} from "@/app/verify/VerifyClient";
import type { PublishedLedger } from "@/lib/ledger-store";

/**
 * Renders the same four-section ledger view as /verify, but starts from a
 * server-fetched record rather than a pasted file. We thread a stable
 * canonical URL through so the Copy-link affordance points at the real page.
 */
export function PublicLedgerView({
  record,
  summary,
  canonical,
}: {
  record: PublishedLedger;
  summary: Report["summary"];
  canonical: string;
}) {
  const [copied, setCopied] = useState(false);
  const report: Report = { ledger: record.ledger, summary };

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(canonical);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  return (
    <div className="mt-10 space-y-6">
      <ReportHeader report={report} copied={copied} onCopy={copyShareLink} />
      <AuthorshipChart report={report} />
      <BadgeEmbed report={report} />
      <ChainTimeline report={report} />
    </div>
  );
}
