"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Highlighter,
  Sparkles,
  Globe,
  Wand2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAtlas } from "@/lib/store";

const STEPS = [
  {
    icon: <Highlighter className="size-4" />,
    title: "Mark up your draft",
    body: "Highlight any passage to open the bubble menu — bold, quote, highlight, citation. Press / for a block menu.",
  },
  {
    icon: <Sparkles className="size-4" />,
    title: "Edit with the agent",
    body: "Select text, then describe the edit (\"tighten this\", \"add a citation for ColBERT\"). Accept or reject the diff inline.",
    action: { label: "Open agent", run: () => useAtlas.getState().toggleAgent() },
  },
  {
    icon: <Globe className="size-4" />,
    title: "Validate every source",
    body: "Hit + in the tab bar to open a search tab. Browse the page, then click 'Cite this page' to pull the reference into the agent.",
  },
  {
    icon: <Wand2 className="size-4" />,
    title: "Critique the whole paper",
    body: "Run the Paper Critic for a structured report — clarity, structure, rigor, novelty, citations — with jump-to-line suggestions.",
    action: {
      label: "Run critic",
      run: () => useAtlas.getState().toggleAnalyzer(),
    },
  },
];

const STORAGE_KEY = "atlas:tour-seen";

export function HintStrip() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.localStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(() => setOpen(true), 700);
      return () => clearTimeout(t);
    }
    // Allow other parts of the app to replay the tour ("Help → Replay tour").
    const onReplay = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener("atlas:replay-tour", onReplay);
    return () => window.removeEventListener("atlas:replay-tour", onReplay);
  }, []);

  function dismiss() {
    setOpen(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 w-[520px] max-w-[92%] panel shadow-2xl rounded-xl overflow-hidden"
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface-2">
            <div className="size-6 rounded bg-accent-soft border border-[#2d3d12] flex items-center justify-center text-accent">
              {STEPS[step].icon}
            </div>
            <div className="text-[12px] font-medium tracking-tight">
              {STEPS[step].title}
            </div>
            <div className="ml-auto flex items-center gap-1">
              <span className="text-[10px] font-mono text-subtle">
                {step + 1} / {STEPS.length}
              </span>
              <button
                onClick={dismiss}
                className="size-6 rounded hover:bg-surface-3 flex items-center justify-center text-subtle"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>
          <div className="px-4 py-3">
            <p className="text-[13px] text-foreground leading-relaxed">
              {STEPS[step].body}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className="btn btn-ghost h-7 text-[11px] disabled:opacity-30"
              >
                <ChevronLeft className="size-3.5" /> Back
              </button>
              <div className="flex items-center gap-1">
                {STEPS.map((_, i) => (
                  <span
                    key={i}
                    className={
                      i === step
                        ? "size-1.5 rounded-full bg-accent"
                        : "size-1.5 rounded-full bg-border"
                    }
                  />
                ))}
              </div>
              {STEPS[step].action && (
                <button
                  onClick={() => {
                    STEPS[step].action!.run();
                  }}
                  className="ml-auto btn h-7 text-[11px]"
                >
                  {STEPS[step].action!.label}
                </button>
              )}
              {step < STEPS.length - 1 ? (
                <button
                  onClick={() => setStep((s) => s + 1)}
                  className="btn btn-primary h-7 text-[11px]"
                >
                  Next <ChevronRight className="size-3.5" />
                </button>
              ) : (
                <button
                  onClick={dismiss}
                  className="btn btn-primary h-7 text-[11px]"
                >
                  Start drafting
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
