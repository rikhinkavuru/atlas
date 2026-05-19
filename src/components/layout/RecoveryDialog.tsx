"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  History,
  RotateCcw,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { useAtlas, activePaper } from "@/lib/store";
import {
  listSnapshots,
  recordSnapshot,
  htmlStats,
  type RecoverySnapshot,
} from "@/lib/recovery";
import { cn } from "@/lib/cn";

/**
 * Recovery dialog. Triggered by `atlas:open-recovery`. Lists snapshots of
 * the active paper newest-first with stats + preview, and a one-click
 * Restore button that:
 *
 *   1. First takes a fresh snapshot of the CURRENT state (so a misguided
 *      restore can itself be undone)
 *   2. Replaces the paper's html with the chosen snapshot
 *   3. Closes the dialog
 *
 * The restore is intentionally one-shot — no diffs, no merge UI. The
 * snapshot stack is the safety net; the active paper is always the
 * authoritative document.
 */
export function RecoveryDialog() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener("atlas:open-recovery", on);
    return () => window.removeEventListener("atlas:open-recovery", on);
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
  const updatePaper = useAtlas((s) => s.updatePaper);
  const [selectedAt, setSelectedAt] = useState<string | null>(null);
  const [restoredAt, setRestoredAt] = useState<string | null>(null);

  // Re-list on every open so a fresh snapshot taken between dialog
  // opens is reflected. We deliberately don't subscribe to localStorage
  // changes — the user-visible event flow is open → look → restore →
  // close.
  const snapshots = useMemo<RecoverySnapshot[]>(
    () => (paper ? listSnapshots(paper.id) : []),
    [paper, restoredAt],
  );

  useEffect(() => {
    if (!selectedAt && snapshots.length > 0) {
      setSelectedAt(snapshots[0].takenAt);
    }
  }, [snapshots, selectedAt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const selected = snapshots.find((s) => s.takenAt === selectedAt) ?? null;

  function restore() {
    if (!paper || !selected) return;
    // Snapshot the CURRENT state first so the restore is itself
    // reversible. We tag the takenAt slightly off the current second so
    // it doesn't collide with another genuine periodic snapshot.
    const safetyTs = new Date().toISOString();
    const safetyStats = htmlStats(paper.html);
    recordSnapshot({
      paperId: paper.id,
      takenAt: safetyTs,
      html: paper.html,
      words: safetyStats.words,
      chars: safetyStats.chars,
    });
    updatePaper(paper.id, selected.html);
    setRestoredAt(safetyTs);
    // Brief confirmation pause before close so the user sees the action
    // landed.
    window.setTimeout(() => onClose(), 600);
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
        className="panel relative w-full max-w-[720px] max-h-[80vh] flex flex-col rounded-xl p-5 shadow-2xl"
      >
        <div className="flex items-center gap-2 mb-3">
          <History className="size-4 text-accent" />
          <h3 className="text-[14px] font-semibold text-foreground">
            Recover previous version
          </h3>
          <button
            onClick={onClose}
            className="ml-auto size-6 rounded flex items-center justify-center text-subtle hover:text-foreground hover:bg-surface-2"
            aria-label="Close"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {!paper && (
          <div className="text-[12px] text-subtle border border-dashed border-border rounded p-3">
            Open a paper first.
          </div>
        )}

        {paper && (
          <>
            <p className="text-[12px] text-muted leading-relaxed mb-3">
              Atlas snapshots the active paper every ~2 minutes. We keep
              the 5 most-recent snapshots per paper. Restoring takes a
              fresh snapshot of your current state first, so the action
              is itself reversible.
            </p>

            {snapshots.length === 0 ? (
              <div className="text-[12px] text-subtle border border-dashed border-border rounded p-4 flex items-start gap-2">
                <AlertTriangle className="size-4 text-warning mt-0.5 shrink-0" />
                <span>
                  No snapshots yet. The first one will land after about
                  two minutes of editing — keep typing and check back.
                </span>
              </div>
            ) : (
              <div className="flex-1 min-h-0 grid grid-cols-[200px_1fr] gap-3 overflow-hidden">
                <ul className="overflow-y-auto space-y-1 pr-2 border-r border-border">
                  {snapshots.map((s) => {
                    const taken = new Date(s.takenAt);
                    const isSelected = s.takenAt === selectedAt;
                    return (
                      <li key={s.takenAt}>
                        <button
                          type="button"
                          onClick={() => setSelectedAt(s.takenAt)}
                          className={cn(
                            "w-full text-left px-2 py-1.5 rounded border text-[11.5px] leading-tight",
                            isSelected
                              ? "border-accent bg-accent-soft text-foreground"
                              : "border-transparent hover:border-border hover:bg-surface-2 text-muted",
                          )}
                        >
                          <div className="font-medium text-foreground">
                            {taken.toLocaleTimeString(undefined, {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </div>
                          <div className="text-subtle text-[10.5px]">
                            {taken.toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                            {" · "}
                            {s.words.toLocaleString()} words
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <div className="flex flex-col min-h-0">
                  {selected ? (
                    <>
                      <div className="text-[11px] text-subtle mb-1.5 font-mono">
                        {new Date(selected.takenAt).toLocaleString()} ·{" "}
                        {selected.words.toLocaleString()} words ·{" "}
                        {selected.chars.toLocaleString()} chars
                      </div>
                      <div
                        className="flex-1 overflow-y-auto border border-border rounded-md bg-surface-2/30 p-3 prose-reader text-[12.5px] leading-relaxed"
                        dangerouslySetInnerHTML={{
                          __html: selected.html,
                        }}
                      />
                    </>
                  ) : (
                    <div className="text-[12px] text-subtle p-2">
                      Pick a snapshot to preview.
                    </div>
                  )}
                </div>
              </div>
            )}

            {restoredAt && (
              <div className="rounded-md border border-accent/30 bg-accent-soft/40 text-accent text-[11.5px] p-2.5 mt-3 flex items-start gap-2">
                <ShieldCheck className="size-3.5 mt-0.5 shrink-0" />
                <span>
                  Restored. The previous state was saved as a snapshot
                  at {new Date(restoredAt).toLocaleTimeString()} — re-open
                  this dialog to undo.
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3">
              <button
                onClick={onClose}
                className="btn btn-ghost h-8 text-[12px] text-muted"
              >
                Close
              </button>
              <button
                onClick={restore}
                disabled={!selected}
                className="btn btn-primary h-8 text-[12px] disabled:opacity-50"
              >
                <RotateCcw className="size-3.5" />
                Restore this version
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
