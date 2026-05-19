"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Inbox,
  Sparkles,
  Loader2,
  Check,
  Download,
  Trash2,
  Pencil,
  X,
  Plus,
  AlertTriangle,
  Wand2,
} from "lucide-react";
import { useAtlas, activePaper } from "@/lib/store";
import { useSettings, getModelHeaders } from "@/lib/settings";
import { cn } from "@/lib/cn";
import {
  deriveReviewer2Questions,
  type Reviewer2Question,
} from "@/lib/reviewer2";
import type {
  AnalysisIssue,
  AnalysisReport,
  RubricScore,
  ReviewerItem,
  Tab,
} from "@/types";

const STATUS_COLOR: Record<ReviewerItem["status"], string> = {
  todo: "text-subtle border-border bg-surface-2",
  drafted: "text-info border-info/40 bg-info/5",
  addressed: "text-accent border-[#2d3d12] bg-accent-soft",
  rejected: "text-warning border-warning/40 bg-warning/5",
};

export function ReviewerStudio({ tab }: { tab: Tab }) {
  const review = useAtlas((s) =>
    tab.reviewId ? s.reviews[tab.reviewId] : null,
  );
  const updateItem = useAtlas((s) => s.updateReviewItem);
  const deleteReview = useAtlas((s) => s.deleteReview);
  const closeTab = useAtlas((s) => s.closeTab);
  const paper = useAtlas((s) => activePaper(s));
  const analysis = useAtlas((s) => s.analysis);
  const voice = useSettings((s) => s.voiceProfile);
  const venue = useSettings((s) => s.venue);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  // Pre-compute the Reviewer-2 question pool for this paper. When the
  // analyzer has run, we use those scores; otherwise we synthesise an empty
  // report so deriveReviewer2Questions still produces the venue-specific
  // universal questions (reproducibility checklist, PICOT, etc.). The match
  // step below pairs each ReviewerItem.comment to its closest prediction.
  const r2Questions = useMemo(() => {
    const report: AnalysisReport = analysis ?? {
      summary: "",
      scores: [] as RubricScore[],
      issues: [] as AnalysisIssue[],
      generatedAt: 0,
    };
    return deriveReviewer2Questions(venue, report);
  }, [analysis, venue]);

  if (!review) {
    return (
      <div className="flex-1 flex items-center justify-center text-subtle">
        Review session not found.
      </div>
    );
  }

  async function draft(item: ReviewerItem) {
    if (!review || !paper) return;
    setBusyItemId(item.id);
    try {
      const r = await fetch("/api/review-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getModelHeaders() },
        body: JSON.stringify({
          comment: item.comment,
          reviewer: item.reviewerLabel,
          paperTitle: paper.title,
          paperHtml: paper.html,
          voice,
        }),
      });
      const data = await r.json();
      updateItem(review.id, item.id, {
        response: data.response ?? item.response,
        linkedQuote: data.linkedQuote ?? item.linkedQuote,
        status: "drafted",
      });
    } finally {
      setBusyItemId(null);
    }
  }

  async function draftAll() {
    if (!review) return;
    for (const item of review.items) {
      if (item.status === "todo") {
        await draft(item);
      }
    }
  }

  function exportLetter() {
    if (!review || !paper) return;
    const lines: string[] = [];
    lines.push(`# Response to Reviewers`);
    lines.push(``);
    lines.push(`Manuscript: ${paper.title}`);
    lines.push(``);
    lines.push(`Dear Editor,`);
    lines.push(``);
    lines.push(
      `We thank the reviewers for their careful reading. Below we respond to each comment.`,
    );
    lines.push(``);
    let currentReviewer = "";
    for (const it of review.items) {
      if (it.reviewerLabel !== currentReviewer) {
        currentReviewer = it.reviewerLabel;
        lines.push(`## ${currentReviewer}`);
        lines.push(``);
      }
      lines.push(`### ${it.number}. ${it.reviewerLabel}`);
      lines.push(``);
      lines.push(`**Comment.** ${it.comment}`);
      lines.push(``);
      lines.push(`**Response.** ${it.response || "[no response drafted]"}`);
      if (it.linkedQuote) {
        lines.push(``);
        lines.push(`> ${it.linkedQuote}`);
      }
      lines.push(``);
    }
    lines.push(`Sincerely,`);
    lines.push(`The authors`);
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `response-to-reviewers.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const stats = {
    total: review.items.length,
    drafted: review.items.filter((i) => i.status !== "todo").length,
    addressed: review.items.filter((i) => i.status === "addressed").length,
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="h-12 px-4 flex items-center gap-2 border-b border-border bg-surface">
        <div className="size-7 rounded bg-accent-soft border border-[#2d3d12] flex items-center justify-center">
          <Inbox className="size-4 text-accent" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[13px] font-semibold">
            Response to Reviewers
          </span>
          <span className="text-[10px] text-subtle font-mono uppercase tracking-[0.15em]">
            {stats.drafted}/{stats.total} drafted · {stats.addressed} marked addressed
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={draftAll}
            disabled={busyItemId !== null || stats.drafted === stats.total}
            className="btn btn-primary h-7 text-[11px] disabled:opacity-40"
            title="Draft a response for every undrafted item"
          >
            <Sparkles className="size-3.5" />
            Draft all
          </button>
          <button onClick={exportLetter} className="btn h-7 text-[11px]">
            <Download className="size-3.5" />
            Export letter
          </button>
          <button
            onClick={() => {
              if (!confirm("Delete this review session?")) return;
              deleteReview(review.id);
              closeTab(tab.id);
            }}
            className="btn btn-ghost h-7 text-[11px] text-subtle hover:text-danger"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-[900px] mx-auto px-8 py-8 space-y-4">
          {!paper && (
            <div className="flex items-center gap-2 p-3 rounded border border-warning/40 bg-warning/5 text-[12px] text-warning">
              <AlertTriangle className="size-4" />
              Open a paper tab so the responses can be grounded in the
              manuscript.
            </div>
          )}
          {review.items.map((item) => {
            const r2Match = matchReviewer2(item.comment, r2Questions);
            return (
              <ReviewerItemCard
                key={item.id}
                item={item}
                busy={busyItemId === item.id}
                r2Match={r2Match}
                onDraft={() => draft(item)}
                onUpdate={(patch) => updateItem(review.id, item.id, patch)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ReviewerItemCard({
  item,
  busy,
  r2Match,
  onDraft,
  onUpdate,
}: {
  item: ReviewerItem;
  busy: boolean;
  r2Match: { question: Reviewer2Question; score: number } | null;
  onDraft: () => void;
  onUpdate: (patch: Partial<ReviewerItem>) => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="panel p-4 space-y-2.5"
    >
      <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.12em] font-mono text-subtle">
        <span className="text-foreground font-semibold">#{item.number}</span>
        <span className="text-subtle">{item.reviewerLabel}</span>
        <span
          className={cn(
            "ml-auto px-1.5 py-0.5 rounded border",
            STATUS_COLOR[item.status],
          )}
        >
          {item.status}
        </span>
      </div>

      <blockquote className="text-[13px] text-foreground border-l-2 border-border pl-3 leading-relaxed italic">
        {item.comment}
      </blockquote>

      {r2Match && r2Match.score >= 0.25 && (
        <Reviewer2MatchPanel
          match={r2Match}
          onUseRebuttal={() =>
            onUpdate({
              response: r2Match.question.rebuttalDraft,
              status: item.status === "todo" ? "drafted" : item.status,
            })
          }
          existingResponseLength={item.response.length}
        />
      )}

      <div className="text-[10px] uppercase tracking-[0.12em] text-subtle font-mono">
        Response
      </div>
      {editing ? (
        <textarea
          autoFocus
          value={item.response}
          onChange={(e) =>
            onUpdate({
              response: e.target.value,
              status:
                item.status === "todo" ? "drafted" : item.status,
            })
          }
          onBlur={() => setEditing(false)}
          rows={4}
          className="w-full bg-background border border-border rounded-md p-2.5 text-[13px] focus:outline-none focus:border-border-strong"
        />
      ) : (
        <div
          className={cn(
            "min-h-[44px] rounded p-2.5 text-[13px] leading-relaxed whitespace-pre-wrap",
            item.response
              ? "bg-surface border border-border text-foreground"
              : "border border-dashed border-border text-subtle italic",
          )}
        >
          {item.response || "No response drafted yet."}
        </div>
      )}

      {item.linkedQuote && (
        <div className="text-[11px] text-muted italic border-l-2 border-accent/40 pl-2">
          References manuscript: &ldquo;{item.linkedQuote}&rdquo;
        </div>
      )}

      <div className="flex items-center gap-1.5 pt-1">
        <button
          onClick={onDraft}
          disabled={busy}
          className="btn h-7 text-[11px]"
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          {item.response ? "Redraft" : "Draft response"}
        </button>
        <button
          onClick={() => setEditing((e) => !e)}
          className="btn btn-ghost h-7 text-[11px]"
        >
          <Pencil className="size-3.5" />
          {editing ? "Done" : "Edit"}
        </button>
        <div className="ml-auto flex items-center gap-1">
          {item.status !== "addressed" && (
            <button
              onClick={() => onUpdate({ status: "addressed" })}
              className="btn btn-ghost h-7 text-[11px] text-accent"
            >
              <Check className="size-3.5" />
              Mark addressed
            </button>
          )}
          {item.status !== "rejected" && (
            <button
              onClick={() => onUpdate({ status: "rejected" })}
              className="btn btn-ghost h-7 text-[11px] text-warning"
            >
              <X className="size-3.5" />
              Reject
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Surfaces "this reviewer comment looks like Reviewer-2 prediction X" when
 * the match score is meaningful, and offers a one-click pre-fill of the
 * predicted rebuttal as a starting draft.
 *
 * The match isn't presented as "the answer" — researchers should always
 * read and edit. We hide the panel when a response already exists at
 * comparable length so it doesn't keep nagging after the user has drafted.
 */
function Reviewer2MatchPanel({
  match,
  existingResponseLength,
  onUseRebuttal,
}: {
  match: { question: Reviewer2Question; score: number };
  existingResponseLength: number;
  onUseRebuttal: () => void;
}) {
  // Hide if the user already drafted something substantive — the suggestion
  // becomes noise once a real response is in place.
  if (existingResponseLength > 80) return null;
  const q = match.question;
  const tone =
    q.severity === "blocker"
      ? "border-danger/30 bg-danger/5 text-danger"
      : q.severity === "concern"
        ? "border-warning/40 bg-warning/5 text-warning"
        : "border-info/40 bg-info/5 text-info";
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 text-[11.5px] flex items-start gap-2",
        tone,
      )}
    >
      <Wand2 className="size-3.5 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[9.5px] uppercase tracking-[0.15em] mb-0.5">
          Matches Reviewer-2 prediction
          <span className="text-subtle ml-1">
            · {Math.round(match.score * 100)}% confidence
          </span>
        </div>
        <div className="text-foreground/90 leading-snug mb-1.5">
          {q.concern}
        </div>
        <div className="text-muted italic leading-snug line-clamp-2">
          “{q.rebuttalDraft.slice(0, 240)}{q.rebuttalDraft.length > 240 ? "…" : ""}”
        </div>
        <button
          onClick={onUseRebuttal}
          className="mt-2 btn h-7 text-[11px]"
          type="button"
        >
          <Sparkles className="size-3.5" />
          Use predicted rebuttal as draft
        </button>
        {q.rebuttalDraft.includes("[") && (
          <div className="mt-1.5 text-[10px] text-subtle font-mono">
            Note: <span className="text-foreground">[brackets]</span> in the
            draft are placeholders to fill in (section numbers, specific
            evidence, etc.).
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Match a reviewer comment to the closest Reviewer-2 prediction by token
 * overlap. We strip stopwords + use light TF-style weighting so rare domain
 * terms ("ablation", "PICOT", "limitations") dominate over generic verbs.
 * Returns null when no candidate exceeds a baseline score.
 */
function matchReviewer2(
  comment: string,
  questions: Reviewer2Question[],
): { question: Reviewer2Question; score: number } | null {
  if (questions.length === 0) return null;
  // Stopwords tuned for academic discourse — `can` / `do` / `does` removed
  // since reviewer questions lean on them ("can the authors", "does this
  // generalise"). Added `just` / `seem` / `appear` which carry less signal.
  const STOP = new Set([
    "the","a","an","of","to","in","is","it","this","that","and","or","for","on",
    "with","as","by","at","from","but","be","are","was","were","not","you",
    "i","we","they","their","its","what","why","how","one","more","just","seem","appear",
  ]);
  // 2-char floor so acronyms like AI / ML / RL / NLP / CV survive — they're
  // exactly the high-signal tokens we want to match on. Numbers-only tokens
  // (years, page counts) still get dropped via the alnum-and-stop check.
  const tokensOf = (s: string): string[] =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 2 && !/^\d+$/.test(t) && !STOP.has(t));
  const commentTokens = new Set(tokensOf(comment));
  if (commentTokens.size === 0) return null;
  let best: { question: Reviewer2Question; score: number } | null = null;
  for (const q of questions) {
    const haystack = `${q.question} ${q.concern}`;
    const qTokens = tokensOf(haystack);
    if (qTokens.length === 0) continue;
    let overlap = 0;
    for (const t of qTokens) {
      if (commentTokens.has(t)) overlap++;
    }
    // Jaccard-ish: divide overlap by max(qTokens, commentTokens) so an
    // unusually long reviewer comment can't artificially inflate the score.
    const score =
      overlap / Math.max(qTokens.length, commentTokens.size);
    if (!best || score > best.score) best = { question: q, score };
  }
  return best;
}

export function NewReviewModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"paste" | "openreview">("paste");
  const [raw, setRaw] = useState("");
  const [forumInput, setForumInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createReview = useAtlas((s) => s.createReview);
  const paper = useAtlas((s) => activePaper(s));
  // Tracks the in-flight fetch for OpenReview imports so we can abort when
  // the user switches tabs or closes the modal mid-fetch.
  const abortRef = useRef<AbortController | null>(null);

  if (!open) return null;

  function switchMode(m: "paste" | "openreview") {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setBusy(false);
    }
    setMode(m);
    setError(null);
  }

  async function goPaste() {
    const text = raw.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/review-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getModelHeaders() },
        body: JSON.stringify({ rawText: text }),
      });
      const data = await r.json();
      const items = data.items ?? [];
      if (items.length === 0) {
        setError("Couldn't identify any reviewer comments. Try a different format.");
        return;
      }
      createReview(text, items, paper?.id);
      setRaw("");
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function goOpenReview() {
    const forum = forumInput.trim();
    if (!forum) return;
    setBusy(true);
    setError(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const r = await fetch("/api/openreview/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forum }),
        signal: controller.signal,
      });
      // If user switched tabs mid-fetch, the controller was aborted and we
      // bail rather than mutating state for an out-of-context request.
      if (controller.signal.aborted || abortRef.current !== controller) {
        return;
      }
      const data = (await r.json()) as {
        ok: boolean;
        items?: Array<{
          id: string;
          number: string;
          reviewerLabel: string;
          comment: string;
          response: string;
          status: "todo";
        }>;
        paperTitle?: string;
        decision?: string;
        message?: string;
        error?: string;
      };
      if (!data.ok || !data.items || data.items.length === 0) {
        setError(
          data.message ??
            data.error ??
            "Could not fetch reviews. Try the paste flow.",
        );
        return;
      }
      // Build the raw-text echo so the review session has a recoverable
      // source if the user ever wants to re-parse the import.
      const summary =
        `Imported from OpenReview · ${data.paperTitle ?? "Untitled"}` +
        (data.decision ? ` · decision: ${data.decision}` : "") +
        `\n\n` +
        data.items
          .map(
            (it) =>
              `${it.reviewerLabel} (${it.number})\n${it.comment}`,
          )
          .join("\n\n---\n\n");
      createReview(summary, data.items, paper?.id);
      setForumInput("");
      onClose();
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={() => {
        abortRef.current?.abort();
        onClose();
      }}
    >
      <div
        className="panel w-[640px] max-w-[94vw] max-h-[80vh] overflow-hidden shadow-2xl rounded-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-11 px-4 flex items-center border-b border-border">
          <h2 className="text-[13px] font-semibold tracking-tight">
            New review session
          </h2>
          <button
            onClick={onClose}
            className="ml-auto size-7 rounded hover:bg-surface-2 flex items-center justify-center text-muted"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="px-5 pt-3 border-b border-border">
          <div className="flex items-center gap-1">
            {(["paste", "openreview"] as const).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={cn(
                  "h-8 px-3 text-[11.5px] font-mono uppercase tracking-[0.12em] border-b-2 -mb-px",
                  mode === m
                    ? "text-accent border-accent"
                    : "text-muted border-transparent hover:text-foreground",
                )}
              >
                {m === "paste" ? "Paste text" : "From OpenReview"}
              </button>
            ))}
          </div>
        </div>
        <div className="p-5 space-y-3 flex-1 overflow-y-auto">
          {mode === "paste" && (
            <>
              <p className="text-[12px] text-muted leading-relaxed">
                Paste reviewer text from any source. Atlas parses each comment
                into a separate item, then drafts a response for each one
                grounded in your manuscript and voice profile.
              </p>
              <textarea
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder={`Reviewer 1\n1. The motivation in Section 1 is unclear. Please...\n2. The baselines in Table 2 are weak; please add ...\n\nReviewer 2\n1. ...`}
                rows={14}
                className="w-full bg-background border border-border rounded-md p-3 text-[13px] font-mono placeholder:text-subtle focus:outline-none focus:border-border-strong resize-none"
              />
            </>
          )}
          {mode === "openreview" && (
            <>
              <p className="text-[12px] text-muted leading-relaxed">
                Paste an OpenReview forum URL or bare forum id. Atlas walks
                the v2 / v1 public API for{" "}
                <span className="font-mono text-foreground">
                  Official_Review
                </span>{" "}
                replies and creates one ReviewerItem per review, with
                summary / strengths / weaknesses / questions sections when
                the venue's schema exposes them.
              </p>
              <label className="block">
                <span className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-subtle">
                  Forum URL or id
                </span>
                <input
                  value={forumInput}
                  onChange={(e) => setForumInput(e.target.value)}
                  placeholder="https://openreview.net/forum?id=rhgIgTSSxW"
                  className="input mt-1 w-full font-mono text-[12.5px]"
                />
              </label>
              <p className="text-[10.5px] text-subtle">
                We send only the forum id to OpenReview&apos;s public API. No
                paper text is forwarded. Reviewer attribution is preserved via
                the per-item label.
              </p>
            </>
          )}
          {error && (
            <div className="text-[11.5px] text-warning bg-warning/5 border border-warning/40 rounded p-2">
              {error}
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-border flex items-center gap-2">
          <span className="text-[10.5px] text-subtle">
            {mode === "paste"
              ? `${raw.length} chars`
              : forumInput.trim()
                ? "ready"
                : "paste a forum URL or id"}
          </span>
          {mode === "paste" ? (
            <button
              onClick={goPaste}
              disabled={!raw.trim() || busy}
              className="btn btn-primary h-8 text-[12px] ml-auto disabled:opacity-40"
            >
              {busy ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> Parsing
                </>
              ) : (
                <>
                  <Plus className="size-3.5" /> Create review
                </>
              )}
            </button>
          ) : (
            <button
              onClick={goOpenReview}
              disabled={!forumInput.trim() || busy}
              className="btn btn-primary h-8 text-[12px] ml-auto disabled:opacity-40"
            >
              {busy ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> Fetching
                </>
              ) : (
                <>
                  <Plus className="size-3.5" /> Import from OpenReview
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
