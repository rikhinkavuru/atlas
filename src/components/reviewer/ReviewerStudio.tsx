"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import { useAtlas, activePaper } from "@/lib/store";
import { useSettings, getModelHeaders } from "@/lib/settings";
import { cn } from "@/lib/cn";
import type { ReviewerItem, Tab } from "@/types";

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
  const voice = useSettings((s) => s.voiceProfile);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

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
          {review.items.map((item, idx) => (
            <ReviewerItemCard
              key={item.id}
              item={item}
              busy={busyItemId === item.id}
              onDraft={() => draft(item)}
              onUpdate={(patch) => updateItem(review.id, item.id, patch)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ReviewerItemCard({
  item,
  busy,
  onDraft,
  onUpdate,
}: {
  item: ReviewerItem;
  busy: boolean;
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

export function NewReviewModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createReview = useAtlas((s) => s.createReview);
  const paper = useAtlas((s) => activePaper(s));

  if (!open) return null;

  async function go() {
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

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
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
        <div className="p-5 space-y-3 flex-1 overflow-y-auto">
          <p className="text-[12px] text-muted leading-relaxed">
            Paste reviewer text from OpenReview, journal email, or PDF. Atlas
            parses each comment into a separate item, then drafts a response
            for each one grounded in your manuscript and voice profile.
          </p>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={`Reviewer 1\n1. The motivation in Section 1 is unclear. Please...\n2. The baselines in Table 2 are weak; please add ...\n\nReviewer 2\n1. ...`}
            rows={14}
            className="w-full bg-background border border-border rounded-md p-3 text-[13px] font-mono placeholder:text-subtle focus:outline-none focus:border-border-strong resize-none"
          />
          {error && (
            <div className="text-[11.5px] text-warning bg-warning/5 border border-warning/40 rounded p-2">
              {error}
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-border flex items-center gap-2">
          <span className="text-[10.5px] text-subtle">
            {raw.length} chars
          </span>
          <button
            onClick={go}
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
        </div>
      </div>
    </div>
  );
}
