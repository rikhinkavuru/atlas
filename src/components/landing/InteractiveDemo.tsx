"use client";

import { useEffect, useReducer, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Sparkles,
  ShieldCheck,
  Wand2,
  Check,
  RotateCcw,
  Library,
  Pencil,
  Target,
  Star,
} from "lucide-react";
import { cn } from "@/lib/cn";

type Scenario = "edit" | "cite" | "critique";

export function InteractiveDemo() {
  const [scenario, setScenario] = useState<Scenario>("edit");

  return (
    <div className="space-y-3">
      <ScenarioTabs scenario={scenario} setScenario={setScenario} />
      <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-[0_30px_80px_-30px_rgba(0,0,0,0.5)] relative">
        <Chrome scenario={scenario} />
        {scenario === "edit" && <EditScenario />}
        {scenario === "cite" && <CiteScenario />}
        {scenario === "critique" && <CritiqueScenario />}
      </div>
    </div>
  );
}

function ScenarioTabs({
  scenario,
  setScenario,
}: {
  scenario: Scenario;
  setScenario: (s: Scenario) => void;
}) {
  const items: {
    id: Scenario;
    icon: React.ReactNode;
    label: string;
    sub: string;
  }[] = [
    {
      id: "edit",
      icon: <Pencil className="size-3.5" />,
      label: "Edit",
      sub: "Tighten a sentence",
    },
    {
      id: "cite",
      icon: <Library className="size-3.5" />,
      label: "Cite",
      sub: "Verify a citation",
    },
    {
      id: "critique",
      icon: <Wand2 className="size-3.5" />,
      label: "Critique",
      sub: "Grade for NeurIPS",
    },
  ];
  return (
    <div className="flex items-center justify-center gap-1.5 flex-wrap">
      {items.map((it) => {
        const active = scenario === it.id;
        return (
          <button
            key={it.id}
            onClick={() => setScenario(it.id)}
            className={cn(
              "h-9 px-3.5 rounded-md text-[12px] inline-flex items-center gap-2 transition-colors border",
              active
                ? "bg-accent-soft border-accent/40 text-foreground"
                : "bg-surface border-border text-muted hover:text-foreground hover:border-border-strong",
            )}
          >
            <span className={cn(active ? "text-accent" : "text-subtle")}>
              {it.icon}
            </span>
            <span className="font-medium">{it.label}</span>
            <span className="text-subtle text-[11px] hidden sm:inline">
              · {it.sub}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Chrome({ scenario }: { scenario: Scenario }) {
  const subtitle =
    scenario === "edit"
      ? "atlas.app · workspace"
      : scenario === "cite"
        ? "atlas.app · cite mode"
        : "atlas.app · paper critic";
  return (
    <>
      <div className="h-9 flex items-center gap-2 px-4 border-b border-border bg-surface-2">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-[#ef4444]/50" />
          <span className="size-2.5 rounded-full bg-[#f59e0b]/50" />
          <span className="size-2.5 rounded-full bg-[#84cc16]/50" />
        </div>
        <div className="ml-4 px-3 h-5 rounded bg-background text-[10px] font-mono text-subtle flex items-center gap-1.5">
          <span className="size-1 rounded-full bg-accent" />
          {subtitle}
        </div>
      </div>
      <div className="h-9 flex items-stretch border-b border-border bg-background pl-2 gap-0.5">
        <div className="h-full flex items-center gap-2 px-3 text-[11.5px] text-foreground bg-surface relative">
          <FileText className="size-3.5 text-accent" />
          <span>AtlasRAG — draft</span>
          <span className="absolute left-0 right-0 top-0 h-px bg-accent" />
        </div>
      </div>
    </>
  );
}

/* ---------------------------- Edit scenario ---------------------------- */

type EditStage =
  | "idle"
  | "highlighted"
  | "agent-opening"
  | "agent-streaming"
  | "diff-ready"
  | "applied"
  | "rejected";

const EDIT_REASONING =
  "Tightening this. Same claim, half the words, with the verified ColBERTv2 citation already in your library kept inline.";

const EDIT_REWRITE =
  "We reject any answer whose citations cannot be matched to a retrieved sentence — a cheap, effective hallucination filter.";

function EditScenario() {
  const [state, dispatch] = useReducer(
    (
      s: { stage: EditStage; chars: number },
      a:
        | { type: "highlight" }
        | { type: "ask" }
        | { type: "thinking-done" }
        | { type: "stream-tick" }
        | { type: "accept" }
        | { type: "reject" }
        | { type: "reset" },
    ): { stage: EditStage; chars: number } => {
      switch (a.type) {
        case "highlight":
          return s.stage === "idle" ? { stage: "highlighted", chars: 0 } : s;
        case "ask":
          return s.stage === "highlighted"
            ? { stage: "agent-opening", chars: 0 }
            : s;
        case "thinking-done":
          return { stage: "agent-streaming", chars: 0 };
        case "stream-tick":
          return s.stage === "agent-streaming"
            ? {
                stage:
                  s.chars + 4 >= EDIT_REASONING.length
                    ? "diff-ready"
                    : "agent-streaming",
                chars: Math.min(EDIT_REASONING.length, s.chars + 4),
              }
            : s;
        case "accept":
          return s.stage === "diff-ready"
            ? { stage: "applied", chars: EDIT_REASONING.length }
            : s;
        case "reject":
          return s.stage === "diff-ready"
            ? { stage: "rejected", chars: EDIT_REASONING.length }
            : s;
        case "reset":
          return { stage: "idle", chars: 0 };
      }
    },
    { stage: "idle" as EditStage, chars: 0 },
  );

  useEffect(() => {
    if (state.stage === "agent-opening") {
      const t = setTimeout(() => dispatch({ type: "thinking-done" }), 700);
      return () => clearTimeout(t);
    }
  }, [state.stage]);

  useEffect(() => {
    if (state.stage === "agent-streaming") {
      const t = setTimeout(() => dispatch({ type: "stream-tick" }), 28);
      return () => clearTimeout(t);
    }
  }, [state.stage, state.chars]);

  const agentOpen = state.stage !== "idle" && state.stage !== "highlighted";

  return (
    <div className="grid grid-cols-[1fr_320px] h-[460px]">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 px-12 py-7 overflow-hidden font-serif text-[14px] text-foreground/90 leading-relaxed">
          <h2 className="text-[22px] font-sans font-semibold tracking-tight mb-2">
            3.3 Long-Context Reader
          </h2>
          <p className="mb-3">
            We pass the top-k passages plus their adjacent context windows
            into a 1M-token reader. The reader is prompted to emit answers as
            a JSON list of{" "}
            <span className="font-mono text-[12px]">(claim, citation)</span>{" "}
            pairs, where each citation must resolve to a sentence in the
            retrieved evidence.
          </p>
          <p className="relative">
            We{" "}
            <button
              type="button"
              onClick={() =>
                state.stage === "idle" ? dispatch({ type: "highlight" }) : null
              }
              disabled={state.stage !== "idle"}
              className={cn(
                "relative inline px-1 -mx-0.5 rounded transition-colors text-left",
                state.stage === "idle" &&
                  "cursor-pointer ring-1 ring-accent/60 hover:ring-2 hover:bg-accent-soft/40 animate-pulse-soft",
                state.stage !== "idle" &&
                  state.stage !== "applied" &&
                  state.stage !== "rejected" &&
                  "bg-accent/30 text-foreground",
                state.stage === "applied" &&
                  "bg-accent-soft text-foreground",
              )}
            >
              {state.stage === "applied"
                ? EDIT_REWRITE.replace(/^We\s/, "")
                : "reject answers whose citations cannot be string-matched back into the context, which is a cheap but surprisingly effective hallucination check"}
            </button>
            {state.stage !== "applied" && "."}
          </p>

          <AnimatePresence>
            {state.stage === "highlighted" && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
                className="absolute left-12 right-[60%] top-[180px] flex items-center gap-1 panel rounded-md p-1 shadow-2xl z-10"
              >
                <BubbleBtn>B</BubbleBtn>
                <BubbleBtn className="italic">I</BubbleBtn>
                <span className="w-px h-4 bg-border mx-0.5" />
                <button
                  onClick={() => dispatch({ type: "ask" })}
                  className="h-7 px-2 rounded text-[11px] inline-flex items-center gap-1.5 bg-accent text-accent-fg hover:bg-[#b7e23a] font-medium"
                >
                  <Sparkles className="size-3.5" />
                  Ask Atlas
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {(state.stage === "applied" || state.stage === "rejected") && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20"
            >
              <button
                onClick={() => dispatch({ type: "reset" })}
                className="btn h-8 text-[12px] shadow-lg"
              >
                <RotateCcw className="size-3.5" />
                Run again
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {state.stage === "idle" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.6 }}
              className="absolute right-5 bottom-5 max-w-[240px] panel p-3 rounded-lg shadow-2xl z-10"
            >
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-accent mb-1">
                Try it
              </div>
              <p className="text-[12px] text-muted leading-relaxed">
                Click the highlighted sentence. The agent rewrites it with
                sources; you accept or reject the diff.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <motion.div
        initial={false}
        animate={{ x: agentOpen ? 0 : 60, opacity: agentOpen ? 1 : 0.55 }}
        transition={{ type: "spring", stiffness: 220, damping: 26 }}
        className="border-l border-border bg-surface flex flex-col"
      >
        <PanelHeader stage={state.stage} />
        <div className="flex-1 overflow-hidden p-2.5 space-y-2 text-[11px]">
          {!agentOpen && (
            <div className="text-[11.5px] text-subtle italic">
              Idle. Highlight any passage and click Ask Atlas.
            </div>
          )}
          {agentOpen && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-end"
            >
              <div className="max-w-[88%] bg-surface-2 border border-border rounded-lg rounded-tr-sm px-2.5 py-1.5 text-foreground">
                Tighten this — less marketing, no jargon shifts.
              </div>
            </motion.div>
          )}
          {agentOpen && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-1.5"
            >
              <div className="size-5 rounded-md bg-accent-soft border border-[#2d3d12] shrink-0 flex items-center justify-center mt-0.5">
                <Sparkles className="size-2.5 text-accent" />
              </div>
              <div className="min-w-0 flex-1 text-foreground leading-relaxed">
                {state.stage === "agent-opening" && (
                  <span className="text-subtle italic">connecting…</span>
                )}
                {state.stage === "agent-streaming" && (
                  <>
                    {EDIT_REASONING.slice(0, state.chars)}
                    <span className="inline-block ml-1 align-middle size-1.5 rounded-full bg-accent pulse-dot" />
                  </>
                )}
                {(state.stage === "diff-ready" ||
                  state.stage === "applied" ||
                  state.stage === "rejected") &&
                  EDIT_REASONING}
              </div>
            </motion.div>
          )}
          <AnimatePresence>
            {(state.stage === "diff-ready" ||
              state.stage === "applied" ||
              state.stage === "rejected") && (
              <ProposalCard
                stage={state.stage}
                onAccept={() => dispatch({ type: "accept" })}
                onReject={() => dispatch({ type: "reject" })}
              />
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

function ProposalCard({
  stage,
  onAccept,
  onReject,
}: {
  stage: EditStage;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={cn(
        "rounded-md border bg-background overflow-hidden",
        stage === "applied"
          ? "border-accent"
          : stage === "rejected"
            ? "border-border opacity-60"
            : "border-border",
      )}
    >
      <div className="flex items-center justify-between px-2 py-1 border-b border-border bg-surface-2 text-[9px] font-mono uppercase tracking-[0.15em] text-subtle">
        <span className="flex items-center gap-1">
          <Wand2 className="size-2.5" />
          Proposed edit
        </span>
        {stage === "applied" && (
          <span className="flex items-center gap-1 text-accent">
            <Check className="size-2.5" />
            Applied
          </span>
        )}
        {stage === "rejected" && <span className="text-subtle">Dismissed</span>}
      </div>
      <div className="p-2 space-y-1.5">
        <div className="text-[9px] font-mono uppercase tracking-[0.12em] text-subtle">
          After
        </div>
        <div className="px-1.5 py-1 rounded bg-accent-soft border border-[#2d3d12] text-[11px] text-foreground leading-snug">
          {EDIT_REWRITE}
        </div>
        <div className="text-[9px] font-mono uppercase tracking-[0.12em] text-subtle pt-0.5">
          Supported by · 2
        </div>
        <div className="border-l-2 border-accent/40 pl-1.5 text-[9.5px] text-muted italic">
          <ShieldCheck className="size-2 inline text-accent mr-1" />
          “reject answers whose citations cannot be string-matched”
        </div>
        <div className="border-l-2 border-accent/40 pl-1.5 text-[9.5px] text-muted italic">
          <ShieldCheck className="size-2 inline text-accent mr-1" />
          Khattab &amp; Zaharia 2020 · ColBERT
        </div>
        {stage === "diff-ready" && (
          <div className="flex gap-1 pt-1.5">
            <button
              onClick={onReject}
              className="h-6 px-2 rounded text-[10px] border border-border text-muted hover:text-foreground hover:bg-surface-2"
            >
              Reject
            </button>
            <button
              onClick={onAccept}
              className="h-6 px-2 rounded text-[10px] bg-accent text-accent-fg hover:bg-[#b7e23a] flex items-center gap-1 font-medium"
            >
              <Check className="size-2.5" />
              Accept
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ---------------------------- Cite scenario ---------------------------- */

type CiteStage = "idle" | "searching" | "results" | "inserted";

const CITE_QUERY =
  "claim: long-context retrieval improves on ColBERT-style ranking";
const CITE_RESULTS = [
  {
    source: "crossref",
    title: "ColBERTv2: Effective and Efficient Retrieval via Lightweight Late Interaction",
    authors: "Santhanam et al.",
    year: 2022,
    confidence: 98,
    doi: "10.18653/v1/2022.naacl-main.272",
  },
  {
    source: "nia",
    title: "RetroLM: long-context retrieval-aware modeling",
    authors: "Liu et al.",
    year: 2024,
    confidence: 91,
    doi: "10.5555/retrolm2024",
  },
  {
    source: "semanticscholar",
    title: "Lost in the Middle: How Language Models Use Long Contexts",
    authors: "Liu et al.",
    year: 2023,
    confidence: 74,
    doi: null,
  },
];

function CiteScenario() {
  const [stage, setStage] = useState<CiteStage>("idle");
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    if (stage === "searching") {
      const t = setTimeout(() => setStage("results"), 900);
      return () => clearTimeout(t);
    }
  }, [stage]);

  return (
    <div className="grid grid-cols-[1fr_340px] h-[460px]">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 px-12 py-7 overflow-hidden font-serif text-[14px] text-foreground/90 leading-relaxed">
          <h2 className="text-[22px] font-sans font-semibold tracking-tight mb-2">
            2. Related Work
          </h2>
          <p>
            Dense retrieval over scientific text has been studied extensively.{" "}
            <span
              className={cn(
                "relative inline px-1 -mx-0.5 rounded transition-colors",
                stage === "inserted" && "bg-accent-soft text-foreground",
              )}
            >
              Recent work explores hybrid sparse–dense retrieval and learned
              re-rankers
              {stage === "inserted" && selected !== null && (
                <CitationChip result={CITE_RESULTS[selected]} />
              )}
            </span>
            , while long-context language models have grown from 8K to over 1M
            tokens in the past eighteen months.
          </p>
        </div>
        <AnimatePresence>
          {stage === "idle" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute right-5 bottom-5 max-w-[240px] panel p-3 rounded-lg shadow-2xl z-10"
            >
              <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-accent mb-1">
                Try it
              </div>
              <p className="text-[12px] text-muted leading-relaxed">
                Click <strong>Find citations</strong> in the agent panel. Atlas
                queries CrossRef, OpenAlex, Semantic Scholar, and your Nia
                library in parallel.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {stage === "inserted" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20"
            >
              <button
                onClick={() => {
                  setStage("idle");
                  setSelected(null);
                }}
                className="btn h-8 text-[12px] shadow-lg"
              >
                <RotateCcw className="size-3.5" />
                Run again
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="border-l border-border bg-surface flex flex-col">
        <div className="h-8 px-2.5 flex items-center gap-1.5 border-b border-border">
          <Library className="size-3 text-accent" />
          <span className="text-[11px] font-semibold">Cite mode</span>
          <span className="ml-auto text-[9px] font-mono text-subtle uppercase tracking-[0.15em]">
            {stage === "searching"
              ? "searching"
              : stage === "results"
                ? `${CITE_RESULTS.length} matches`
                : stage === "inserted"
                  ? "inserted"
                  : "idle"}
          </span>
        </div>
        <div className="flex-1 overflow-hidden p-2.5 space-y-2 text-[11px]">
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-subtle">
            Query
          </div>
          <div className="px-2 py-1.5 rounded bg-background border border-border text-[11px] text-foreground italic">
            {CITE_QUERY}
          </div>
          {stage === "idle" && (
            <button
              onClick={() => setStage("searching")}
              className="btn btn-primary h-8 text-[11.5px] w-full mt-2"
            >
              <Sparkles className="size-3.5" />
              Find citations
            </button>
          )}
          {stage === "searching" && (
            <div className="space-y-2 mt-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 rounded border border-border bg-surface-2 shimmer"
                />
              ))}
            </div>
          )}
          {(stage === "results" || stage === "inserted") && (
            <ul className="space-y-1.5 mt-1">
              {CITE_RESULTS.map((r, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className={cn(
                    "panel p-2 space-y-1 transition-colors cursor-pointer",
                    selected === i && "border-accent",
                  )}
                  onClick={() => {
                    setSelected(i);
                    setStage("inserted");
                  }}
                >
                  <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.1em] text-subtle">
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[9px]",
                        r.source === "crossref"
                          ? "text-accent bg-accent-soft border border-[#2d3d12]"
                          : r.source === "nia"
                            ? "text-info bg-info/10 border border-info/30"
                            : "text-foreground bg-surface-2 border border-border",
                      )}
                    >
                      {r.source}
                    </span>
                    <span
                      className={cn(
                        "font-mono",
                        r.confidence >= 90
                          ? "text-accent"
                          : r.confidence >= 70
                            ? "text-info"
                            : "text-warning",
                      )}
                    >
                      {r.confidence}%
                    </span>
                    <span className="ml-auto">{r.year}</span>
                  </div>
                  <div className="text-[11.5px] font-medium text-foreground leading-snug">
                    {r.title}
                  </div>
                  <div className="text-[10.5px] text-muted">{r.authors}</div>
                </motion.li>
              ))}
            </ul>
          )}
          {stage === "inserted" && (
            <div className="mt-2 text-[10.5px] text-accent flex items-start gap-1">
              <Check className="size-2.5 mt-0.5 shrink-0" />
              <span>
                Citation inserted with DOI · verified, not fabricated.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CitationChip({
  result,
}: {
  result: (typeof CITE_RESULTS)[number];
}) {
  return (
    <span className="inline-flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono align-baseline bg-accent-soft border border-[#2d3d12] text-accent">
      <ShieldCheck className="size-2.5" />
      {result.authors.split(" ")[0]} {result.year}
    </span>
  );
}

/* -------------------------- Critique scenario -------------------------- */

type CritiqueStage = "idle" | "running" | "report";

const CRITIQUE_SCORES = [
  { name: "Clarity", value: 0.78, note: "Notation tight; figures self-explanatory." },
  { name: "Soundness", value: 0.42, note: "Confidence intervals missing on Table 2." },
  { name: "Novelty", value: 0.71, note: "Mechanism distinct from prior re-rankers." },
  { name: "Reproducibility", value: 0.55, note: "Compute budget unreported." },
  { name: "Citations", value: 0.83, note: "Canonical references present." },
];

function CritiqueScenario() {
  const [stage, setStage] = useState<CritiqueStage>("idle");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (stage === "running") {
      let p = 0;
      const id = setInterval(() => {
        p += 0.06 + Math.random() * 0.04;
        if (p >= 1) {
          setProgress(1);
          clearInterval(id);
          setTimeout(() => setStage("report"), 240);
        } else {
          setProgress(p);
        }
      }, 60);
      return () => clearInterval(id);
    }
  }, [stage]);

  const overall =
    CRITIQUE_SCORES.reduce((a, b) => a + b.value, 0) / CRITIQUE_SCORES.length;
  const acceptProbability = Math.round((overall * 0.65 + 0.05) * 100);

  return (
    <div className="grid grid-cols-[300px_1fr] h-[460px]">
      <div className="border-r border-border p-4 space-y-3 overflow-hidden">
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.15em] text-subtle">
          <Wand2 className="size-3 text-accent" />
          Venue · NeurIPS / ICML
        </div>
        {stage === "idle" && (
          <>
            <p className="text-[12px] text-muted leading-relaxed">
              The critic grades your draft against the NeurIPS rubric. Every
              score links back to the rubric line it was checked against and
              the verbatim passage that drove it.
            </p>
            <button
              onClick={() => {
                setStage("running");
                setProgress(0);
              }}
              className="btn btn-primary h-8 text-[11.5px] w-full"
            >
              <Sparkles className="size-3.5" />
              Run the critic
            </button>
          </>
        )}
        {stage === "running" && (
          <>
            <p className="text-[12px] text-muted">Reviewing the draft…</p>
            <div className="h-1 rounded-full bg-surface-3 overflow-hidden">
              <motion.span
                animate={{ width: `${progress * 100}%` }}
                transition={{ ease: "linear" }}
                className="block h-full bg-accent rounded-full"
              />
            </div>
            <div className="space-y-1.5 mt-1">
              {CRITIQUE_SCORES.map((s, i) => (
                <div
                  key={s.name}
                  className="text-[11px] flex items-center justify-between"
                >
                  <span className="text-muted">{s.name}</span>
                  <span className="text-subtle font-mono text-[9.5px]">
                    {progress > (i + 1) / CRITIQUE_SCORES.length
                      ? "done"
                      : progress > i / CRITIQUE_SCORES.length
                        ? "running"
                        : "queued"}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
        {stage === "report" && (
          <>
            <ul className="space-y-2">
              {CRITIQUE_SCORES.map((s, i) => (
                <motion.li
                  key={s.name}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted">{s.name}</span>
                    <span
                      className={cn(
                        "font-mono",
                        s.value >= 0.75
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
                      transition={{ delay: 0.1 + i * 0.05, duration: 0.5 }}
                      className={cn(
                        "block h-full rounded-full",
                        s.value >= 0.75
                          ? "bg-accent"
                          : s.value >= 0.5
                            ? "bg-warning"
                            : "bg-danger",
                      )}
                    />
                  </div>
                </motion.li>
              ))}
            </ul>
            <button
              onClick={() => {
                setStage("idle");
                setProgress(0);
              }}
              className="btn btn-ghost h-7 text-[11px] w-full mt-2"
            >
              <RotateCcw className="size-3.5" />
              Run again
            </button>
          </>
        )}
      </div>
      <div className="p-5 overflow-hidden space-y-3">
        {stage === "report" ? (
          <>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="panel p-3 rounded-lg"
            >
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-subtle mb-1">
                Submission forecast · NeurIPS
              </div>
              <div className="flex items-center gap-3">
                <div className="text-[28px] font-semibold tracking-tight text-accent">
                  {acceptProbability}%
                </div>
                <div className="text-[11.5px] text-muted leading-snug">
                  Borderline — soundness + reproducibility need work before
                  submission.
                </div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="panel p-3 rounded-lg space-y-2"
            >
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.12em]">
                <span className="px-1.5 py-0.5 rounded text-warning bg-warning/5 border border-warning/40">
                  warning
                </span>
                <span className="text-subtle">Soundness · 4. Experiments</span>
              </div>
              <div className="text-[12.5px] text-foreground">
                Headline number reported without uncertainty. Add confidence
                intervals on Table 2.
              </div>
              <div className="text-[10.5px] text-subtle flex items-start gap-1">
                <Target className="size-2.5 mt-0.5 shrink-0 text-accent" />
                Rubric: <em>error bars / confidence intervals reported for headline numbers.</em>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="panel p-3 rounded-lg space-y-2"
            >
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.12em]">
                <span className="px-1.5 py-0.5 rounded text-warning bg-warning/5 border border-warning/40">
                  warning
                </span>
                <span className="text-subtle">Reproducibility · Appendix</span>
              </div>
              <div className="text-[12.5px] text-foreground">
                No compute budget. Reviewers will flag this.
              </div>
              <div className="text-[10.5px] text-subtle flex items-start gap-1">
                <Target className="size-2.5 mt-0.5 shrink-0 text-accent" />
                Rubric: <em>compute budget reported.</em>
              </div>
            </motion.div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-[12px] text-subtle italic">
            {stage === "running"
              ? "Grading against the rubric…"
              : "Click Run the critic to grade the draft."}
          </div>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- Shared bits ----------------------------- */

function PanelHeader({ stage }: { stage: EditStage }) {
  return (
    <div className="h-8 px-2.5 flex items-center gap-1.5 border-b border-border">
      <Sparkles className="size-3 text-accent" />
      <span className="text-[11px] font-semibold">Atlas Agent</span>
      <span className="ml-auto text-[9px] font-mono text-subtle uppercase tracking-[0.15em]">
        {stage === "agent-opening" || stage === "agent-streaming"
          ? "thinking…"
          : stage === "diff-ready"
            ? "ready"
            : stage === "applied"
              ? "applied"
              : stage === "rejected"
                ? "dismissed"
                : "idle"}
      </span>
    </div>
  );
}

function BubbleBtn({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "h-7 w-7 rounded flex items-center justify-center text-[12px] text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}
