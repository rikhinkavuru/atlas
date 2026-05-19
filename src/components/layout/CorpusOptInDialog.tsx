"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  Beaker,
  X,
  Check,
  Upload,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { useAtlas, activePaper } from "@/lib/store";
import { useSettings } from "@/lib/settings";
import { buildReviewerModelTuple } from "@/lib/training-export";
import { cn } from "@/lib/cn";
import type { EditProposal } from "@/types";

/**
 * Per-paper opt-in for the Reviewer Model training corpus.
 *
 * Three states per paper:
 *   - "opt-in"   : this paper's anonymised tuple goes when collection opens
 *   - "opt-out"  : explicit reject — overrides the global default
 *   - "default"  : follow whatever the global default is (today: opt-out)
 *
 * The dialog also surfaces a "Submit now" button that POSTs to
 * /api/reviewer-model/training-export. Today the server returns
 * `stored: false` per the public promise — the round-trip exists so the
 * client integration is testable, and switches when training opens.
 *
 * Fired by `atlas:open-corpus-optin`.
 */
export function CorpusOptInDialog() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener("atlas:open-corpus-optin", on);
    return () => window.removeEventListener("atlas:open-corpus-optin", on);
  }, []);
  return (
    <AnimatePresence>
      {open && <Body onClose={() => setOpen(false)} />}
    </AnimatePresence>
  );
}

function Body({ onClose }: { onClose: () => void }) {
  const ref = useFocusTrap<HTMLDivElement>(true);
  const paper = useAtlas((s) => activePaper(s));
  const ledger = useAtlas((s) => (paper ? s.ledgers[paper.id] : undefined));
  const messages = useAtlas((s) => s.agentMessages);
  const analysis = useAtlas((s) => s.analysis);
  const forecast = useAtlas((s) =>
    paper ? s.forecasts[paper.id] : undefined,
  );

  const corpusOptInDefault = useSettings((s) => s.corpusOptInDefault);
  const corpusOptIn = useSettings((s) => s.corpusOptIn);
  const setCorpusOptIn = useSettings((s) => s.setCorpusOptIn);
  const toggleCorpusOptInDefault = useSettings(
    (s) => s.toggleCorpusOptInDefault,
  );
  const venue = useSettings((s) => s.venue);

  const explicit: boolean | undefined = paper
    ? corpusOptIn[paper.id]
    : undefined;
  const effective =
    typeof explicit === "boolean" ? explicit : corpusOptInDefault;

  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<
    null | { ok: boolean; message: string }
  >(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submitNow() {
    if (!paper) return;
    if (!effective) {
      setSubmitResult({
        ok: false,
        message:
          "This paper isn't opted in. Choose Opt in above, then submit.",
      });
      return;
    }
    setSubmitting(true);
    setSubmitResult(null);
    try {
      // Pull every proposal the agent has shown for this paper out of the
      // message log. Some may be pending (no decision yet) — those don't
      // become training signal until the user accepts/rejects.
      const proposalHistory: EditProposal[] = messages
        .map((m) => m.proposal)
        .filter((p): p is EditProposal => !!p && p.status !== "pending");
      const tuple = buildReviewerModelTuple({
        paper,
        ledger,
        analysis,
        forecast,
        venue,
        proposalHistory,
        decisionIfKnown: null,
      });
      const r = await fetch("/api/reviewer-model/training-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tuple }),
      });
      const data = (await r.json()) as {
        ok: boolean;
        stored?: boolean;
        nextTrainingRunDay?: string | null;
        error?: string;
      };
      if (!data.ok) {
        setSubmitResult({
          ok: false,
          message: `Rejected by server: ${data.error ?? "unknown"}`,
        });
      } else if (data.stored) {
        setSubmitResult({
          ok: true,
          message: `Submitted. Next training run: ${data.nextTrainingRunDay ?? "TBD"}.`,
        });
      } else {
        setSubmitResult({
          ok: true,
          message:
            "Validated. The corpus hasn't opened yet — your tuple wasn't stored, but your opt-in is recorded for when it does.",
        });
      }
    } catch (e) {
      setSubmitResult({
        ok: false,
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal
        initial={{ opacity: 0, y: 6, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 6, scale: 0.99 }}
        transition={{ duration: 0.18 }}
        onClick={(e) => e.stopPropagation()}
        className="panel relative w-full max-w-[560px] rounded-xl p-5 shadow-2xl"
      >
        <div className="flex items-center gap-2 mb-3">
          <Beaker className="size-4 text-accent" />
          <h3 className="text-[14px] font-semibold text-foreground">
            Reviewer-Model corpus opt-in
          </h3>
          <button
            onClick={onClose}
            className="ml-auto size-6 rounded flex items-center justify-center text-subtle hover:text-foreground hover:bg-surface-2"
            aria-label="Close"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <p className="text-[12.5px] text-muted leading-relaxed mb-3">
          When you opt in,{" "}
          <span className="text-foreground">
            {paper?.title || "this paper"}
          </span>{" "}
          contributes an anonymised tuple to the next training run.
          PII-stripping runs locally before the tuple ever leaves your
          machine. You can revoke any time — your record is wiped from the
          next run.
        </p>

        <div className="space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-subtle">
            This paper
          </div>
          <div className="grid grid-cols-3 gap-2">
            <OptionButton
              label="Opt in"
              active={explicit === true}
              accent="accent"
              icon={<ShieldCheck className="size-3" />}
              onClick={() => paper && setCorpusOptIn(paper.id, true)}
              desc="Send this tuple"
            />
            <OptionButton
              label="Opt out"
              active={explicit === false}
              accent="muted"
              icon={<X className="size-3" />}
              onClick={() => paper && setCorpusOptIn(paper.id, false)}
              desc="Skip this paper"
            />
            <OptionButton
              label="Use default"
              active={typeof explicit !== "boolean"}
              accent="subtle"
              icon={<Check className="size-3" />}
              onClick={() => paper && setCorpusOptIn(paper.id, null)}
              desc={`Today: ${corpusOptInDefault ? "opt-in" : "opt-out"}`}
            />
          </div>

          <div className="flex items-center gap-2 text-[11.5px] text-subtle pt-2">
            <span
              className={cn(
                "size-1.5 rounded-full",
                effective ? "bg-accent" : "bg-subtle",
              )}
            />
            <span>
              Effective for this paper:{" "}
              <span className={effective ? "text-accent" : "text-foreground"}>
                {effective ? "opted in" : "opted out"}
              </span>
            </span>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-border space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-subtle">
            Global default for new papers
          </div>
          <label className="flex items-center gap-2 text-[12.5px] cursor-pointer">
            <input
              type="checkbox"
              checked={corpusOptInDefault}
              onChange={toggleCorpusOptInDefault}
              className="accent-accent"
            />
            <span>
              Auto opt-in for new papers I create
              <span className="text-subtle font-mono text-[10.5px] ml-1.5">
                (per-paper choice always overrides this)
              </span>
            </span>
          </label>
        </div>

        {submitResult && (
          <div
            className={cn(
              "mt-4 text-[11.5px] rounded p-2 border flex items-start gap-1.5",
              submitResult.ok
                ? "border-accent/30 bg-accent-soft/40 text-accent"
                : "border-warning/40 bg-warning/5 text-warning",
            )}
          >
            {submitResult.ok ? (
              <Check className="size-3.5 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
            )}
            <span className="flex-1">{submitResult.message}</span>
          </div>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="btn btn-ghost h-8 text-[12px] text-muted"
          >
            Done
          </button>
          <button
            onClick={submitNow}
            disabled={submitting || !paper || !effective}
            className="btn btn-primary h-8 text-[12px] disabled:opacity-50"
            title={
              !effective
                ? "Opt this paper in to enable submit"
                : "Build the anonymised tuple and post to /api/reviewer-model/training-export"
            }
          >
            {submitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Submitting
              </>
            ) : (
              <>
                <Upload className="size-3.5" />
                Submit now
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function OptionButton({
  label,
  desc,
  active,
  accent,
  icon,
  onClick,
}: {
  label: string;
  desc: string;
  active: boolean;
  accent: "accent" | "muted" | "subtle";
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-2 py-2 text-left transition-colors",
        active
          ? accent === "accent"
            ? "border-accent bg-accent-soft text-accent"
            : "border-foreground/30 bg-surface-2 text-foreground"
          : "border-border bg-surface text-muted hover:border-border-strong",
      )}
    >
      <div className="flex items-center gap-1 text-[12px] font-semibold">
        {icon}
        {label}
      </div>
      <div className="text-[10px] text-subtle font-mono mt-0.5">{desc}</div>
    </button>
  );
}
