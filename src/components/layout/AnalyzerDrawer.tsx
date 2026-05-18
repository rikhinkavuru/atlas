"use client";

import {
  Wand2,
  X,
  Loader2,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  Quote,
  Lightbulb,
  Target,
  ChevronDown,
} from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useAtlas, activePaper } from "@/lib/store";
import { getModelHeaders, useSettings } from "@/lib/settings";
import { cn } from "@/lib/cn";
import { VENUE_PRESETS, type VenueId } from "@/lib/rubrics";
import { SubmissionForecastCard } from "./SubmissionForecast";
import { MultiVenueForecast } from "./MultiVenueForecast";
import type { AnalysisIssue, AnalysisReport } from "@/types";

const SEVERITY_COLOR: Record<AnalysisIssue["severity"], string> = {
  info: "text-info border-info/40 bg-info/5",
  suggestion: "text-accent border-[#2d3d12] bg-accent-soft",
  warning: "text-warning border-warning/40 bg-warning/5",
  error: "text-danger border-danger/40 bg-danger/5",
};

const SEVERITY_ICON: Record<AnalysisIssue["severity"], React.ReactNode> = {
  info: <Sparkles className="size-3.5" />,
  suggestion: <Lightbulb className="size-3.5" />,
  warning: <AlertTriangle className="size-3.5" />,
  error: <AlertTriangle className="size-3.5" />,
};

export function AnalyzerDrawer() {
  const paper = useAtlas((s) => activePaper(s));
  const toggleAnalyzer = useAtlas((s) => s.toggleAnalyzer);
  const report = useAtlas((s) => s.analysis);
  const setReport = useAtlas((s) => s.setAnalysis);
  const busy = useAtlas((s) => s.analysisBusy);
  const setBusy = useAtlas((s) => s.setAnalysisBusy);
  const venue = useSettings((s) => s.venue);
  const setVenue = useSettings((s) => s.setVenue);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedScore, setExpandedScore] = useState<string | null>(null);

  async function run(forVenue: VenueId = venue) {
    if (!paper) return;
    setBusy(true);
    try {
      const headers = { "Content-Type": "application/json", ...getModelHeaders() };
      // Override venue header for one-shot runs
      headers["x-venue" as keyof typeof headers] = forVenue;
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers,
        body: JSON.stringify({ title: paper.title, html: paper.html }),
      });
      const data = (await res.json()) as AnalysisReport;
      setReport(data);
    } catch {
      setReport({
        summary: "Analyzer is offline. Set an API key in Settings.",
        scores: [],
        issues: [],
        generatedAt: Date.now(),
      });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!report && !busy) run(venue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const issuesByCategory = (report?.issues ?? []).reduce(
    (acc, i) => {
      (acc[i.category] ??= []).push(i);
      return acc;
    },
    {} as Record<string, AnalysisIssue[]>,
  );

  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 40, opacity: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className="absolute bottom-0 left-0 right-0 z-20 h-[46%] border-t border-border bg-surface shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.6)] flex flex-col"
    >
      <div className="h-10 px-4 flex items-center gap-2 border-b border-border">
        <div className="size-6 rounded bg-accent-soft border border-[#2d3d12] flex items-center justify-center">
          <Wand2 className="size-3.5 text-accent" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[12px] font-semibold">Paper Critic</span>
          <span className="text-[10px] text-subtle font-mono uppercase tracking-[0.15em]">
            {busy
              ? "reviewing…"
              : report
                ? `reviewer 2 · ${report.venue ?? VENUE_PRESETS[venue].name}`
                : "idle"}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <VenuePicker
            value={venue}
            onChange={(v) => {
              setVenue(v);
              run(v);
            }}
            disabled={busy}
          />
          <button
            onClick={() => run(venue)}
            disabled={busy}
            className="btn h-7 text-[11px]"
          >
            {busy ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Reviewing
              </>
            ) : (
              <>
                <Sparkles className="size-3.5" /> Re-run
              </>
            )}
          </button>
          <button
            onClick={toggleAnalyzer}
            className="btn btn-ghost h-7 text-[11px]"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-[280px_1fr]">
        <div className="border-r border-border overflow-y-auto p-3 space-y-3">
          {busy && !report && (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 rounded bg-surface-2 shimmer border border-border"
                />
              ))}
            </div>
          )}
          {report?.scores.map((s) => {
            const isExpanded = expandedScore === s.name;
            return (
              <div key={s.name} className="space-y-1">
                <button
                  onClick={() =>
                    setExpandedScore(isExpanded ? null : s.name)
                  }
                  className="w-full flex items-center justify-between text-[11px] text-left"
                >
                  <span className="text-muted flex items-center gap-1">
                    <ChevronDown
                      className={cn(
                        "size-3 transition-transform",
                        !isExpanded && "-rotate-90",
                      )}
                    />
                    {s.name}
                  </span>
                  <span
                    className={cn(
                      "font-mono",
                      s.score >= 0.75
                        ? "text-accent"
                        : s.score >= 0.5
                          ? "text-warning"
                          : "text-danger",
                    )}
                  >
                    {Math.round(s.score * 100)}
                  </span>
                </button>
                <div className="h-1 rounded-full bg-surface-3 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      s.score >= 0.75
                        ? "bg-accent"
                        : s.score >= 0.5
                          ? "bg-warning"
                          : "bg-danger",
                    )}
                    style={{ width: `${s.score * 100}%` }}
                  />
                </div>
                <p className="text-[10.5px] text-subtle leading-relaxed">
                  {s.note}
                </p>
                {isExpanded && (
                  <div className="mt-1.5 space-y-2 text-[10.5px]">
                    {(s.criteria ?? []).length > 0 && (
                      <div>
                        <div className="text-subtle uppercase tracking-[0.12em] font-mono mb-1 text-[9.5px]">
                          Rubric criteria
                        </div>
                        <ul className="space-y-0.5">
                          {s.criteria?.map((c, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-1 text-muted leading-snug"
                            >
                              <Target className="size-2.5 mt-0.5 shrink-0 text-accent" />
                              <span>{c}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(s.evidence ?? []).length > 0 && (
                      <div>
                        <div className="text-subtle uppercase tracking-[0.12em] font-mono mb-1 text-[9.5px]">
                          Evidence in paper
                        </div>
                        <ul className="space-y-0.5">
                          {s.evidence?.map((e, i) => (
                            <li
                              key={i}
                              className="text-foreground italic border-l-2 border-border pl-1.5 cursor-pointer hover:text-accent"
                              onClick={() => jumpToQuote(e)}
                            >
                              &ldquo;{e}&rdquo;
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {report && (
            <div className="pt-2 border-t border-border">
              <div className="text-[10px] uppercase tracking-[0.15em] text-subtle mb-1.5 font-mono">
                Issues
              </div>
              <div className="space-y-0.5">
                <CategoryButton
                  label="All"
                  count={report.issues.length}
                  active={activeCategory === null}
                  onClick={() => setActiveCategory(null)}
                />
                {Object.entries(issuesByCategory).map(([cat, items]) => (
                  <CategoryButton
                    key={cat}
                    label={cat}
                    count={items.length}
                    active={activeCategory === cat}
                    onClick={() => setActiveCategory(cat)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="overflow-y-auto p-4 space-y-3">
          {report && report.scores.length > 0 && (
            <>
              <SubmissionForecastCard report={report} />
              <MultiVenueForecast report={report} />
            </>
          )}

          {report?.summary && (
            <div className="panel p-3">
              <div className="text-[10px] uppercase tracking-[0.15em] text-subtle font-mono mb-1">
                Reviewer summary · {report.venue ?? VENUE_PRESETS[venue].name}
              </div>
              <p className="text-sm text-foreground leading-relaxed">
                {report.summary}
              </p>
            </div>
          )}

          {busy && !report?.issues.length && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-20 rounded-md bg-surface-2 shimmer border border-border"
                />
              ))}
            </div>
          )}

          {report && report.issues.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-subtle">
              <CheckCircle2 className="size-4 text-accent" />
              No issues found. The paper reads cleanly for this venue.
            </div>
          )}

          {report?.issues
            .filter((i) => !activeCategory || i.category === activeCategory)
            .map((i) => (
              <IssueRow key={i.id} issue={i} />
            ))}
        </div>
      </div>
    </motion.div>
  );
}

function VenuePicker({
  value,
  onChange,
  disabled,
}: {
  value: VenueId;
  onChange: (v: VenueId) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as VenueId)}
      disabled={disabled}
      className="h-7 bg-background border border-border rounded text-[11px] px-2 text-foreground hover:border-border-strong cursor-pointer"
      title="Choose target venue for the rubric"
    >
      {Object.values(VENUE_PRESETS).map((v) => (
        <option key={v.id} value={v.id}>
          {v.name}
        </option>
      ))}
    </select>
  );
}

function CategoryButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between px-2 py-1.5 rounded text-[11.5px]",
        active
          ? "bg-surface-2 text-foreground"
          : "text-muted hover:text-foreground hover:bg-surface-2",
      )}
    >
      <span>{label}</span>
      <span className="font-mono text-[10px] text-subtle">{count}</span>
    </button>
  );
}

function IssueRow({ issue }: { issue: AnalysisIssue }) {
  function jumpTo() {
    jumpToQuote(issue.quote);
  }
  return (
    <div className="panel p-3 hover:border-border-strong transition-colors">
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-[0.12em] border",
            SEVERITY_COLOR[issue.severity],
          )}
        >
          {SEVERITY_ICON[issue.severity]}
          {issue.severity}
        </span>
        <span className="text-[10px] uppercase tracking-[0.15em] text-subtle font-mono">
          {issue.category} · {issue.section}
        </span>
        <button
          onClick={jumpTo}
          className="ml-auto text-[10.5px] text-subtle hover:text-accent flex items-center gap-0.5"
        >
          Jump <ChevronRight className="size-3" />
        </button>
      </div>
      {issue.quote && (
        <div className="text-[12px] text-muted italic border-l-2 border-border pl-2 mb-2 line-clamp-2">
          <Quote className="size-3 inline-block mr-1 -mt-0.5 text-subtle" />
          {issue.quote}
        </div>
      )}
      <p className="text-[13px] text-foreground leading-relaxed">
        {issue.message}
      </p>
      {issue.suggestion && (
        <p className="text-[12px] text-accent mt-1.5 leading-relaxed">
          → {issue.suggestion}
        </p>
      )}
      {issue.rubricCriterion && (
        <p className="text-[10.5px] text-subtle mt-1.5 flex items-start gap-1">
          <Target className="size-2.5 mt-0.5 shrink-0 text-accent" />
          <span>Rubric: {issue.rubricCriterion}</span>
        </p>
      )}
    </div>
  );
}

function jumpToQuote(quote: string) {
  if (!quote) return;
  const matches = document.querySelectorAll(
    ".tiptap p, .tiptap h1, .tiptap h2, .tiptap h3, .tiptap blockquote, .tiptap li",
  );
  for (const el of Array.from(matches)) {
    if ((el.textContent ?? "").includes(quote.slice(0, 60))) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const original = (el as HTMLElement).style.boxShadow;
      (el as HTMLElement).style.transition = "box-shadow 0.4s ease";
      (el as HTMLElement).style.boxShadow = "0 0 0 2px var(--accent)";
      setTimeout(() => {
        (el as HTMLElement).style.boxShadow = original;
      }, 1400);
      return;
    }
  }
}
