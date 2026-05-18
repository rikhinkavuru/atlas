"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  MessageCircleQuestion,
  Sparkles,
  ShieldAlert,
  AlertTriangle,
  Eye,
  ChevronDown,
  Copy,
  Send,
} from "lucide-react";
import { useAtlas, activePaper } from "@/lib/store";
import { getModelHeaders, useSettings } from "@/lib/settings";
import { cn } from "@/lib/cn";
import type { AnalysisReport } from "@/types";
import type { Reviewer2Bundle, Reviewer2Question } from "@/lib/reviewer2";

const SEV_STYLE: Record<
  Reviewer2Question["severity"],
  { tone: string; ring: string; icon: React.ReactNode; label: string }
> = {
  blocker: {
    tone: "text-danger",
    ring: "border-danger/40 bg-danger/5",
    icon: <ShieldAlert className="size-3" />,
    label: "blocker",
  },
  concern: {
    tone: "text-warning",
    ring: "border-warning/40 bg-warning/5",
    icon: <AlertTriangle className="size-3" />,
    label: "concern",
  },
  watch: {
    tone: "text-info",
    ring: "border-info/40 bg-info/5",
    icon: <Eye className="size-3" />,
    label: "watch",
  },
};

/**
 * Renders the Reviewer-2 simulator output. Shows the heuristic baseline
 * immediately on mount, then upgrades in place once the LLM-refined version
 * lands. Each card lets the user (a) copy the rebuttal draft and (b) push the
 * question into the agent panel as a Cite/Ask prompt.
 */
export function Reviewer2Panel({ report }: { report: AnalysisReport }) {
  const paper = useAtlas((s) => activePaper(s));
  const venue = useSettings((s) => s.venue);
  const [bundle, setBundle] = useState<Reviewer2Bundle | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!paper) return;
    setBusy(true);
    setError(null);
    try {
      const headers = {
        "Content-Type": "application/json",
        ...getModelHeaders(),
      };
      const r = await fetch("/api/reviewer-2", {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: paper.title,
          html: paper.html,
          report,
        }),
      });
      if (!r.ok) throw new Error(`reviewer-2 returned ${r.status}`);
      const data = (await r.json()) as Reviewer2Bundle;
      setBundle(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  // Run automatically whenever the analysis report changes — the panel is
  // always in sync with the critic above it.
  useEffect(() => {
    if (!paper || !report.scores.length) return;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paper?.id, report.generatedAt, venue]);

  const questions = bundle?.refined ?? bundle?.baseline ?? [];
  const stage = bundle?.refined ? "refined" : bundle ? "baseline" : busy ? "busy" : "idle";

  return (
    <div className="panel p-4 rounded-lg space-y-3">
      <div className="flex items-center gap-2">
        <div className="size-7 rounded-md bg-accent-soft border border-[#2d3d12] flex items-center justify-center text-accent">
          <MessageCircleQuestion className="size-3.5" />
        </div>
        <div>
          <div className="text-[13px] font-semibold text-foreground">
            Reviewer 2 simulator
          </div>
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-subtle">
            {stage === "refined" && (
              <span className="flex items-center gap-1.5">
                <Sparkles className="size-2.5 text-accent" />
                refined · {bundle?.refinedBy}
              </span>
            )}
            {stage === "baseline" && "heuristic baseline · add a key for LLM refinement"}
            {stage === "busy" && (
              <span className="flex items-center gap-1.5">
                <Loader2 className="size-2.5 animate-spin" />
                predicting…
              </span>
            )}
            {stage === "idle" && "—"}
          </div>
        </div>
        <button
          onClick={run}
          disabled={busy || !paper}
          className="btn btn-ghost h-7 text-[11px] text-muted ml-auto"
          title="Re-run reviewer-2 prediction"
        >
          <Sparkles className="size-3.5" />
          Re-run
        </button>
      </div>

      {error && (
        <div className="text-[11.5px] text-warning bg-warning/5 border border-warning/40 rounded p-2">
          {error}
        </div>
      )}

      {questions.length === 0 && !busy && !error && (
        <div className="text-[12px] text-subtle border border-dashed border-border rounded p-3">
          Run the analyzer first — Reviewer 2 builds on the rubric grade.
        </div>
      )}

      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {questions.map((q, i) => (
            <motion.li
              key={q.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, delay: i * 0.03 }}
            >
              <QuestionCard q={q} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <p className="text-[10.5px] text-subtle leading-relaxed">
        Heuristic baseline runs instantly; LLM refinement (when a key is set)
        venue-flavours the questions. Replaced end-to-end by the Atlas
        Reviewer Model fine-tune at v0.5.
      </p>
    </div>
  );
}

function QuestionCard({ q }: { q: Reviewer2Question }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const style = SEV_STYLE[q.severity];

  function copyRebuttal() {
    void navigator.clipboard.writeText(q.rebuttalDraft).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    });
  }

  function askAgent() {
    window.dispatchEvent(
      new CustomEvent("atlas:set-agent-mode", {
        detail: {
          mode: "ask",
          prompt: `Reviewer 2 will ask: "${q.question}"\n\nHelp me address this in the revision. The concern is: ${q.concern}.`,
        },
      }),
    );
  }

  return (
    <div className={cn("border rounded-md p-3", style.ring)}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start gap-2 text-left"
        aria-expanded={open}
      >
        <span
          className={cn(
            "mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-mono uppercase tracking-[0.12em] border shrink-0",
            style.ring,
            style.tone,
          )}
        >
          {style.icon}
          {style.label}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[12.5px] text-foreground leading-relaxed">
            {q.question}
          </span>
          <span className="block text-[10.5px] text-subtle font-mono uppercase tracking-[0.12em] mt-1">
            {q.concern}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 mt-0.5 text-subtle shrink-0 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="pt-3 mt-2 border-t border-border space-y-2">
              {q.evidence && (
                <div className="text-[11.5px] text-muted italic border-l-2 border-border pl-2 line-clamp-3">
                  &ldquo;{q.evidence}&rdquo;
                </div>
              )}
              <div>
                <div className="text-[9.5px] font-mono uppercase tracking-[0.15em] text-subtle mb-1">
                  Rebuttal starter
                </div>
                <p className="text-[12px] text-foreground/90 leading-relaxed">
                  {q.rebuttalDraft}
                </p>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  onClick={copyRebuttal}
                  className="btn btn-ghost h-7 text-[11px] text-muted"
                >
                  <Copy className="size-3.5" />
                  {copied ? "Copied" : "Copy rebuttal"}
                </button>
                <button
                  onClick={askAgent}
                  className="btn h-7 text-[11px] ml-auto"
                  title="Ask the agent to help address this concern"
                >
                  <Send className="size-3.5" />
                  Ask agent to address
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
