"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileSignature,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Copy,
  Check,
  Sparkles,
  User,
  Library,
  Inbox,
  Quote,
  Code2,
  ExternalLink,
  PlayCircle,
} from "lucide-react";
import { summariseLedger } from "@/lib/provenance";
import type { ProvenanceEvent, ProvenanceLedger, ProvenanceSummary } from "@/types";
import { cn } from "@/lib/cn";

export interface Report {
  ledger: ProvenanceLedger;
  summary: ProvenanceSummary;
}

export function VerifyClient() {
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paste, setPaste] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState(false);

  async function ingest(raw: string) {
    setBusy(true);
    setError(null);
    try {
      const parsed = JSON.parse(raw);
      const ledger: ProvenanceLedger = "events" in parsed ? parsed : parsed.ledger;
      if (!ledger?.events || !Array.isArray(ledger.events)) {
        throw new Error(
          "That doesn't look like an Atlas ledger. Expected { paperId, events, rootHash, version }.",
        );
      }
      const summary = await summariseLedger(ledger);
      setReport({ ledger, summary });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(file: File) {
    const text = await file.text();
    await ingest(text);
  }

  async function loadSample() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/sample-ledger");
      if (!r.ok) throw new Error(`sample API returned ${r.status}`);
      const { ledger } = (await r.json()) as { ledger: ProvenanceLedger };
      const summary = await summariseLedger(ledger);
      setReport({ ledger, summary });
      setPaste(JSON.stringify({ ledger }, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function copyShareLink() {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="mt-12 space-y-8">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        className={cn(
          "panel rounded-2xl p-8 border-2 border-dashed transition-colors",
          dragOver
            ? "border-accent bg-accent-soft/30"
            : "border-border bg-surface/60",
        )}
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="size-9 rounded-md bg-accent-soft border border-[#2d3d12] flex items-center justify-center text-accent">
            <FileSignature className="size-5" />
          </div>
          <div>
            <div className="text-[14px] font-semibold text-foreground">
              Drop the ledger file
            </div>
            <div className="text-[12px] text-subtle">
              <code className="font-mono">.atlas-ledger.jsonld</code> or paste
              the JSON below
            </div>
          </div>
          <button
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".jsonld,.json,application/ld+json,application/json";
              input.onchange = () => {
                const f = input.files?.[0];
                if (f) handleFile(f);
              };
              input.click();
            }}
            className="ml-auto btn h-9 text-[12px]"
          >
            <Upload className="size-3.5" />
            Choose file
          </button>
        </div>
        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder={`Paste the contents of the .atlas-ledger.jsonld file here…`}
          rows={5}
          className="w-full bg-background border border-border rounded-md p-3 text-[12px] font-mono placeholder:text-subtle focus:outline-none focus:border-border-strong resize-none"
        />
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-subtle">
            {paste.length.toLocaleString()} chars
          </span>
          <button
            onClick={loadSample}
            disabled={busy}
            className="btn btn-ghost h-8 text-[12px] text-muted ml-auto disabled:opacity-40"
          >
            <PlayCircle className="size-3.5" />
            Try a sample ledger
          </button>
          <button
            onClick={() => ingest(paste)}
            disabled={!paste.trim() || busy}
            className="btn btn-primary h-8 text-[12px] disabled:opacity-40"
          >
            {busy ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Verifying
              </>
            ) : (
              <>
                <ShieldCheck className="size-3.5" /> Verify
              </>
            )}
          </button>
        </div>
        {error && (
          <div className="mt-3 text-[11.5px] text-warning bg-warning/5 border border-warning/40 rounded p-2 font-mono">
            {error}
          </div>
        )}
      </div>

      <AnimatePresence>
        {report && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >
            <ReportHeader
              report={report}
              copied={copied}
              onCopy={copyShareLink}
            />
            <AuthorshipChart report={report} />
            <BadgeEmbed report={report} />
            <ChainTimeline report={report} />
          </motion.div>
        )}
      </AnimatePresence>

      {!report && !busy && (
        <HowItWorks />
      )}
    </div>
  );
}

export function ReportHeader({
  report,
  copied,
  onCopy,
}: {
  report: Report;
  copied: boolean;
  onCopy: () => void;
}) {
  const valid = report.summary.integrity === "valid";
  const sig = report.summary.signature;
  return (
    <div className="panel rounded-xl overflow-hidden">
      <div
        className={cn(
          "px-5 py-3 flex items-center gap-3 border-b border-border",
          valid ? "bg-accent-soft/30" : "bg-danger/5",
        )}
      >
        <div
          className={cn(
            "size-9 rounded-md flex items-center justify-center border",
            valid
              ? "text-accent bg-accent-soft border-[#2d3d12]"
              : "text-danger bg-danger/10 border-danger/40",
          )}
        >
          {valid ? (
            <ShieldCheck className="size-5" />
          ) : (
            <ShieldAlert className="size-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-foreground truncate">
            {report.ledger.paperTitle}
          </div>
          <div className="text-[11px] font-mono text-subtle truncate">
            paperId · {report.ledger.paperId}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div
            className={cn(
              "text-[10.5px] font-mono uppercase tracking-[0.15em]",
              valid ? "text-accent" : "text-danger",
            )}
          >
            {valid
              ? "chain intact"
              : `chain broken @ ${report.summary.brokenAtIndex}`}
          </div>
          <div
            className={cn(
              "text-[10.5px] font-mono uppercase tracking-[0.15em]",
              sig.status === "valid"
                ? "text-accent"
                : sig.status === "invalid"
                  ? "text-danger"
                  : "text-subtle",
            )}
          >
            {sig.status === "valid" && `signature ok · ${sig.fingerprint}`}
            {sig.status === "invalid" && "signature mismatch"}
            {sig.status === "missing" && "unsigned"}
          </div>
        </div>
        <button
          onClick={onCopy}
          className="btn btn-ghost h-7 text-[11px] text-muted"
          title="Copy share link"
        >
          {copied ? (
            <Check className="size-3.5 text-accent" />
          ) : (
            <Copy className="size-3.5" />
          )}
          {copied ? "Copied" : "Share"}
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5">
        <Stat label="Events" value={String(report.summary.totalEvents)} />
        <Stat
          label="AI events"
          value={String(report.summary.aiEvents)}
          accent
        />
        <Stat
          label="Sourced claims"
          value={String(report.summary.sourcedClaims)}
          accent
        />
        <Stat
          label="Unsourced"
          value={String(report.summary.unsourcedClaims)}
          warn={report.summary.unsourcedClaims > 0}
        />
      </div>
      <div className="px-5 pb-4 text-[10.5px] font-mono text-subtle break-all">
        rootHash · {report.ledger.rootHash}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  warn,
}: {
  label: string;
  value: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.15em] text-subtle font-mono mb-1">
        {label}
      </div>
      <div
        className={cn(
          "text-[22px] font-semibold tracking-tight",
          accent ? "text-accent" : warn ? "text-warning" : "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function AuthorshipChart({ report }: { report: Report }) {
  const b = report.summary.authorshipBreakdown;
  const total = b.author + b.ai + b.sourced + b.imported || 1;
  const seg = (n: number) => `${Math.round((n / total) * 100)}%`;
  return (
    <div className="panel p-5 rounded-xl">
      <div className="text-[10px] uppercase tracking-[0.15em] text-subtle font-mono mb-3">
        Authorship breakdown
      </div>
      <div className="h-3 rounded-full bg-surface-3 overflow-hidden flex">
        <motion.span
          initial={{ width: 0 }}
          animate={{ width: seg(b.author) }}
          transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
          className="bg-foreground"
          title="Author"
        />
        <motion.span
          initial={{ width: 0 }}
          animate={{ width: seg(b.sourced) }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="bg-accent"
          title="AI · sourced"
        />
        <motion.span
          initial={{ width: 0 }}
          animate={{ width: seg(b.ai) }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="bg-info"
          title="AI · unsourced"
        />
        <motion.span
          initial={{ width: 0 }}
          animate={{ width: seg(b.imported) }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="bg-warning"
          title="Imported"
        />
      </div>
      <ul className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">
        <Legend color="bg-foreground" label="Author" value={seg(b.author)} />
        <Legend color="bg-accent" label="AI · sourced" value={seg(b.sourced)} />
        <Legend color="bg-info" label="AI · unsourced" value={seg(b.ai)} />
        <Legend color="bg-warning" label="Imported" value={seg(b.imported)} />
      </ul>
    </div>
  );
}

function Legend({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <li className="flex items-center gap-2">
      <span className={cn("size-2.5 rounded-sm", color)} />
      <span className="text-muted">{label}</span>
      <span className="ml-auto font-mono text-foreground">{value}</span>
    </li>
  );
}

export function BadgeEmbed({ report }: { report: Report }) {
  const { ledger, summary } = report;
  const params = useMemo(() => {
    const b = summary.authorshipBreakdown;
    const total = Math.max(0.0001, b.author + b.ai + b.sourced + b.imported);
    const pct = (n: number) =>
      Math.round((n / total) * 100).toString();
    const q = new URLSearchParams({
      author: pct(b.author),
      sourced: pct(b.sourced),
      ai: pct(b.ai),
      imported: pct(b.imported),
      paper: ledger.paperTitle.slice(0, 40),
      hash: ledger.rootHash.slice(0, 14),
    });
    return q.toString();
  }, [ledger, summary]);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://atlas.app";
  const badgeUrl = `${origin}/api/badge?${params}`;
  const verifyUrl = `${origin}/verify`;

  const markdown = `[![Atlas Honesty Badge](${badgeUrl})](${verifyUrl})`;
  const html = `<a href="${verifyUrl}"><img src="${badgeUrl}" alt="Atlas Honesty Badge" width="640" /></a>`;
  const arxiv = `AI disclosure verified by Atlas — see ${badgeUrl}`;

  const [copied, setCopied] = useState<string | null>(null);
  function copy(text: string, kind: string) {
    if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    }
  }

  return (
    <div className="panel rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center gap-2">
        <div className="size-7 rounded-md bg-accent-soft border border-[#2d3d12] flex items-center justify-center text-accent">
          <ShieldCheck className="size-4" />
        </div>
        <div>
          <div className="text-[13px] font-semibold text-foreground">
            Atlas Honesty Badge
          </div>
          <div className="text-[10.5px] font-mono uppercase tracking-[0.15em] text-subtle">
            embeddable · verified · public
          </div>
        </div>
        <a
          href={badgeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto btn btn-ghost h-7 text-[11px] text-muted"
        >
          <ExternalLink className="size-3.5" />
          Open SVG
        </a>
      </div>
      <div className="p-5 space-y-4">
        <div className="rounded-lg border border-border bg-background p-4 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={badgeUrl}
            alt="Atlas Honesty Badge"
            width={640}
            height={88}
            className="max-w-full"
          />
        </div>
        <p className="text-[12px] text-muted leading-relaxed">
          Paste the snippet below into your arXiv comments, README, blog post,
          or the bottom of your preprint PDF. The image is regenerated each
          time it loads from the percentages and root hash above — reviewers
          can click through to the public verifier.
        </p>
        <div className="grid sm:grid-cols-3 gap-2 text-[11.5px]">
          <SnippetCard
            label="Markdown"
            snippet={markdown}
            copied={copied === "md"}
            onCopy={() => copy(markdown, "md")}
          />
          <SnippetCard
            label="HTML"
            snippet={html}
            copied={copied === "html"}
            onCopy={() => copy(html, "html")}
          />
          <SnippetCard
            label="arXiv comment"
            snippet={arxiv}
            copied={copied === "arxiv"}
            onCopy={() => copy(arxiv, "arxiv")}
          />
        </div>
      </div>
    </div>
  );
}

function SnippetCard({
  label,
  snippet,
  copied,
  onCopy,
}: {
  label: string;
  snippet: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="border border-border rounded-md bg-surface p-2.5 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.15em] text-subtle">
        <Code2 className="size-2.5" />
        {label}
        <button
          onClick={onCopy}
          className="ml-auto text-[10px] text-muted hover:text-foreground flex items-center gap-1"
        >
          {copied ? (
            <>
              <Check className="size-2.5 text-accent" /> Copied
            </>
          ) : (
            <>
              <Copy className="size-2.5" /> Copy
            </>
          )}
        </button>
      </div>
      <code className="block text-[10.5px] font-mono text-foreground/85 break-all leading-snug">
        {snippet}
      </code>
    </div>
  );
}

export function ChainTimeline({ report }: { report: Report }) {
  return (
    <div className="panel rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-border text-[10px] uppercase tracking-[0.15em] text-subtle font-mono">
        Event chain · {report.ledger.events.length}
      </div>
      <ol className="divide-y divide-border">
        {report.ledger.events.map((ev, i) => (
          <EventRow key={ev.id} ev={ev} index={i} />
        ))}
      </ol>
    </div>
  );
}

function EventRow({ ev, index }: { ev: ProvenanceEvent; index: number }) {
  const isAi =
    ev.kind === "ai-edit" ||
    ev.kind === "ai-insert" ||
    ev.kind === "ai-cite" ||
    ev.kind === "review-response";
  const Icon =
    ev.kind === "ai-cite"
      ? Library
      : ev.kind === "import"
        ? Upload
        : ev.kind === "comment"
          ? Quote
          : ev.kind === "review-response"
            ? Inbox
            : isAi
              ? Sparkles
              : User;
  return (
    <li className="px-5 py-3 flex items-start gap-3">
      <div className="text-[10px] font-mono text-subtle pt-1 w-10 text-right">
        {String(index + 1).padStart(2, "0")}
      </div>
      <div
        className={cn(
          "size-7 rounded-md border flex items-center justify-center shrink-0 mt-0.5",
          isAi
            ? "text-accent border-[#2d3d12] bg-accent-soft"
            : ev.kind === "import"
              ? "text-warning border-warning/40 bg-warning/10"
              : "text-foreground border-border bg-surface-2",
        )}
      >
        <Icon className="size-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-[10.5px] font-mono uppercase tracking-[0.12em] text-subtle">
          <span className="text-foreground">{ev.kind}</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            {ev.actor.label}
            {ev.actor.orcid && (
              <a
                href={`https://orcid.org/${ev.actor.orcid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 px-1 py-px rounded text-[9.5px] border border-accent/30 bg-accent-soft text-accent normal-case tracking-normal hover:border-accent"
                title={`ORCID iD ${ev.actor.orcid}`}
              >
                <span aria-hidden>iD</span>
                <span className="tabular-nums">
                  {ev.actor.orcid.slice(-4)}
                </span>
              </a>
            )}
          </span>
          {ev.model && (
            <>
              <span>·</span>
              <span>{ev.model.replace("claude-", "").replace("gpt-", "")}</span>
            </>
          )}
          <span className="ml-auto">
            {new Date(ev.timestamp).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>
        {ev.after && (
          <div className="text-[12.5px] text-foreground/85 mt-1 italic">
            &ldquo;{ev.after.slice(0, 240)}
            {ev.after.length > 240 ? "…" : ""}&rdquo;
          </div>
        )}
        <div className="flex items-center gap-3 mt-1 text-[10.5px]">
          {(ev.sources?.length ?? 0) > 0 && (
            <span className="text-accent">
              <ShieldCheck className="size-2.5 inline mr-0.5" />
              {ev.sources!.length} source{ev.sources!.length === 1 ? "" : "s"}
            </span>
          )}
          {(ev.unsupportedClaims?.length ?? 0) > 0 && (
            <span className="text-warning">
              <ShieldAlert className="size-2.5 inline mr-0.5" />
              {ev.unsupportedClaims!.length} unsourced
            </span>
          )}
          <span className="ml-auto font-mono text-subtle truncate" title={ev.hash}>
            {ev.hash.slice(0, 12)}…
          </span>
        </div>
      </div>
    </li>
  );
}

function HowItWorks() {
  return (
    <div className="grid sm:grid-cols-3 gap-3 text-[13px]">
      {[
        {
          title: "1 · We re-walk the chain",
          body: "Every event is hashed against its predecessor. Reordering or modifying any line breaks the chain at that index.",
        },
        {
          title: "2 · We surface unsourced claims",
          body: "If the agent emitted a claim it couldn't ground, it sits in a separate bucket so reviewers know what to scrutinise.",
        },
        {
          title: "3 · We report, you decide",
          body: "Authorship breakdown, integrity status, and the full chain — printable as a one-page disclosure attachment.",
        },
      ].map((c) => (
        <div key={c.title} className="panel p-4 rounded-lg">
          <div className="text-[10px] uppercase tracking-[0.15em] text-accent font-mono mb-1">
            {c.title}
          </div>
          <p className="text-[12.5px] text-muted leading-relaxed">{c.body}</p>
        </div>
      ))}
    </div>
  );
}
