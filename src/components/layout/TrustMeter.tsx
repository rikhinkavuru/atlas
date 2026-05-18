"use client";

import { ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import { useAtlas, activePaper } from "@/lib/store";
import { useProvenanceSummary } from "@/lib/use-provenance-summary";
import { cn } from "@/lib/cn";

// Always-visible moat surface. Shows live sourced %, chain signature status,
// and unsupported-claim count for the active paper. Click → jumps the user
// to the Ledger tab in the left sidebar (where the full timeline lives).
//
// Renders nothing when there's no active paper or the ledger has zero events,
// so it stays out of the way until the user has done something worth signing.
export function TrustMeter() {
  const paper = useAtlas((s) => activePaper(s));
  const ledger = useAtlas((s) => (paper ? s.ledgers[paper.id] : undefined));
  const { summary } = useProvenanceSummary(ledger);

  if (!paper || !ledger || ledger.events.length === 0 || !summary) {
    return null;
  }

  // "Trusted" = author-written + AI-with-sources. Unsourced AI is the only
  // share that doesn't count toward trust. The label below reads "trusted"
  // (not "sourced") so the math matches the wording — author-written content
  // is the most trustworthy of all, and reviewers shouldn't see it discounted.
  const total = Math.max(
    1,
    summary.authorshipBreakdown.author +
      summary.authorshipBreakdown.ai +
      summary.authorshipBreakdown.sourced +
      summary.authorshipBreakdown.imported,
  );
  const trustedPct = Math.round(
    ((summary.authorshipBreakdown.author + summary.authorshipBreakdown.sourced) /
      total) *
      100,
  );

  const sigValid = summary.signature.status === "valid";
  const sigBroken =
    summary.signature.status === "invalid" || summary.integrity === "broken";
  const sigMissing = summary.signature.status === "missing";
  const unsourced = summary.unsourcedClaims;

  function openLedger() {
    // The left sidebar listens for this event to switch to the Ledger tab.
    window.dispatchEvent(new CustomEvent("atlas:open-ledger"));
  }

  return (
    <button
      onClick={openLedger}
      aria-label={
        sigBroken
          ? `Provenance chain broken. ${trustedPct}% trusted, ${unsourced} unsupported claims. Click to investigate.`
          : `${trustedPct}% trusted${sigValid ? ", chain signed" : ", unsigned"}${unsourced > 0 ? `, ${unsourced} unsupported claims` : ""}. Open ledger.`
      }
      className={cn(
        "hidden md:inline-flex items-center gap-1.5 h-7 px-2 rounded-md border text-[11px] font-mono cursor-pointer transition-colors",
        sigBroken
          ? "border-danger/40 bg-danger/5 text-danger hover:border-danger"
          : sigValid
            ? "border-accent/40 bg-accent-soft text-accent hover:border-accent"
            : "border-border bg-surface text-muted hover:text-foreground hover:bg-surface-2",
      )}
      title={
        sigBroken
          ? "Provenance chain is broken — click to investigate"
          : sigValid
            ? `Chain signed · ${ledger.events.length} events`
            : "Provenance ledger has events but no signature — click to view"
      }
    >
      {sigBroken ? (
        <ShieldAlert className="size-3.5" />
      ) : sigValid ? (
        <ShieldCheck className="size-3.5" />
      ) : (
        <ShieldQuestion className="size-3.5" />
      )}
      <span className="tabular-nums">{trustedPct}%</span>
      <span
        className={cn(
          "hidden lg:inline",
          sigBroken
            ? "text-danger/80"
            : sigValid
              ? "text-accent/80"
              : "text-subtle",
        )}
      >
        trusted
      </span>
      {unsourced > 0 && (
        <span
          className={cn(
            "ml-1 px-1 rounded text-[10px] tabular-nums",
            sigBroken ? "bg-danger/15" : "bg-warning/15 text-warning",
          )}
          title={`${unsourced} unsupported claim${unsourced === 1 ? "" : "s"}`}
        >
          {unsourced}
        </span>
      )}
    </button>
  );
}
