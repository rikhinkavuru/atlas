"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pencil,
  Sparkles,
  ListChecks,
  Library,
  ArrowRight,
  X,
  ShieldCheck,
} from "lucide-react";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { useAtlas } from "@/lib/store";
import { cn } from "@/lib/cn";

type Mode = "edit" | "ask" | "plan" | "cite";

interface ModeCard {
  id: Mode;
  label: string;
  icon: React.ReactNode;
  description: string;
  example: string;
  accent: string; // tailwind text color class
}

const MODES: ModeCard[] = [
  {
    id: "edit",
    label: "Edit",
    icon: <Pencil className="size-3.5" />,
    description:
      "Rewrite a selection with diff-based proposals you accept or reject.",
    example: "Tighten this paragraph by 30% without losing meaning.",
    accent: "text-accent",
  },
  {
    id: "ask",
    label: "Ask",
    icon: <Sparkles className="size-3.5" />,
    description:
      "Chat with a co-author that knows your paper, voice, and venue rubric.",
    example: "What's the weakest part of the methods section?",
    accent: "text-info",
  },
  {
    id: "plan",
    label: "Plan",
    icon: <ListChecks className="size-3.5" />,
    description:
      "Get a multi-step revision plan you can review and step through.",
    example: "Plan a rebuttal addressing reviewer 2's three main concerns.",
    accent: "text-warning",
  },
  {
    id: "cite",
    label: "Cite",
    icon: <Library className="size-3.5" />,
    description:
      "Surface real citations for any claim — every source signed into the ledger.",
    example: "Find 3 foundational citations for retrieval-augmented generation.",
    accent: "text-accent",
  },
];

const SEEN_KEY = "atlas:welcome-seen";

export function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const ledgers = useAtlas((s) => s.ledgers);
  const papers = useAtlas((s) => s.papers);

  // First-run gate: only show when the user has never seen the modal AND the
  // workspace is genuinely fresh (no ledger events anywhere). Returning users
  // who've already authored content should not be greeted with onboarding.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem(SEEN_KEY);
    if (seen) return;
    const anyEvents = Object.values(ledgers).some(
      (l) => l && l.events.length > 0,
    );
    const fewPapers = Object.keys(papers).length <= 1;
    if (!anyEvents && fewPapers) {
      // Brief delay so the workspace paints first — the modal feels like an
      // intentional welcome, not a blocker on app boot.
      const t = window.setTimeout(() => setOpen(true), 350);
      return () => window.clearTimeout(t);
    }
  }, [ledgers, papers]);

  function dismiss() {
    setOpen(false);
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* private-mode browsers — no-op */
    }
  }

  function tryMode(mode: Mode, prompt: string) {
    dismiss();
    // Small delay so the modal's exit anim runs before the agent panel mounts.
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("atlas:set-agent-mode", { detail: { mode, prompt } }),
      );
    }, 180);
  }

  return (
    <AnimatePresence>
      {open && (
        <WelcomeModalContent
          onDismiss={dismiss}
          onTry={tryMode}
        />
      )}
    </AnimatePresence>
  );
}

function WelcomeModalContent({
  onDismiss,
  onTry,
}: {
  onDismiss: () => void;
  onTry: (mode: Mode, prompt: string) => void;
}) {
  const ref = useFocusTrap<HTMLDivElement>(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onDismiss}
    >
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal
        aria-labelledby="welcome-title"
        initial={{ opacity: 0, y: 10, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.985 }}
        transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="panel relative w-full max-w-[680px] rounded-2xl p-6 sm:p-8 shadow-2xl"
      >
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 size-7 rounded-md flex items-center justify-center text-subtle hover:text-foreground hover:bg-surface-2 transition-colors"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-center gap-2 mb-2 text-[10.5px] font-mono uppercase tracking-[0.18em] text-accent">
          <ShieldCheck className="size-3" />
          Welcome to Atlas
        </div>
        <h2
          id="welcome-title"
          className="text-[26px] sm:text-[30px] font-semibold tracking-tight text-foreground leading-[1.1]"
        >
          Four ways the agent works.
        </h2>
        <p className="mt-2 text-[13px] text-muted leading-relaxed max-w-[520px]">
          Pick one to try right now. Every AI action is signed into your
          provenance ledger — reviewers can verify it independently at{" "}
          <span className="text-foreground">/verify</span>.
        </p>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {MODES.map((m) => (
            <ModeTile key={m.id} mode={m} onTry={onTry} />
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between text-[11px] text-subtle">
          <span>
            Press <span className="kbd">⌘L</span> any time to open the agent.
          </span>
          <button
            onClick={onDismiss}
            className="text-muted hover:text-foreground transition-colors"
          >
            Skip & start writing
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ModeTile({
  mode,
  onTry,
}: {
  mode: ModeCard;
  onTry: (mode: Mode, prompt: string) => void;
}) {
  return (
    <div
      className={cn(
        "group relative panel p-3.5 rounded-xl hover:border-border-strong transition-colors",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "size-7 rounded-md bg-accent-soft border border-[#2d3d12] flex items-center justify-center",
            mode.accent,
          )}
        >
          {mode.icon}
        </span>
        <span className="text-[13.5px] font-semibold text-foreground">
          {mode.label}
        </span>
      </div>
      <p className="mt-2 text-[12px] text-muted leading-relaxed">
        {mode.description}
      </p>
      <p className="mt-2 text-[11.5px] text-subtle italic leading-snug line-clamp-2">
        “{mode.example}”
      </p>
      <button
        onClick={() => onTry(mode.id, mode.example)}
        className="mt-2.5 inline-flex items-center gap-1 text-[11.5px] text-accent hover:text-accent-hover transition-colors"
      >
        Try it
        <ArrowRight className="size-3" />
      </button>
    </div>
  );
}
