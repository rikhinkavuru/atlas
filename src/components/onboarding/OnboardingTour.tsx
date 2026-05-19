"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, X, PartyPopper } from "lucide-react";

/**
 * Multi-step guided tour shown after the WelcomeModal is dismissed.
 *
 * Each step points at a specific UI element via `data-tour="<id>"` (we
 * add these attrs throughout the app). The tour:
 *   1. Looks up the target element by its data-tour attribute
 *   2. Renders a translucent overlay with a hole cut out around the target
 *   3. Positions a tooltip card beside the cutout
 *   4. Re-measures on window resize / scroll
 *
 * Skipping or completing sets the localStorage flag so the tour doesn't
 * re-appear. The user can replay via Settings → About → Replay tour.
 */

const TOUR_KEY = "atlas:tour-seen";
const REPLAY_EVENT = "atlas:replay-tour";

interface Step {
  /** data-tour attribute the step's target element must carry. */
  target: string;
  title: string;
  body: string;
  /** Which side of the target to anchor the tooltip card. */
  side: "top" | "bottom" | "left" | "right";
}

const STEPS: Step[] = [
  {
    target: "topbar-agent",
    title: "Ask the agent any time",
    body: "Open the AI co-author panel with ⌘L. Edit / Ask / Plan / Cite modes do different things — pick the right one and the agent stays on rails.",
    side: "bottom",
  },
  {
    target: "topbar-analyze",
    title: "Run the Paper Critic",
    body: "⌘⇧A runs a rubric-graded peer review tuned to your chosen venue. The Reviewer-2 simulator predicts the questions a strict reviewer will ask.",
    side: "bottom",
  },
  {
    target: "topbar-trust",
    title: "Trust Meter — the moat surface",
    body: "Every AI action is hash-chained into a signed provenance ledger. The percentage shown is real: reviewers can verify it at /verify.",
    side: "bottom",
  },
  {
    target: "sidebar-ledger",
    title: "Provenance Ledger lives here",
    body: "Click the Ledger tab in the sidebar to see every signed event for this paper. File → Publish ledger turns it into a public URL.",
    side: "right",
  },
];

export function OnboardingTour() {
  const [step, setStep] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Fire the tour once after WelcomeModal is dismissed. We watch for
  // the welcome-seen localStorage key flipping to "1" + the tour-seen
  // key being absent, and start at step 0.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const tryStart = () => {
      const welcomeSeen = window.localStorage.getItem("atlas:welcome-seen");
      const tourSeen = window.localStorage.getItem(TOUR_KEY);
      if (welcomeSeen === "1" && !tourSeen) {
        // Brief delay so the workspace finishes mounting + the welcome
        // modal's exit animation can complete before we overlay.
        window.setTimeout(() => setStep(0), 500);
      }
    };
    tryStart();
    // Watch for storage changes from other tabs OR from the welcome modal
    // dismissing within the same tab.
    const handler = (e: StorageEvent) => {
      if (e.key === "atlas:welcome-seen") tryStart();
    };
    window.addEventListener("storage", handler);
    // Same-tab fallback: re-check on a short interval for ~5s after mount.
    let polls = 0;
    const poll = window.setInterval(() => {
      polls++;
      tryStart();
      if (polls > 10) window.clearInterval(poll);
    }, 500);
    // Replay event from Settings / ShortcutsModal / Help menu.
    const onReplay = () => {
      window.localStorage.removeItem(TOUR_KEY);
      setStep(0);
    };
    window.addEventListener(REPLAY_EVENT, onReplay);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener(REPLAY_EVENT, onReplay);
      window.clearInterval(poll);
    };
  }, []);

  // Re-measure the active step's target on resize / scroll. Without this
  // the overlay cutout would drift when the user scrolls or resizes.
  useLayoutEffect(() => {
    if (step === null) {
      setRect(null);
      return;
    }
    const target = document.querySelector<HTMLElement>(
      `[data-tour="${STEPS[step].target}"]`,
    );
    if (!target) {
      // Skip steps whose anchor isn't on screen (e.g. ledger tab needs a
      // paper open — when it isn't, jump forward).
      setStep((s) => (s !== null && s < STEPS.length - 1 ? s + 1 : null));
      return;
    }
    const measure = () => setRect(target.getBoundingClientRect());
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(target);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [step]);

  function dismiss() {
    try {
      window.localStorage.setItem(TOUR_KEY, "1");
    } catch {
      /* private-mode browsers — skip */
    }
    setStep(null);
  }

  function next() {
    if (step === null) return;
    if (step >= STEPS.length - 1) {
      dismiss();
      return;
    }
    setStep(step + 1);
  }

  function back() {
    if (step === null || step <= 0) return;
    setStep(step - 1);
  }

  if (step === null) return null;
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  return (
    <AnimatePresence>
      <motion.div
        key="tour"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 pointer-events-none"
      >
        {/* Dim overlay with a soft glow around the target. We render via
            inset box-shadow on the cutout so the rest of the screen darkens
            uniformly while the target stays visible at its real opacity. */}
        {rect && (
          <div
            className="fixed pointer-events-none transition-all duration-200"
            style={{
              left: rect.left - 6,
              top: rect.top - 6,
              width: rect.width + 12,
              height: rect.height + 12,
              borderRadius: 8,
              boxShadow:
                "0 0 0 9999px color-mix(in srgb, var(--background) 75%, transparent), 0 0 0 2px var(--accent)",
            }}
          />
        )}

        {/* Tooltip card. Positioned via fixed offsets relative to the
            target rect; falls back to centered when rect is missing. */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed panel rounded-lg shadow-2xl p-4 w-[360px] max-w-[90vw] pointer-events-auto"
          style={cardPosition(rect, current.side)}
        >
          <div className="flex items-start gap-2 mb-2">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-accent">
              Tour · {step + 1} / {STEPS.length}
            </div>
            <button
              onClick={dismiss}
              className="ml-auto size-6 rounded flex items-center justify-center text-subtle hover:text-foreground hover:bg-surface-2"
              aria-label="Skip tour"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <h3 className="text-[14px] font-semibold text-foreground mb-1.5">
            {current.title}
          </h3>
          <p className="text-[12.5px] text-muted leading-relaxed mb-3">
            {current.body}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={dismiss}
              className="btn btn-ghost h-7 text-[11px] text-muted mr-auto"
            >
              Skip
            </button>
            {step > 0 && (
              <button
                onClick={back}
                className="btn btn-ghost h-7 text-[11px] text-muted"
              >
                <ArrowLeft className="size-3.5" />
                Back
              </button>
            )}
            <button
              onClick={next}
              className="btn btn-primary h-7 text-[11px]"
            >
              {isLast ? (
                <>
                  <PartyPopper className="size-3.5" />
                  Done
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="size-3.5" />
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Compute the tooltip card position relative to the target's rect. We
 * bias to bottom when no rect is available (which happens at the very
 * first paint before the layout effect resolves).
 *
 * Known limitation: `side: "top"` and `side: "left"` use the CSS bottom /
 * right anchors, which can place the card off-screen when the target is
 * near the corresponding viewport edge (rect.top < card_height etc.).
 * The four steps currently in STEPS all use "bottom" or "right", so this
 * doesn't bite in practice. If a future step needs "top" or "left",
 * switch to a measured `top`-anchored layout using a ref on the card.
 */
function cardPosition(
  rect: DOMRect | null,
  side: Step["side"],
): React.CSSProperties {
  if (!rect) {
    return {
      left: "50%",
      bottom: 64,
      transform: "translateX(-50%)",
    };
  }
  const gap = 14;
  switch (side) {
    case "top":
      return { left: rect.left, bottom: window.innerHeight - rect.top + gap };
    case "left":
      return { top: rect.top, right: window.innerWidth - rect.left + gap };
    case "right":
      return { top: rect.top, left: rect.right + gap };
    default:
      return { left: rect.left, top: rect.bottom + gap };
  }
}
