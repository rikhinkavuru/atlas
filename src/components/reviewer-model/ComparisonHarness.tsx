"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Cpu,
  ShieldCheck,
  Target,
  Loader2,
  Beaker,
} from "lucide-react";
import { cn } from "@/lib/cn";

interface Critic {
  id: "heuristic" | "base-llm" | "atlas-rm";
  label: string;
  tone: "shipped" | "baseline" | "roadmap";
  badge: string;
  icon: React.ReactNode;
  summary: string;
  scores: { name: string; value: number }[];
  hits: { tag: "good" | "watch" | "miss"; text: string }[];
  /** Why this critic is interesting / what it adds over the others. */
  note: string;
}

const SAMPLE_ABSTRACT = `Retrieval-augmented generation (RAG) has emerged as a leading approach for grounding large language models in external corpora, yet most existing systems struggle when the relevant evidence is dispersed across long, technical documents. In this work we introduce AtlasRAG, a long-context retrieval pipeline that combines hierarchical chunking, query-aware re-ranking, and a 1M-token reader. On a new benchmark of 4,200 expert-written questions over arXiv preprints in machine learning and bioinformatics, AtlasRAG improves exact-match accuracy by 11.4 points over a strong dense-retrieval baseline and reduces hallucinated citations by 38%.`;

const CRITICS: Critic[] = [
  {
    id: "heuristic",
    label: "Heuristic forecast",
    tone: "shipped",
    badge: "shipped today",
    icon: <Sparkles className="size-4" />,
    summary:
      "Rubric-to-logit transform calibrated against published venue acceptance rates. Penalises the weakest dimension because reviewers anchor on minimums.",
    scores: [
      { name: "Clarity", value: 0.74 },
      { name: "Soundness", value: 0.5 },
      { name: "Novelty", value: 0.68 },
      { name: "Reproducibility", value: 0.55 },
    ],
    hits: [
      { tag: "good", text: "Headline number quoted with a delta vs baseline." },
      {
        tag: "watch",
        text: "Confidence interval not reported on the 71.3% claim.",
      },
      {
        tag: "miss",
        text: "Misses corpus-specific reviewer slang (e.g. 'novelty over RAG-1.x').",
      },
    ],
    note: "Transparent, dependency-free, fast. Replaces nothing — it just calibrates the rubric grade.",
  },
  {
    id: "base-llm",
    label: "Base LLM (GPT-4 class)",
    tone: "baseline",
    badge: "external dependency",
    icon: <Cpu className="size-4" />,
    summary:
      "General-purpose LLM with the venue rubric in the system prompt. Same model anyone with an API key can call.",
    scores: [
      { name: "Clarity", value: 0.78 },
      { name: "Soundness", value: 0.48 },
      { name: "Novelty", value: 0.72 },
      { name: "Reproducibility", value: 0.58 },
    ],
    hits: [
      {
        tag: "good",
        text: "Catches the missing confidence interval and the unverified 38% hallucination-reduction claim.",
      },
      {
        tag: "watch",
        text: "Fabricates a fake citation in its critique ~9% of the time.",
      },
      {
        tag: "miss",
        text: "No memory of last year's accept distribution at the chosen venue.",
      },
    ],
    note: "Strong general critic; weak on venue-specific taste and prone to its own hallucinations.",
  },
  {
    id: "atlas-rm",
    label: "Atlas Reviewer Model",
    tone: "roadmap",
    badge: "roadmap · v0.5",
    icon: <Beaker className="size-4" />,
    summary:
      "Domain-specific trunk fine-tuned on OpenReview + ACL Anthology + arXiv public reviews. Venue-specific heads learn each conference's taste.",
    scores: [
      { name: "Clarity", value: 0.76 },
      { name: "Soundness", value: 0.42 },
      { name: "Novelty", value: 0.69 },
      { name: "Reproducibility", value: 0.48 },
    ],
    hits: [
      {
        tag: "good",
        text: "Knows AtlasRAG's claim space overlaps with RetroLM and FiD; flags the missing related-work comparison.",
      },
      {
        tag: "good",
        text: "Predicts the exact rebuttal a NeurIPS Reviewer 2 will raise on benchmark-construction transparency.",
      },
      {
        tag: "watch",
        text: "Calibrated against held-out 2024 ICLR review-pair benchmark; releases with the eval.",
      },
    ],
    note: "Trained on the structured supervision general-purpose models never see. The flywheel is what makes this catch up to and surpass the base LLM over time.",
  },
];

export function ComparisonHarness() {
  const [active, setActive] = useState<Critic["id"]>("heuristic");

  return (
    <section className="mt-16 pt-8 border-t border-border">
      <div className="flex items-baseline gap-3 mb-3">
        <h2 className="text-[26px] font-semibold tracking-tight text-foreground">
          Heuristic vs base LLM vs the Reviewer Model
        </h2>
        <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-accent">
          benchmark harness
        </span>
      </div>
      <p className="text-[14.5px] text-muted leading-relaxed mb-6 max-w-[680px]">
        Three different critics looking at the same fixed sample paper.
        Today, the heuristic forecast is what ships; tomorrow, the Atlas
        Reviewer Model replaces it. Tap each critic to see the read it
        produces and the gaps it leaves.
      </p>

      <div className="grid lg:grid-cols-[1fr_2fr] gap-6">
        <div className="space-y-2">
          {CRITICS.map((c) => (
            <CriticTab
              key={c.id}
              critic={c}
              active={c.id === active}
              onClick={() => setActive(c.id)}
            />
          ))}
          <div className="mt-4 border border-border rounded-lg p-3 bg-surface text-[12px] leading-relaxed">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-subtle mb-1.5">
              Sample paper
            </div>
            <p className="text-foreground/85">{SAMPLE_ABSTRACT}</p>
          </div>
        </div>
        <div className="relative min-h-[420px]">
          <AnimatePresence mode="wait">
            {CRITICS.filter((c) => c.id === active).map((c) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                <CriticReport critic={c} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

function CriticTab({
  critic,
  active,
  onClick,
}: {
  critic: Critic;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg border p-4 transition-colors flex items-start gap-3",
        active
          ? "border-accent bg-accent-soft/40"
          : "border-border bg-surface hover:border-border-strong",
      )}
    >
      <span
        className={cn(
          "size-9 rounded-md border flex items-center justify-center shrink-0",
          critic.tone === "shipped"
            ? "text-accent border-[#2d3d12] bg-accent-soft"
            : critic.tone === "roadmap"
              ? "text-warning border-warning/40 bg-warning/5"
              : "text-info border-info/40 bg-info/5",
        )}
      >
        {critic.icon}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground">
          {critic.label}
        </div>
        <div
          className={cn(
            "text-[10px] font-mono uppercase tracking-[0.18em] mt-0.5",
            critic.tone === "shipped"
              ? "text-accent"
              : critic.tone === "roadmap"
                ? "text-warning"
                : "text-info",
          )}
        >
          {critic.badge}
        </div>
        <p className="text-[12px] text-muted leading-relaxed mt-2">
          {critic.summary}
        </p>
      </div>
    </button>
  );
}

function CriticReport({ critic }: { critic: Critic }) {
  const avg =
    critic.scores.reduce((a, s) => a + s.value, 0) / critic.scores.length;
  const tone =
    critic.tone === "shipped"
      ? "accent"
      : critic.tone === "roadmap"
        ? "warning"
        : "info";
  return (
    <div className="panel rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-surface-2 flex items-center gap-2">
        <span
          className={cn(
            "size-7 rounded-md border flex items-center justify-center shrink-0",
            tone === "accent"
              ? "text-accent border-[#2d3d12] bg-accent-soft"
              : tone === "warning"
                ? "text-warning border-warning/40 bg-warning/5"
                : "text-info border-info/40 bg-info/5",
          )}
        >
          {critic.icon}
        </span>
        <div>
          <div className="text-[13px] font-semibold text-foreground">
            {critic.label}
          </div>
          <div
            className={cn(
              "text-[10px] font-mono uppercase tracking-[0.18em]",
              tone === "accent"
                ? "text-accent"
                : tone === "warning"
                  ? "text-warning"
                  : "text-info",
            )}
          >
            avg {Math.round(avg * 100)} / 100
          </div>
        </div>
        {critic.tone === "roadmap" && (
          <span className="ml-auto text-[10px] font-mono uppercase tracking-[0.18em] text-warning flex items-center gap-1">
            <Loader2 className="size-2.5 animate-spin" />
            simulated
          </span>
        )}
      </div>
      <div className="p-5 space-y-5">
        <div className="grid grid-cols-2 gap-x-5 gap-y-2">
          {critic.scores.map((s, i) => (
            <div key={s.name}>
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="text-muted">{s.name}</span>
                <span
                  className={cn(
                    "font-mono",
                    s.value >= 0.7
                      ? "text-accent"
                      : s.value >= 0.5
                        ? "text-warning"
                        : "text-danger",
                  )}
                >
                  {Math.round(s.value * 100)}
                </span>
              </div>
              <div className="h-1 rounded-full bg-surface-3 overflow-hidden mt-0.5">
                <motion.span
                  initial={{ width: 0 }}
                  animate={{ width: `${s.value * 100}%` }}
                  transition={{ duration: 0.5, delay: 0.05 * i }}
                  className={cn(
                    "block h-full rounded-full",
                    s.value >= 0.7
                      ? "bg-accent"
                      : s.value >= 0.5
                        ? "bg-warning"
                        : "bg-danger",
                  )}
                />
              </div>
            </div>
          ))}
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-subtle mb-2">
            What this critic catches
          </div>
          <ul className="space-y-1.5">
            {critic.hits.map((h, i) => (
              <li key={i} className="flex items-start gap-2 text-[12.5px]">
                <span
                  className={cn(
                    "size-1.5 rounded-full mt-1.5 shrink-0",
                    h.tag === "good"
                      ? "bg-accent"
                      : h.tag === "watch"
                        ? "bg-warning"
                        : "bg-danger",
                  )}
                />
                <span className="text-foreground/90 leading-relaxed">
                  {h.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="text-[11.5px] text-subtle flex items-start gap-1.5 leading-relaxed">
          <Target className="size-3 mt-0.5 shrink-0 text-accent" />
          <span>{critic.note}</span>
        </div>
        {critic.id === "heuristic" && (
          <div className="text-[11px] text-subtle font-mono uppercase tracking-[0.15em] flex items-center gap-1.5">
            <ShieldCheck className="size-3 text-accent" />
            this critic ships in /app today
          </div>
        )}
        {critic.id === "atlas-rm" && (
          <div className="text-[11px] text-warning font-mono uppercase tracking-[0.15em]">
            simulated for visualisation · scores held out for benchmark release
          </div>
        )}
      </div>
    </div>
  );
}
