"use client";

import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
} from "framer-motion";
import {
  X,
  Pause,
  Play,
  ChevronRight,
  ChevronLeft,
  ArrowUpRight,
  Upload,
  Sparkles,
  Check,
  ShieldCheck,
  Wand2,
  Inbox,
  Target,
  FileText,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { TourCursor } from "./TourCursor";

interface Chapter {
  id: string;
  duration: number; // ms
  title: string;
  caption: string;
  render: () => React.ReactNode;
}

export function TourModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const progress = useMotionValue(0);
  const smoothProgress = useSpring(progress, {
    stiffness: 90,
    damping: 22,
    mass: 0.5,
  });
  const tickRef = useRef<number | null>(null);

  const chapters = useMemo<Chapter[]>(
    () => [
      {
        id: "drop",
        duration: 4200,
        title: "1 · Drop a PDF",
        caption:
          "Atlas extracts the text, detects sections, and opens the paper for analysis — no upload server in the loop.",
        render: () => <DropScene />,
      },
      {
        id: "highlight",
        duration: 4400,
        title: "2 · Highlight, ask",
        caption:
          "Select any sentence and tell the agent what to do. Plain English in, a diff to review out.",
        render: () => <HighlightScene />,
      },
      {
        id: "diff",
        duration: 4800,
        title: "3 · Sourced diff, never silent",
        caption:
          "Every proposed edit shows the supporting quotes from your library or selection. Unsupported claims surface as 'Needs citation' before they touch the page.",
        render: () => <DiffScene />,
      },
      {
        id: "critic",
        duration: 4400,
        title: "4 · Reviewer-2 simulator",
        caption:
          "Pick a venue. The critic grades the draft against that venue's rubric and explains every score line by line.",
        render: () => <CriticScene />,
      },
      {
        id: "reviewers",
        duration: 4600,
        title: "5 · Respond to Reviewer 2",
        caption:
          "Paste reviewer text → Atlas splits it per item, drafts grounded responses in your voice, exports a venue-ready letter.",
        render: () => <ReviewerScene />,
      },
    ],
    [],
  );

  // Reset when opened.
  useEffect(() => {
    if (open) {
      setStep(0);
      setPaused(false);
      progress.set(0);
    }
  }, [open, progress]);

  // Animation loop using requestAnimationFrame so progress is smooth.
  useEffect(() => {
    if (!open) return;
    if (paused) return;
    let start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - start;
      const p = Math.min(1, elapsed / chapters[step].duration);
      progress.set(p);
      if (p >= 1) {
        if (step < chapters.length - 1) {
          setStep((s) => s + 1);
        } else {
          setStep(0);
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    tickRef.current = raf;
    return () => cancelAnimationFrame(raf);
  }, [open, paused, step, chapters, progress]);

  // Keyboard
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") {
        setStep((s) => Math.min(chapters.length - 1, s + 1));
        progress.set(0);
      } else if (e.key === "ArrowLeft") {
        setStep((s) => Math.max(0, s - 1));
        progress.set(0);
      } else if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, chapters.length, progress]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
          className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-8"
        >
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[1100px] panel rounded-2xl overflow-hidden shadow-[0_30px_120px_-30px_rgba(0,0,0,0.7)]"
          >
            {/* Top: progress dots + close */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface-2">
              <div className="flex items-center gap-1.5 flex-1">
                {chapters.map((c, i) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setStep(i);
                      progress.set(0);
                    }}
                    className="h-1.5 flex-1 max-w-[64px] rounded-full bg-surface-3 overflow-hidden relative"
                    aria-label={`Chapter ${i + 1}`}
                  >
                    {i < step && (
                      <span className="absolute inset-0 bg-accent" />
                    )}
                    {i === step && (
                      <motion.span
                        style={{ scaleX: smoothProgress }}
                        className="absolute inset-0 origin-left bg-accent"
                      />
                    )}
                  </button>
                ))}
              </div>
              <div className="text-[10.5px] font-mono uppercase tracking-[0.15em] text-subtle">
                {step + 1} / {chapters.length}
              </div>
              <button
                onClick={() => setPaused((p) => !p)}
                className="size-7 rounded-md text-muted hover:text-foreground hover:bg-surface flex items-center justify-center"
                aria-label={paused ? "Play" : "Pause"}
              >
                {paused ? (
                  <Play className="size-3.5" />
                ) : (
                  <Pause className="size-3.5" />
                )}
              </button>
              <button
                onClick={onClose}
                className="size-7 rounded-md text-muted hover:text-foreground hover:bg-surface flex items-center justify-center"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Stage */}
            <div className="relative aspect-[16/9] sm:aspect-[16/8.5] bg-background overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={chapters[step].id}
                  initial={{ opacity: 0, scale: 0.985 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.985 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="absolute inset-0"
                >
                  {chapters[step].render()}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Caption */}
            <div className="px-6 py-5 border-t border-border bg-surface flex items-center gap-5">
              <button
                onClick={() => {
                  setStep((s) => Math.max(0, s - 1));
                  progress.set(0);
                }}
                disabled={step === 0}
                className="size-9 rounded-md border border-border bg-background flex items-center justify-center text-muted hover:text-foreground disabled:opacity-30 shrink-0"
                aria-label="Previous"
              >
                <ChevronLeft className="size-4" />
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-mono uppercase tracking-[0.15em] text-accent">
                  {chapters[step].title}
                </div>
                <p className="text-[14px] text-foreground/90 leading-relaxed mt-1">
                  {chapters[step].caption}
                </p>
              </div>
              <Link
                href="/app"
                onClick={onClose}
                className="btn btn-primary h-9 text-[12.5px] shrink-0 hidden sm:inline-flex"
              >
                Try it for real
                <ArrowUpRight className="size-3.5" />
              </Link>
              <button
                onClick={() => {
                  if (step < chapters.length - 1) {
                    setStep((s) => s + 1);
                    progress.set(0);
                  } else {
                    onClose();
                  }
                }}
                className="size-9 rounded-md border border-border bg-background flex items-center justify-center text-muted hover:text-foreground shrink-0"
                aria-label="Next"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ----------------------------- Scenes ----------------------------- */

function SceneFrame({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="h-full w-full p-6 sm:p-10">
      <div className="h-full w-full rounded-xl border border-border bg-surface overflow-hidden flex flex-col shadow-2xl">
        <div className="h-7 flex items-center gap-2 px-3 border-b border-border bg-surface-2 text-[10px] font-mono uppercase tracking-[0.15em] text-subtle">
          <span className="size-1.5 rounded-full bg-accent" />
          {label}
        </div>
        <div className="flex-1 min-h-0 relative">{children}</div>
      </div>
    </div>
  );
}

function DropScene() {
  return (
    <SceneFrame label="atlas / import">
      <div className="absolute inset-0 p-8 sm:p-12 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.94, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-[520px] border-2 border-dashed border-accent rounded-2xl bg-accent-soft/20 p-10 text-center relative"
        >
          <motion.div
            animate={{ y: [-8, 4, -8] }}
            transition={{ duration: 2.6, ease: "easeInOut", repeat: Infinity }}
            className="flex justify-center mb-4"
          >
            <div className="size-14 rounded-xl border border-accent bg-accent-soft flex items-center justify-center text-accent">
              <Upload className="size-7" />
            </div>
          </motion.div>
          <div className="text-foreground text-[20px] font-semibold tracking-tight">
            Drop a PDF anywhere
          </div>
          <div className="text-muted text-[13px] mt-2">
            Text extracted in-browser. Sections detected. Workspace opens.
          </div>
          <div className="mt-7 grid grid-cols-3 gap-2 text-left">
            {["Vaswani · Attention", "Lewis · RAG", "Brown · GPT-3"].map(
              (t, i) => (
                <motion.div
                  key={t}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + i * 0.18, duration: 0.4 }}
                  className="panel p-2.5 text-[11.5px] text-foreground flex items-center gap-1.5"
                >
                  <FileText className="size-3 text-accent shrink-0" />
                  <span className="truncate">{t}</span>
                </motion.div>
              ),
            )}
          </div>
        </motion.div>
      </div>
      <TourCursor
        duration={4}
        steps={[
          { x: 0.08, y: 0.12, hold: 1 },
          { x: 0.5, y: 0.45, hold: 1.6 },
          { x: 0.5, y: 0.4, hold: 0.4, click: true, label: "release" },
          { x: 0.5, y: 0.4, hold: 0.6 },
        ]}
      />
    </SceneFrame>
  );
}

function HighlightScene() {
  return (
    <SceneFrame label="atlasrag — draft">
      <div className="absolute inset-0 px-8 sm:px-16 py-8 sm:py-12 overflow-hidden font-serif text-[15px] text-foreground/90 leading-relaxed">
        <motion.h2
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[26px] font-sans font-semibold tracking-tight mb-4"
        >
          3.3 Long-Context Reader
        </motion.h2>
        <p className="mb-4">
          We pass the top-k passages plus their adjacent context windows into a
          1M-token reader. The reader emits answers as JSON pairs of{" "}
          <span className="font-mono text-[13px]">(claim, citation)</span>.
        </p>
        <p>
          We{" "}
          <motion.span
            initial={{ backgroundColor: "rgba(0,0,0,0)" }}
            animate={{
              backgroundColor: [
                "rgba(0,0,0,0)",
                "color-mix(in srgb, var(--accent) 35%, transparent)",
                "color-mix(in srgb, var(--accent) 35%, transparent)",
              ],
            }}
            transition={{ duration: 1.6, times: [0, 0.4, 1] }}
            className="rounded px-1 relative inline"
          >
            reject answers whose citations cannot be string-matched back into
            the context
            <motion.span
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.6, type: "spring", stiffness: 300 }}
              className="absolute left-1/2 -translate-x-1/2 -bottom-12 flex items-center gap-1.5 px-2.5 h-8 rounded-lg panel shadow-2xl text-[11px] font-mono text-foreground whitespace-nowrap"
            >
              <Sparkles className="size-3 text-accent" />
              <span>Ask Atlas</span>
              <span className="kbd ml-1">⌘L</span>
            </motion.span>
          </motion.span>
          , a cheap but surprisingly effective hallucination check.
        </p>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.6, duration: 0.4 }}
          className="absolute right-8 sm:right-12 bottom-8 max-w-[300px] panel p-3 rounded-lg shadow-2xl"
        >
          <div className="text-[10.5px] font-mono uppercase tracking-[0.15em] text-subtle mb-1.5">
            You
          </div>
          <div className="text-[12.5px] text-foreground">
            Tighten this — less marketing, no jargon shifts.
          </div>
        </motion.div>
      </div>
      <TourCursor
        duration={4.2}
        steps={[
          { x: 0.85, y: 0.15, hold: 0.8 },
          { x: 0.18, y: 0.6, hold: 1 },
          { x: 0.88, y: 0.6, hold: 1.2, label: "select" },
          { x: 0.55, y: 0.72, hold: 0.6 },
          { x: 0.55, y: 0.72, hold: 0.3, click: true, label: "Ask Atlas ⌘L" },
          { x: 0.55, y: 0.72, hold: 0.6 },
        ]}
      />
    </SceneFrame>
  );
}

function DiffScene() {
  return (
    <SceneFrame label="agent · proposed edit">
      <div className="absolute inset-0 px-6 sm:px-12 py-6 sm:py-8 grid lg:grid-cols-[1fr_360px] gap-6">
        <div className="font-serif text-[13.5px] text-foreground/80 leading-relaxed">
          <h3 className="text-[20px] font-sans font-semibold tracking-tight mb-3">
            3.3 Long-Context Reader
          </h3>
          <p className="mb-3">
            We pass the top-k passages plus their adjacent context windows into
            a 1M-token reader.
          </p>
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="px-3 py-2 rounded bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.2)] text-[#fecaca]/90 line-through decoration-[rgba(239,68,68,0.6)] mb-2"
          >
            We reject answers whose citations cannot be string-matched back into
            the context, which is a cheap but surprisingly effective
            hallucination check.
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="px-3 py-2 rounded bg-accent-soft border border-[#2d3d12] text-foreground"
          >
            We reject any answer whose citations cannot be matched to a
            retrieved sentence — a cheap, effective hallucination filter.
          </motion.div>
        </div>
        <motion.div
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="panel rounded-lg overflow-hidden h-fit"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-2 text-[10px] font-mono uppercase tracking-[0.15em] text-subtle">
            <span className="flex items-center gap-1.5">
              <Wand2 className="size-3" />
              Proposed edit
            </span>
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 1.6, type: "spring", stiffness: 300 }}
              className="flex items-center gap-1 text-accent"
            >
              <Check className="size-3" /> Applied
            </motion.span>
          </div>
          <div className="p-3 space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-subtle">
              Supported by · 2
            </div>
            {[
              {
                origin: "selection",
                quote:
                  "reject answers whose citations cannot be string-matched back",
              },
              {
                origin: "library · Vaswani 2017",
                quote: "Attention permits unverifiable continuations to be filtered.",
              },
            ].map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.9 + i * 0.18 }}
                className="border-l-2 border-accent/50 pl-2 text-[11px] text-muted italic"
              >
                <ShieldCheck className="size-2.5 inline text-accent mr-1" />
                <span className="text-foreground not-italic font-medium">
                  {s.origin}
                </span>{" "}
                · &ldquo;{s.quote}&rdquo;
              </motion.div>
            ))}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
              className="text-[10px] font-mono uppercase tracking-[0.15em] text-warning"
            >
              Needs citation · 0
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.9 }}
              className="flex gap-1.5 pt-1"
            >
              <div className="h-7 px-2 rounded border border-border text-[11px] text-muted flex items-center">
                Reject
              </div>
              <div className="h-7 px-2 rounded bg-accent text-accent-fg text-[11px] flex items-center gap-1 font-medium">
                <Check className="size-3" />
                Accept
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
      <TourCursor
        duration={4.6}
        steps={[
          { x: 0.04, y: 0.12, hold: 0.7 },
          { x: 0.78, y: 0.62, hold: 1, label: "read sources" },
          { x: 0.92, y: 0.94, hold: 0.7 },
          { x: 0.92, y: 0.94, hold: 0.4, click: true, label: "Accept" },
          { x: 0.92, y: 0.94, hold: 0.6 },
        ]}
      />
    </SceneFrame>
  );
}

function CriticScene() {
  const scores = [
    { name: "Clarity", v: 0.78, note: "Notation is consistent." },
    {
      name: "Soundness",
      v: 0.42,
      note: "Confidence intervals missing in Table 2.",
    },
    { name: "Novelty", v: 0.71, note: "Mechanism distinct from prior work." },
    {
      name: "Reproducibility",
      v: 0.55,
      note: "Compute budget unreported.",
    },
    { name: "Citations", v: 0.83, note: "Canonical references present." },
  ];
  return (
    <SceneFrame label="critic · neurips rubric">
      <div className="absolute inset-0 grid grid-cols-[300px_1fr]">
        <div className="border-r border-border p-4 space-y-3 overflow-hidden">
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-subtle">
            Dimension scores
          </div>
          {scores.map((s, i) => (
            <motion.div
              key={s.name}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.12, duration: 0.35 }}
              className="space-y-1"
            >
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="text-muted">{s.name}</span>
                <span
                  className={
                    s.v >= 0.75
                      ? "text-accent font-mono"
                      : s.v >= 0.5
                        ? "text-warning font-mono"
                        : "text-danger font-mono"
                  }
                >
                  {Math.round(s.v * 100)}
                </span>
              </div>
              <div className="h-1 rounded-full bg-surface-3 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${s.v * 100}%` }}
                  transition={{ delay: i * 0.12 + 0.15, duration: 0.6, ease: "easeOut" }}
                  className={
                    s.v >= 0.75
                      ? "h-full bg-accent rounded-full"
                      : s.v >= 0.5
                        ? "h-full bg-warning rounded-full"
                        : "h-full bg-danger rounded-full"
                  }
                />
              </div>
              <p className="text-[10.5px] text-subtle">{s.note}</p>
            </motion.div>
          ))}
        </div>
        <div className="p-4 space-y-3 overflow-hidden">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="panel p-3"
          >
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-subtle mb-1">
              Reviewer summary · NeurIPS / ICML
            </div>
            <p className="text-[13px] leading-relaxed text-foreground">
              The contribution is real but the evaluation under-delivers.
              Add confidence intervals, two seeds, and a compute-budget line
              before resubmission. Signed off as Reviewer 2.
            </p>
          </motion.div>
          {[
            {
              cat: "Soundness",
              section: "4. Experiments",
              msg: "Headline number reported without uncertainty.",
              rubric:
                "Error bars / confidence intervals reported for headline numbers.",
            },
            {
              cat: "Reproducibility",
              section: "Appendix",
              msg: "No compute budget. Reviewers will flag this.",
              rubric: "Compute budget reported.",
            },
          ].map((iss, i) => (
            <motion.div
              key={iss.cat}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 + i * 0.18 }}
              className="panel p-3"
            >
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.12em] mb-1.5">
                <span className="px-1.5 py-0.5 rounded border border-warning/40 bg-warning/5 text-warning">
                  warning
                </span>
                <span className="text-subtle">
                  {iss.cat} · {iss.section}
                </span>
              </div>
              <div className="text-[12.5px] text-foreground leading-relaxed">
                {iss.msg}
              </div>
              <div className="text-[10.5px] text-subtle mt-1.5 flex items-start gap-1.5">
                <Target className="size-2.5 mt-0.5 text-accent shrink-0" />
                <span>Rubric: {iss.rubric}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      <TourCursor
        duration={4.2}
        steps={[
          { x: 0.96, y: 0.12, hold: 0.6 },
          { x: 0.18, y: 0.42, hold: 0.9, label: "scores" },
          { x: 0.78, y: 0.65, hold: 0.9 },
          { x: 0.78, y: 0.65, hold: 0.35, click: true, label: "jump to passage" },
          { x: 0.78, y: 0.65, hold: 0.6 },
        ]}
      />
    </SceneFrame>
  );
}

function ReviewerScene() {
  return (
    <SceneFrame label="response to reviewers · R1.1">
      <div className="absolute inset-0 px-6 sm:px-10 py-6 sm:py-8 overflow-hidden">
        <div className="flex items-center gap-2 mb-4">
          <span className="size-9 rounded-md bg-accent-soft border border-[#2d3d12] flex items-center justify-center text-accent">
            <Inbox className="size-4" />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-[13px] font-semibold text-foreground">
              Response to Reviewers
            </span>
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-subtle">
              3 / 4 drafted · 1 marked addressed
            </span>
          </div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="panel p-4 space-y-3 max-w-[760px]"
        >
          <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.12em] font-mono text-subtle">
            <span className="text-foreground font-semibold">#R1.1</span>
            <span>Reviewer 1</span>
            <span className="ml-auto px-1.5 py-0.5 rounded border border-info/40 bg-info/5 text-info">
              drafted
            </span>
          </div>
          <blockquote className="text-[13px] text-foreground border-l-2 border-border pl-3 leading-relaxed italic">
            The motivation in Section 1 is unclear. Please explain why
            long-context reading and retrieval are complementary rather than
            redundant.
          </blockquote>
          <div className="text-[10px] uppercase tracking-[0.12em] font-mono text-subtle">
            Drafted response
          </div>
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="p-3 rounded bg-surface border border-border text-[13px] leading-relaxed text-foreground"
          >
            We thank the reviewer. In the revision we added a paragraph at the
            end of Section 1 (lines 78–92) that contrasts the two approaches
            with concrete evidence from Section 4.2 showing where each fails
            independently and where the combination succeeds.
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4 }}
            className="flex items-center gap-2 text-[10.5px] pt-1"
          >
            <span className="px-1.5 py-0.5 rounded border border-[#2d3d12] bg-accent-soft text-accent flex items-center gap-1">
              <Check className="size-2.5" />
              matches author voice
            </span>
            <span className="text-subtle">grounded in §1 + §4.2</span>
            <span className="ml-auto text-accent flex items-center gap-1">
              <Check className="size-3" />
              Mark addressed
            </span>
          </motion.div>
        </motion.div>
      </div>
      <TourCursor
        duration={4.4}
        steps={[
          { x: 0.04, y: 0.92, hold: 0.7 },
          { x: 0.55, y: 0.7, hold: 1, label: "review draft" },
          { x: 0.84, y: 0.88, hold: 0.7 },
          { x: 0.84, y: 0.88, hold: 0.35, click: true, label: "Mark addressed" },
          { x: 0.84, y: 0.88, hold: 0.5 },
        ]}
      />
    </SceneFrame>
  );
}
