"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Link2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { collectXRefTargets, type XRefTarget } from "./xref";

/**
 * Inline cross-reference autocomplete.
 *
 * Triggered when the user types `\ref{`, `\autoref{`, or `\cref{` in the
 * editor. Pops a filterable picker at the cursor with every labeled
 * figure / table / section / equation in the document. Selecting an
 * entry deletes the typed trigger sequence and inserts the XRef node.
 *
 * This is a sister UI to the slash menu — same shape, smaller footprint.
 * Esc dismisses without inserting; clicking outside closes; the picker
 * re-filters as the user keeps typing inside the braces.
 */

export interface XRefAutoState {
  /** Editor position immediately AFTER the trigger's opening `{`. The
   *  filter text starts here. */
  from: number;
  x: number;
  y: number;
  /** Trigger length in characters (e.g. 5 for "\ref{", 6 for "\cref{"). */
  triggerLength: number;
}

export function XRefAutocomplete({
  editor,
  state,
  onClose,
}: {
  editor: Editor;
  state: XRefAutoState;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);

  // Track what the user has typed since the trigger landed; auto-close
  // when they type whitespace, a closing `}`, or move backwards before the
  // trigger.
  useEffect(() => {
    const update = () => {
      const sel = editor.state.selection;
      const to = sel.from;
      if (to < state.from) {
        onClose();
        return;
      }
      const slice = editor.state.doc.textBetween(state.from, to, " ", " ");
      if (/[\s}]/.test(slice)) {
        onClose();
        return;
      }
      setQuery(slice);
    };
    editor.on("selectionUpdate", update);
    editor.on("update", update);
    update();
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("update", update);
    };
  }, [editor, state.from, onClose]);

  // Collected on every render so newly added labels appear immediately.
  const candidates: XRefTarget[] = collectXRefTargets(editor.state.doc);
  const q = query.toLowerCase();
  const filtered = q
    ? candidates.filter(
        (c) =>
          c.label.toLowerCase().includes(q) ||
          c.kind.toLowerCase().includes(q) ||
          c.number.toLowerCase().includes(q),
      )
    : candidates;

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setActive((a) => Math.min(a + 1, Math.max(0, filtered.length - 1)));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setActive((a) => Math.max(0, a - 1));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        const t = filtered[active];
        if (t) insert(t);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [filtered, active, onClose]);

  function insert(t: XRefTarget) {
    // Delete back from the current cursor to before the trigger (the `\`).
    const triggerStart = state.from - state.triggerLength;
    const cursor = editor.state.selection.from;
    editor
      .chain()
      .focus()
      .deleteRange({ from: triggerStart, to: cursor })
      .insertXRef(t.label)
      .run();
    onClose();
  }

  // Clamp X so the picker doesn't escape the viewport.
  const clampedX =
    typeof window !== "undefined"
      ? Math.max(8, Math.min(state.x, window.innerWidth - 340))
      : state.x;

  return (
    <div
      ref={ref}
      className="fixed z-30 panel shadow-2xl w-[340px] max-w-[92vw] p-1 rounded-lg overflow-hidden"
      style={{ left: clampedX, top: state.y }}
      onMouseDown={(e) => e.preventDefault() /* keep editor focus */}
    >
      <div className="flex items-center justify-between px-2 py-1.5 text-[10px] uppercase tracking-[0.15em] text-subtle">
        <span className="inline-flex items-center gap-1">
          <Link2 className="size-3" />
          Cross-reference
        </span>
        <span className="font-mono">{query || "—"}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cancel"
          className="h-4 w-4 rounded flex items-center justify-center text-subtle hover:text-foreground hover:bg-surface-2"
        >
          <X className="size-3" />
        </button>
      </div>
      <div className="max-h-60 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="px-3 py-2 text-[11.5px] text-subtle">
            {candidates.length === 0
              ? "No labeled figures, tables, sections, or equations yet."
              : "No matches."}
          </div>
        )}
        {filtered.map((c, i) => (
          <button
            key={`${c.kind}-${c.label}`}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              insert(c);
            }}
            onMouseEnter={() => setActive(i)}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1.5 text-[11.5px] text-left rounded",
              i === active ? "bg-surface-2 text-foreground" : "text-muted",
            )}
          >
            <span
              className={cn(
                "px-1 rounded text-[9.5px] font-mono uppercase tracking-[0.12em] shrink-0",
                c.kind === "figure" && "bg-accent-soft text-accent border border-accent/30",
                c.kind === "table" && "bg-info/10 text-info border border-info/30",
                c.kind === "section" && "bg-warning/5 text-warning border border-warning/30",
                c.kind === "equation" && "bg-foreground/5 text-foreground/80 border border-border",
              )}
            >
              {c.kind === "equation" ? `eq (${c.number})` : `${c.kind} ${c.number}`}
            </span>
            <span className="font-mono text-subtle truncate">{c.label}</span>
          </button>
        ))}
      </div>
      <div className="px-2 py-1 text-[9.5px] text-subtle font-mono uppercase tracking-[0.12em]">
        ↑↓ navigate · ↵ insert · Esc cancel
      </div>
    </div>
  );
}
