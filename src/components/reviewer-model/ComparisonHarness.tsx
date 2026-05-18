"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Cpu,
  Target,
  Loader2,
  Beaker,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { useAtlas, activePaper } from "@/lib/store";
import { getModelHeaders, useSettings } from "@/lib/settings";
import { computeForecast } from "@/lib/forecast";
import { deriveReviewer2Questions } from "@/lib/reviewer2";
import { rubricForVenue, type VenueId } from "@/lib/rubrics";
import { cn } from "@/lib/cn";
import type { AnalysisReport, AnalysisIssue, RubricScore } from "@/types";

/**
 * Live comparison harness: three different critics looking at the same paper.
 *  1. Heuristic  — instant; rule-based grade against the venue rubric.
 *  2. Base LLM    — POST /api/analyze with venue rubric in the system prompt.
 *  3. Atlas RM    — heuristic + reviewer-2 simulator overlay; a real preview
 *                   of what the trained model targets.
 *
 * When a paper is open in the workspace it runs on that paper. Otherwise it
 * falls back to a curated AtlasRAG sample so the page demos cleanly.
 */

const SAMPLE_TITLE = "AtlasRAG: long-context retrieval-augmented generation";
const SAMPLE_HTML = `<h1>AtlasRAG: long-context retrieval-augmented generation</h1>
<p><strong>Abstract.</strong> Retrieval-augmented generation (RAG) has emerged as a leading approach for grounding large language models in external corpora, yet most existing systems struggle when the relevant evidence is dispersed across long, technical documents. In this work we introduce AtlasRAG, a long-context retrieval pipeline that combines hierarchical chunking, query-aware re-ranking, and a 1M-token reader. On a new benchmark of 4,200 expert-written questions over arXiv preprints in machine learning and bioinformatics, AtlasRAG improves exact-match accuracy by 11.4 points over a strong dense-retrieval baseline and reduces hallucinated citations by 38%.</p>
<h2>1. Introduction</h2><p>Long technical documents pose a unique challenge for retrieval. We focus on the scientific literature setting, where claims span paragraphs and citations are evidence-anchored.</p>
<h2>2. Method</h2><p>AtlasRAG uses three components: hierarchical chunking at the section and paragraph level, a query-aware cross-encoder re-ranker fine-tuned on scientific QA pairs, and a 1M-token long-context reader.</p>
<h2>3. Experiments</h2><p>We evaluate on AtlasQA-4200, a new benchmark of 4,200 expert-written questions over arXiv preprints. AtlasRAG improves exact-match accuracy by 11.4 points over the strongest dense-retrieval baseline.</p>
<h2>4. Discussion</h2><p>Our contributions are: a long-context retrieval pipeline, a new benchmark, and an analysis of failure modes.</p>`;

type CriticId = "heuristic" | "base-llm" | "atlas-rm";
type CriticStatus = "idle" | "busy" | "done" | "error";

interface CriticReport {
  id: CriticId;
  label: string;
  tone: "shipped" | "baseline" | "preview";
  badge: string;
  icon: React.ReactNode;
  summary: string;
  scores: { name: string; value: number }[];
  hits: { tag: "good" | "watch" | "miss"; text: string }[];
  note: string;
  /** Optional rendered footer specific to this critic (e.g. reviewer-2 list). */
  extra?: React.ReactNode;
}

export function ComparisonHarness() {
  const paper = useAtlas((s) => activePaper(s));
  const venue = useSettings((s) => s.venue);

  const usingActivePaper = !!paper;
  const title = paper?.title ?? SAMPLE_TITLE;
  const html = paper?.html ?? SAMPLE_HTML;

  const [active, setActive] = useState<CriticId>("heuristic");
  const [llmReport, setLlmReport] = useState<AnalysisReport | null>(null);
  const [llmStatus, setLlmStatus] = useState<CriticStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // Heuristic baseline is computed locally without an LLM. It's the same
  // shape as the base-LLM analysis so we can flow it through the same forecast.
  const heuristicReport = useMemo<AnalysisReport>(
    () => quickHeuristicReport(html, venue),
    [html, venue],
  );

  // Trigger LLM analysis when the user opens this section AND has a key set.
  // Cheap UX: don't auto-burn API tokens on every page view — wait until
  // "base-llm" or "atlas-rm" is active.
  useEffect(() => {
    if (active === "heuristic") return;
    if (llmReport || llmStatus === "busy") return;
    void runLLMAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  async function runLLMAnalysis() {
    setLlmStatus("busy");
    setError(null);
    try {
      const headers = {
        "Content-Type": "application/json",
        ...getModelHeaders(),
      };
      const r = await fetch("/api/analyze", {
        method: "POST",
        headers,
        body: JSON.stringify({ title, html }),
      });
      if (!r.ok) throw new Error(`analyze returned ${r.status}`);
      const data = (await r.json()) as AnalysisReport;
      setLlmReport(data);
      setLlmStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLlmStatus("error");
    }
  }

  const heuristicForecast = useMemo(
    () => computeForecast(venue, heuristicReport),
    [venue, heuristicReport],
  );
  const llmForecast = useMemo(
    () => (llmReport ? computeForecast(venue, llmReport) : null),
    [venue, llmReport],
  );

  // Atlas RM preview = heuristic forecast + reviewer-2 simulator overlay.
  // Same rubric grade, but augmented with venue-specific reviewer concerns.
  const reviewer2Questions = useMemo(
    () =>
      deriveReviewer2Questions(
        venue as VenueId,
        llmReport ?? heuristicReport,
      ),
    [venue, llmReport, heuristicReport],
  );

  const critics: CriticReport[] = [
    buildHeuristicCritic(heuristicReport, heuristicForecast, venue),
    buildBaseLLMCritic(llmReport, llmForecast, llmStatus, error),
    buildAtlasRMCritic(
      llmReport ?? heuristicReport,
      llmForecast ?? heuristicForecast,
      reviewer2Questions,
    ),
  ];

  return (
    <section className="mt-16 pt-8 border-t border-border">
      <div className="flex items-baseline gap-3 mb-3 flex-wrap">
        <h2 className="text-[26px] font-semibold tracking-tight text-foreground">
          Heuristic vs base LLM vs Atlas RM preview
        </h2>
        <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-accent">
          live harness
        </span>
        {usingActivePaper && (
          <span className="ml-auto inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-accent-soft text-accent border border-[#2d3d12] text-[10.5px] font-mono uppercase tracking-[0.12em]">
            <FileText className="size-3" />
            running on: {title.slice(0, 48)}
            {title.length > 48 ? "…" : ""}
          </span>
        )}
      </div>
      <p className="text-[14.5px] text-muted leading-relaxed mb-6 max-w-[700px]">
        Three different critics looking at the same paper.{" "}
        {usingActivePaper
          ? "We're using the paper open in your workspace."
          : "We're using a curated AtlasRAG abstract — open a paper in /app to point this at your own draft."}{" "}
        The heuristic is what ships today, the base LLM is what anyone with an
        API key can call, and the Atlas RM preview is the heuristic plus the
        Reviewer-2 simulator — the venue-specific overlay the trained model
        will deepen.
      </p>

      <div className="grid lg:grid-cols-[1fr_2fr] gap-6">
        <div className="space-y-2">
          {critics.map((c) => (
            <CriticTab
              key={c.id}
              critic={c}
              active={c.id === active}
              status={
                c.id === "heuristic"
                  ? "done"
                  : c.id === "base-llm"
                    ? llmStatus
                    : llmStatus === "busy"
                      ? "busy"
                      : "done"
              }
              onClick={() => setActive(c.id)}
            />
          ))}
          <div className="mt-4 border border-border rounded-lg p-3 bg-surface text-[12px] leading-relaxed">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-subtle mb-1.5">
              {usingActivePaper ? "Active paper" : "Sample abstract"}
            </div>
            <p className="text-foreground/85 line-clamp-6">
              {htmlToPlain(html).slice(0, 520)}
              {html.length > 520 ? "…" : ""}
            </p>
          </div>
        </div>
        <div className="relative min-h-[420px]">
          <AnimatePresence mode="wait">
            {critics
              .filter((c) => c.id === active)
              .map((c) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                >
                  <CriticReportCard critic={c} />
                </motion.div>
              ))}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Critic builders — produce a uniform CriticReport from each pipeline's data.

function buildHeuristicCritic(
  report: AnalysisReport,
  forecast: ReturnType<typeof computeForecast>,
  venue: string,
): CriticReport {
  return {
    id: "heuristic",
    label: "Heuristic forecast",
    tone: "shipped",
    badge: "shipped today · instant",
    icon: <Sparkles className="size-4" />,
    summary: `Rubric-to-logit transform with venue weights. Penalises the weakest dimension because Reviewer 2 anchors on the floor. ${Math.round(forecast.acceptProbability * 100)}% accept at ${forecast.venueName}.`,
    scores: report.scores.map((s) => ({ name: s.name, value: s.score })),
    hits: heuristicHighlights(report, forecast),
    note: `Transparent, dependency-free, fast. Already wired into the analyzer drawer for the ${venue} rubric.`,
  };
}

function buildBaseLLMCritic(
  report: AnalysisReport | null,
  forecast: ReturnType<typeof computeForecast> | null,
  status: CriticStatus,
  error: string | null,
): CriticReport {
  if (status === "busy") {
    return {
      id: "base-llm",
      label: "Base LLM",
      tone: "baseline",
      badge: "calling /api/analyze…",
      icon: <Cpu className="size-4" />,
      summary: "Streaming the rubric grade from your configured provider.",
      scores: [],
      hits: [],
      note: "Same model anyone with an API key can call — strong general critic, weak on venue taste.",
    };
  }
  if (status === "error" || !report) {
    return {
      id: "base-llm",
      label: "Base LLM",
      tone: "baseline",
      badge: error ? "error" : "no key set",
      icon: <Cpu className="size-4" />,
      summary:
        error ??
        "Add an OpenAI or Anthropic key in Settings (⌘,) to run this critic.",
      scores: [],
      hits: [],
      note: "Until a key is set we display the heuristic alone.",
    };
  }
  return {
    id: "base-llm",
    label: "Base LLM",
    tone: "baseline",
    badge: forecast
      ? `${Math.round(forecast.acceptProbability * 100)}% accept · ${forecast.venueName}`
      : "live",
    icon: <Cpu className="size-4" />,
    summary:
      report.summary ||
      "Same model anyone with an API key can call — strong general critic, weak on venue taste.",
    scores: report.scores.map((s) => ({ name: s.name, value: s.score })),
    hits: llmHighlights(report),
    note: "General-purpose; catches a lot but doesn't know last year's accept distribution at the chosen venue.",
  };
}

function buildAtlasRMCritic(
  report: AnalysisReport,
  forecast: ReturnType<typeof computeForecast>,
  reviewer2: ReturnType<typeof deriveReviewer2Questions>,
): CriticReport {
  const top = reviewer2.slice(0, 3);
  const extra = (
    <div className="mt-3 pt-3 border-t border-border">
      <div className="text-[9.5px] uppercase tracking-[0.15em] text-subtle font-mono mb-2 flex items-center gap-1.5">
        <Target className="size-2.5 text-accent" />
        Predicted Reviewer-2 questions
      </div>
      <ul className="space-y-2">
        {top.map((q) => (
          <li key={q.id} className="text-[12.5px] leading-relaxed">
            <span
              className={cn(
                "inline-block size-1.5 rounded-full mr-2 align-middle",
                q.severity === "blocker"
                  ? "bg-danger"
                  : q.severity === "concern"
                    ? "bg-warning"
                    : "bg-info",
              )}
            />
            <span className="text-foreground/90">{q.question}</span>
          </li>
        ))}
      </ul>
    </div>
  );
  return {
    id: "atlas-rm",
    label: "Atlas Reviewer Model · preview",
    tone: "preview",
    badge: `${Math.round(forecast.acceptProbability * 100)}% accept · venue-tuned`,
    icon: <Beaker className="size-4" />,
    summary:
      "Heuristic grade + Reviewer-2 simulator overlay. Same scores as the heuristic; gain comes from predicting venue-specific reviewer concerns and pre-drafting rebuttals.",
    scores: report.scores.map((s) => ({ name: s.name, value: s.score })),
    hits: atlasRMHighlights(reviewer2, forecast),
    note: "The fine-tuned model replaces this overlay with venue-trained reviewer heads; the heuristic + reviewer-2 stub already lives in the analyzer today.",
    extra,
  };
}

// ───────────────────────────────────────────────────────────────────────────

function heuristicHighlights(
  report: AnalysisReport,
  forecast: ReturnType<typeof computeForecast>,
): CriticReport["hits"] {
  const hits: CriticReport["hits"] = [];
  if (forecast.explain.positives.length > 0) {
    hits.push({ tag: "good", text: forecast.explain.positives[0] });
  }
  if (forecast.explain.negatives.length > 0) {
    hits.push({ tag: "miss", text: forecast.explain.negatives[0] });
  }
  if (forecast.explain.weakestDimension) {
    hits.push({
      tag: "watch",
      text: `Floor is ${forecast.explain.weakestDimension} — Reviewer 2 will anchor here.`,
    });
  }
  if (hits.length === 0) {
    hits.push({
      tag: "watch",
      text: `Heuristic gives ${Math.round(forecast.acceptProbability * 100)}% at ${forecast.venueName} — no strong outliers.`,
    });
  }
  return hits;
}

function llmHighlights(report: AnalysisReport): CriticReport["hits"] {
  const hits: CriticReport["hits"] = [];
  const errors = report.issues.filter((i) => i.severity === "error");
  const warnings = report.issues.filter((i) => i.severity === "warning");
  if (errors[0]) hits.push({ tag: "miss", text: errors[0].message });
  if (warnings[0]) hits.push({ tag: "watch", text: warnings[0].message });
  if (hits.length < 3) {
    const suggestion = report.issues.find((i) => i.severity === "suggestion");
    if (suggestion) hits.push({ tag: "good", text: suggestion.message });
  }
  if (hits.length === 0) {
    hits.push({ tag: "good", text: "No errors flagged — clean draft." });
  }
  return hits.slice(0, 3);
}

function atlasRMHighlights(
  questions: ReturnType<typeof deriveReviewer2Questions>,
  forecast: ReturnType<typeof computeForecast>,
): CriticReport["hits"] {
  const hits: CriticReport["hits"] = [];
  const blocker = questions.find((q) => q.severity === "blocker");
  const concern = questions.find((q) => q.severity === "concern");
  if (blocker)
    hits.push({ tag: "miss", text: `Reviewer 2 likely vetoes on: ${blocker.concern}` });
  if (concern)
    hits.push({ tag: "watch", text: `Reviewer 2 concern: ${concern.concern}` });
  hits.push({
    tag: "good",
    text: `Pre-drafted rebuttals for ${questions.length} predicted question${questions.length === 1 ? "" : "s"} — one click to send into the agent.`,
  });
  hits.push({
    tag: forecast.acceptProbability > 0.5 ? "good" : "watch",
    text: `Forecast: ${forecast.band} · top ${forecast.topPercentile}% of ${forecast.venueName} submissions would score higher.`,
  });
  return hits.slice(0, 3);
}

// ───────────────────────────────────────────────────────────────────────────

function CriticTab({
  critic,
  active,
  status,
  onClick,
}: {
  critic: CriticReport;
  active: boolean;
  status: CriticStatus;
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
            : critic.tone === "preview"
              ? "text-warning border-warning/40 bg-warning/5"
              : "text-info border-info/40 bg-info/5",
        )}
      >
        {critic.icon}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground">
          {critic.label}
          {status === "busy" && (
            <Loader2 className="size-3 animate-spin text-subtle" />
          )}
        </div>
        <div
          className={cn(
            "text-[10px] font-mono uppercase tracking-[0.18em] mt-0.5",
            critic.tone === "shipped"
              ? "text-accent"
              : critic.tone === "preview"
                ? "text-warning"
                : "text-info",
          )}
        >
          {critic.badge}
        </div>
        <p className="text-[12px] text-muted leading-relaxed mt-2 line-clamp-3">
          {critic.summary}
        </p>
      </div>
    </button>
  );
}

function CriticReportCard({ critic }: { critic: CriticReport }) {
  const avg =
    critic.scores.length > 0
      ? critic.scores.reduce((a, s) => a + s.value, 0) / critic.scores.length
      : 0;
  const tone =
    critic.tone === "shipped"
      ? "accent"
      : critic.tone === "preview"
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
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-foreground truncate">
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
            {critic.scores.length > 0
              ? `avg ${Math.round(avg * 100)} / 100`
              : critic.badge}
          </div>
        </div>
        {critic.tone === "preview" && (
          <span className="ml-auto text-[10px] font-mono uppercase tracking-[0.18em] text-warning">
            preview overlay
          </span>
        )}
      </div>
      <div className="p-5 space-y-5">
        {critic.scores.length > 0 && (
          <div className="grid grid-cols-2 gap-x-5 gap-y-2">
            {critic.scores.map((s, i) => (
              <div key={s.name}>
                <div className="flex items-center justify-between text-[11.5px]">
                  <span className="text-muted truncate">{s.name}</span>
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
                    transition={{ duration: 0.5, delay: 0.04 * i }}
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
        )}
        {critic.hits.length > 0 && (
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
        )}
        {critic.extra}
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
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Local heuristic that mirrors the API fallback well enough for the harness.

function quickHeuristicReport(html: string, venue: string): AnalysisReport {
  const rubric = rubricForVenue(venue as VenueId);
  const text = htmlToPlain(html);
  const hasAbstract = /abstract/i.test(text);
  const hasLimitations = /limit|threats?\s+to\s+validity/i.test(text);
  const hasAblation = /ablat/i.test(text);
  const hasCitations = /(et\s+al\.|\[\d+\])/i.test(text);
  const hasSignificance = /(p[\s-]?value|confidence interval|±|std)/i.test(text);
  const longEnough = text.length > 800;

  const scores: RubricScore[] = rubric.dimensions.map((d) => {
    let score = 0.7;
    const name = d.name.toLowerCase();
    if (name.includes("citation") && !hasCitations) score = 0.32;
    if (name.includes("clarity") && !longEnough) score = 0.45;
    if (
      (name.includes("rigor") ||
        name.includes("method") ||
        name.includes("soundness")) &&
      !hasSignificance
    )
      score = 0.5;
    if (
      name.includes("reproduc") &&
      !/seed|code|github|hyper/i.test(text)
    )
      score = 0.4;
    return {
      name: d.name,
      score,
      note: "Heuristic score based on structural probes.",
      criteria: d.criteria.slice(0, 2),
    };
  });

  const issues: AnalysisIssue[] = [];
  if (!hasAbstract)
    issues.push(mkIssue("warning", "Structure", "No abstract detected."));
  if (!hasLimitations)
    issues.push(mkIssue("warning", "Rigor", "No explicit limitations section."));
  if (!hasAblation)
    issues.push(
      mkIssue("suggestion", "Soundness", "No ablation reported in the draft."),
    );
  if (!hasSignificance)
    issues.push(
      mkIssue(
        "warning",
        "Soundness",
        "No confidence interval / significance test on headline numbers.",
      ),
    );
  if (!hasCitations)
    issues.push(mkIssue("warning", "Citations", "No citations detected."));

  return {
    summary: `Heuristic review against the ${rubric.name} rubric. Run the analyzer in /app for an LLM-graded critique.`,
    scores,
    issues,
    venue: rubric.name,
    generatedAt: Date.now(),
  };
}

function mkIssue(
  severity: AnalysisIssue["severity"],
  category: string,
  message: string,
): AnalysisIssue {
  return {
    id: `i_${category}_${Math.random().toString(36).slice(2, 6)}`,
    severity,
    category,
    section: "Body",
    quote: "",
    message,
  };
}

function htmlToPlain(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|h[1-6]|li|tr|blockquote|div)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
