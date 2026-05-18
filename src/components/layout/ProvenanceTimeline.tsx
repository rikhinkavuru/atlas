"use client";

import { useState } from "react";
import {
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  User,
  Quote,
  Library,
  Download,
  Loader2,
  FileSignature,
  Upload as UploadIcon,
  Inbox,
  ExternalLink,
  Share2,
  Check,
} from "lucide-react";
import { useAtlas, activePaper } from "@/lib/store";
import { exportLedgerJsonLd } from "@/lib/provenance";
import { useProvenanceSummary } from "@/lib/use-provenance-summary";
import { cn } from "@/lib/cn";
import type { ProvenanceEvent, ProvenanceLedger, ProvenanceSummary } from "@/types";

const KIND_LABEL: Record<ProvenanceEvent["kind"], string> = {
  author: "author",
  "ai-edit": "ai edit",
  "ai-insert": "ai insert",
  "ai-cite": "ai cite",
  import: "import",
  comment: "comment",
  "review-response": "review",
};

export function ProvenanceTimeline() {
  const paper = useAtlas((s) => activePaper(s));
  const ledger = useAtlas((s) =>
    paper ? s.ledgers[paper.id] : undefined,
  );
  const recordEvent = useAtlas((s) => s.recordEvent);
  // Shared computation — TrustMeter in the TopBar uses the same hook for the
  // same active-paper ledger, so verification runs once per ledger update.
  const { summary, busy } = useProvenanceSummary(ledger);

  async function recordAuthorPoint() {
    if (!paper) return;
    await recordEvent({
      paperId: paper.id,
      kind: "author",
      actor: { type: "author", label: "You" },
      after: paper.title,
    });
  }

  function downloadLedger() {
    if (!ledger) return;
    const blob = new Blob(
      [JSON.stringify(exportLedgerJsonLd(ledger), null, 2)],
      { type: "application/ld+json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(paper?.title ?? "paper").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.atlas-ledger.jsonld`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (!paper) {
    return (
      <div className="px-2 py-3 text-xs text-subtle">
        Open a paper to see its provenance ledger.
      </div>
    );
  }

  return (
    <div className="p-2 space-y-2">
      <div className="px-2 py-1.5 text-[10px] uppercase tracking-[0.15em] text-subtle flex items-center justify-between">
        <span>Ledger</span>
        {busy && (
          <span className="flex items-center gap-1 text-[10px] normal-case tracking-normal">
            <Loader2 className="size-3 animate-spin" />
            <span>Summarising…</span>
          </span>
        )}
      </div>

      {!ledger || ledger.events.length === 0 ? (
        <div className="px-2 py-3 text-[11.5px] text-muted leading-relaxed space-y-2">
          <div className="text-foreground font-medium">
            Start the chain
          </div>
          <p className="text-subtle">
            Every accepted edit, inserted citation, and reviewer response will
            hash-chain here. Reviewers can verify the chain at /verify.
          </p>
          <button
            onClick={recordAuthorPoint}
            className="btn btn-sm text-[11px] mt-1"
          >
            <FileSignature className="size-3" />
            Record first checkpoint
          </button>
        </div>
      ) : (
        <>
          {summary && (
            <SummaryCard summary={summary} ledgerRoot={ledger.rootHash} />
          )}

          <UnsupportedClaimsList ledger={ledger} />

          <div className="text-[10px] uppercase tracking-[0.15em] text-subtle font-mono px-2 pt-2">
            Chain · {ledger.events.length}
          </div>
          <ol className="space-y-1.5">
            {[...ledger.events].reverse().map((ev) => (
              <EventRow key={ev.id} ev={ev} />
            ))}
          </ol>

          <div className="pt-2 mt-2 border-t border-border flex flex-col gap-1">
            {summary && (
              <ShareBadgeButton
                paperTitle={paper.title}
                summary={summary}
                ledgerRoot={ledger.rootHash}
              />
            )}
            <button
              onClick={downloadLedger}
              className="btn btn-ghost h-7 text-[11px] justify-start"
            >
              <Download className="size-3.5" />
              Export ledger
            </button>
            <a
              href="/verify"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost h-7 text-[11px] justify-start"
            >
              <ExternalLink className="size-3.5" />
              Public verifier
            </a>
          </div>
        </>
      )}
    </div>
  );
}

// Generates a /api/badge URL for the current paper's live stats and offers
// the user a one-click copy (raw URL, Markdown, or HTML) so they can embed
// the Atlas Honesty Badge on arXiv, GitHub, or PDF covers. Turns the moat
// into a portable social signal.
function ShareBadgeButton({
  paperTitle,
  summary,
  ledgerRoot,
}: {
  paperTitle: string;
  summary: ProvenanceSummary;
  ledgerRoot: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<"url" | "md" | "html" | null>(null);
  const [previewError, setPreviewError] = useState(false);

  const total = Math.max(
    1,
    summary.authorshipBreakdown.author +
      summary.authorshipBreakdown.ai +
      summary.authorshipBreakdown.sourced +
      summary.authorshipBreakdown.imported,
  );
  const pct = (n: number) => Math.round((n / total) * 100);

  const params = new URLSearchParams({
    paper: paperTitle.slice(0, 40),
    author: String(pct(summary.authorshipBreakdown.author)),
    sourced: String(pct(summary.authorshipBreakdown.sourced)),
    ai: String(pct(summary.authorshipBreakdown.ai)),
    imported: String(pct(summary.authorshipBreakdown.imported)),
    hash: ledgerRoot.slice(0, 8),
  });
  const url = `/api/badge?${params.toString()}`;
  const verifyUrl = "/verify";

  async function copy(kind: "url" | "md" | "html") {
    const base =
      typeof window !== "undefined" ? window.location.origin : "https://paper-atlas.com";
    const fullUrl = `${base}${url}`;
    const verifyFull = `${base}${verifyUrl}`;
    const md = `[![Atlas Honesty Badge](${fullUrl})](${verifyFull})`;
    const html = `<a href="${verifyFull}"><img src="${fullUrl}" alt="Atlas Honesty Badge" /></a>`;
    const payload = kind === "url" ? fullUrl : kind === "md" ? md : html;
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Older browsers / no clipboard permission — fall back to a textarea
      // selection so the user can manually copy.
      const ta = document.createElement("textarea");
      ta.value = payload;
      ta.style.position = "fixed";
      ta.style.left = "-10000px";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(kind);
        setTimeout(() => setCopied(null), 1500);
      } finally {
        document.body.removeChild(ta);
      }
    }
  }

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn btn-ghost h-7 text-[11px] justify-start w-full"
        aria-expanded={open}
        aria-controls="atlas-share-badge-panel"
        title="Embed a live badge on arXiv, GitHub, or PDF cover"
      >
        <Share2 className="size-3.5" />
        Share badge
      </button>
      {open && (
        <div id="atlas-share-badge-panel" className="mt-1 panel p-2 space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-subtle">
            Preview
          </div>
          {/* Live preview of the actual SVG endpoint — what the embedder sees. */}
          {previewError ? (
            <div className="px-2 py-3 text-[10.5px] text-subtle border border-border rounded text-center">
              Badge preview unavailable. Copy buttons below still work.
            </div>
          ) : (
            <a
              href={verifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block border border-border rounded overflow-hidden hover:border-border-strong transition-colors"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="Atlas Honesty Badge preview"
                className="block w-full"
                onError={() => setPreviewError(true)}
              />
            </a>
          )}
          <div className="grid grid-cols-3 gap-1">
            <CopyBtn label="URL" active={copied === "url"} onClick={() => copy("url")} />
            <CopyBtn label="MD" active={copied === "md"} onClick={() => copy("md")} />
            <CopyBtn label="HTML" active={copied === "html"} onClick={() => copy("html")} />
          </div>
          <p className="text-[10px] text-subtle leading-relaxed">
            Badge updates whenever your ledger changes. Click links back to{" "}
            <span className="font-mono">/verify</span>.
          </p>
        </div>
      )}
    </div>
  );
}

function CopyBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-7 text-[10.5px] rounded border inline-flex items-center justify-center gap-1 transition-colors",
        active
          ? "border-accent text-accent bg-accent-soft"
          : "border-border text-muted hover:text-foreground hover:bg-surface-2",
      )}
    >
      {active ? (
        <>
          <Check className="size-3" />
          Copied
        </>
      ) : (
        <>Copy {label}</>
      )}
    </button>
  );
}

// Surfaces every unsupported claim across the whole ledger as a clickable
// row. Click → scroll editor to the claim text, flash-highlight it, and open
// the agent in Cite mode with the claim pre-filled. Turns the moat from a
// passive score into an actionable TODO list.
function UnsupportedClaimsList({ ledger }: { ledger: ProvenanceLedger }) {
  const [expanded, setExpanded] = useState(false);
  const items: { claim: string; eventId: string }[] = [];
  for (const ev of ledger.events) {
    for (const c of ev.unsupportedClaims ?? []) {
      // Dedupe — the agent sometimes flags the same claim across consecutive
      // edits. Keep the first occurrence.
      if (!items.some((x) => x.claim === c)) {
        items.push({ claim: c, eventId: ev.id });
      }
    }
  }
  if (items.length === 0) return null;

  function jumpToClaim(claim: string) {
    const editor = (window as unknown as { __atlasEditor?: { commands: { focus: () => void }; view: { dom: HTMLElement }; state: { doc: { textContent: string } } } }).__atlasEditor;
    if (!editor) return;
    // Find the claim in the editor's text and scroll to it. We rely on the
    // DOM lookup because ProseMirror positions are doc-local and harder to
    // map from a raw string; the user just needs to see it in context.
    const dom = editor.view.dom;
    const walker = document.createTreeWalker(dom, NodeFilter.SHOW_TEXT);
    const needle = claim.toLowerCase();
    let node: Node | null = walker.nextNode();
    while (node) {
      const text = (node.textContent ?? "").toLowerCase();
      if (text.includes(needle.slice(0, Math.min(40, needle.length)))) {
        const el = node.parentElement;
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        if (el) {
          const old = el.style.boxShadow;
          el.style.transition = "box-shadow 0.4s ease";
          el.style.boxShadow = "0 0 0 2px var(--color-warning)";
          setTimeout(() => {
            el.style.boxShadow = old;
          }, 1800);
        }
        break;
      }
      node = walker.nextNode();
    }
    // Open the agent in Cite mode and pre-fill the input with the claim.
    window.dispatchEvent(
      new CustomEvent("atlas:cite-claim", { detail: { claim } }),
    );
  }

  const shown = expanded ? items : items.slice(0, 3);
  return (
    <div className="panel p-2 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <ShieldAlert className="size-3 text-warning shrink-0" />
        <div className="text-[10px] uppercase tracking-[0.15em] text-warning font-mono">
          Unsupported · {items.length}
        </div>
        {items.length > 3 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="ml-auto text-[10px] text-subtle hover:text-foreground"
          >
            {expanded ? "Show top 3" : `Show all ${items.length}`}
          </button>
        )}
      </div>
      <ul className="space-y-1">
        {shown.map((it, i) => (
          <li key={i}>
            <button
              onClick={() => jumpToClaim(it.claim)}
              className="w-full text-left px-2 py-1.5 rounded border border-border bg-surface hover:bg-surface-2 hover:border-warning/40 transition-colors group"
              title="Jump to this claim and open Cite mode"
            >
              <div className="text-[11px] text-foreground/85 italic leading-snug line-clamp-2">
                &ldquo;{it.claim}&rdquo;
              </div>
              <div className="text-[9.5px] text-subtle mt-1 flex items-center gap-1 group-hover:text-warning">
                <Sparkles className="size-2.5" />
                Find a citation
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SummaryCard({
  summary,
  ledgerRoot,
}: {
  summary: ProvenanceSummary;
  ledgerRoot: string;
}) {
  const total = Math.max(
    1,
    summary.authorshipBreakdown.author +
      summary.authorshipBreakdown.ai +
      summary.authorshipBreakdown.sourced +
      summary.authorshipBreakdown.imported,
  );
  const pct = (n: number) => Math.round((n / total) * 100);
  return (
    <div className="panel p-2.5 space-y-2">
      <div className="text-[10px] font-mono uppercase tracking-[0.12em] space-y-1">
        {summary.integrity === "valid" ? (
          <div className="text-accent flex items-center gap-1">
            <ShieldCheck className="size-2.5 shrink-0" />
            <span>chain intact</span>
          </div>
        ) : (
          <div className="text-danger flex items-center gap-1">
            <ShieldAlert className="size-2.5 shrink-0" />
            <span>broken @ {summary.brokenAtIndex}</span>
          </div>
        )}
        {summary.signature.status === "valid" && (
          <div className="text-accent flex items-center gap-1">
            <ShieldCheck className="size-2.5 shrink-0" />
            <span>signature ok</span>
            <span className="ml-auto text-subtle font-normal">
              {summary.signature.fingerprint}
            </span>
          </div>
        )}
        {summary.signature.status === "invalid" && (
          <div className="text-danger flex items-center gap-1">
            <ShieldAlert className="size-2.5 shrink-0" />
            <span>signature mismatch</span>
          </div>
        )}
        {summary.signature.status === "missing" && (
          <div className="text-subtle flex items-center gap-1 font-normal">
            <span>unsigned</span>
          </div>
        )}
        <div
          className="text-subtle truncate font-normal"
          title={ledgerRoot}
        >
          root · {ledgerRoot.slice(0, 16)}…
        </div>
      </div>
      <div className="flex w-full h-1.5 rounded-full overflow-hidden bg-surface-3">
        <span
          style={{ width: `${pct(summary.authorshipBreakdown.author)}%` }}
          className="bg-foreground"
        />
        <span
          style={{ width: `${pct(summary.authorshipBreakdown.sourced)}%` }}
          className="bg-accent"
        />
        <span
          style={{ width: `${pct(summary.authorshipBreakdown.ai)}%` }}
          className="bg-info"
        />
        <span
          style={{ width: `${pct(summary.authorshipBreakdown.imported)}%` }}
          className="bg-warning"
        />
      </div>
      <ul className="space-y-0.5 text-[10.5px]">
        <LegendRow
          color="bg-foreground"
          label="Author"
          value={`${pct(summary.authorshipBreakdown.author)}%`}
        />
        <LegendRow
          color="bg-accent"
          label="Sourced"
          value={`${pct(summary.authorshipBreakdown.sourced)}%`}
        />
        <LegendRow
          color="bg-info"
          label="Unsourced"
          value={`${pct(summary.authorshipBreakdown.ai)}%`}
        />
        <LegendRow
          color="bg-warning"
          label="Imported"
          value={`${pct(summary.authorshipBreakdown.imported)}%`}
        />
      </ul>
      {summary.unsourcedClaims > 0 && (
        <div className="text-[10.5px] text-warning flex items-start gap-1 leading-snug">
          <ShieldAlert className="size-2.5 mt-0.5 shrink-0" />
          <span>
            {summary.unsourcedClaims} unsourced claim
            {summary.unsourcedClaims === 1 ? "" : "s"}
          </span>
        </div>
      )}
    </div>
  );
}

function LegendRow({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <li className="flex items-center gap-1.5 whitespace-nowrap">
      <span className={cn("size-2 rounded-sm shrink-0", color)} />
      <span className="text-muted truncate">{label}</span>
      <span className="ml-auto font-mono text-foreground shrink-0">
        {value}
      </span>
    </li>
  );
}

function EventRow({ ev }: { ev: ProvenanceEvent }) {
  const icon = iconFor(ev.kind);
  const time = new Date(ev.timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <li className="panel p-2 text-[11px] space-y-1">
      <div className="flex items-center gap-1.5 text-[10px]">
        <span
          className={cn(
            "inline-flex size-4 rounded items-center justify-center shrink-0",
            ev.actor.type === "ai"
              ? "bg-accent-soft text-accent border border-[#2d3d12]"
              : ev.actor.type === "import"
                ? "bg-warning/15 text-warning border border-warning/30"
                : "bg-surface-2 text-foreground border border-border",
          )}
        >
          {icon}
        </span>
        <span className="text-foreground font-medium whitespace-nowrap">
          {KIND_LABEL[ev.kind] ?? ev.kind}
        </span>
        <span className="ml-auto text-subtle font-mono whitespace-nowrap">
          {time}
        </span>
      </div>
      <div className="text-[10.5px] text-muted truncate" title={ev.actor.label}>
        {ev.actor.label}
        {ev.model ? ` · ${ev.model.replace("claude-", "").replace("gpt-", "")}` : ""}
      </div>
      {ev.after && (
        <div className="text-foreground/85 line-clamp-2 italic leading-snug">
          &ldquo;{ev.after.slice(0, 140)}
          {ev.after.length > 140 ? "…" : ""}&rdquo;
        </div>
      )}
      <div className="flex items-center gap-2 text-[10.5px]">
        {ev.sources && ev.sources.length > 0 && (
          <span className="text-accent flex items-center gap-1">
            <ShieldCheck className="size-2.5" />
            {ev.sources.length}
          </span>
        )}
        {ev.unsupportedClaims && ev.unsupportedClaims.length > 0 && (
          <span className="text-warning flex items-center gap-1">
            <ShieldAlert className="size-2.5" />
            {ev.unsupportedClaims.length}
          </span>
        )}
        <span
          className="ml-auto font-mono text-subtle text-[9.5px] truncate"
          title={ev.hash}
        >
          {ev.hash.slice(0, 10)}…
        </span>
      </div>
    </li>
  );
}

function iconFor(kind: ProvenanceEvent["kind"]) {
  if (kind === "ai-edit" || kind === "ai-insert") {
    return <Sparkles className="size-2.5" />;
  }
  if (kind === "ai-cite") return <Library className="size-2.5" />;
  if (kind === "import") return <UploadIcon className="size-2.5" />;
  if (kind === "comment") return <Quote className="size-2.5" />;
  if (kind === "review-response") return <Inbox className="size-2.5" />;
  return <User className="size-2.5" />;
}
