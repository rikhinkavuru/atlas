"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Style-coach hover popover. Replaces the browser `title` tooltip on
 * `.atlas-style` spans with a real card that has:
 *
 *   - The rule message (e.g. "Filler phrasing.")
 *   - The suggested fix
 *   - An "Apply" button that does the actual replacement when the fix is
 *     a concrete string (i.e. not a guidance note in parentheses)
 *   - A "Dismiss" button that closes the popover and hides this specific
 *     match for the rest of the session (a same-text dismissal applies to
 *     all instances of the same matched string).
 *
 * Lives at workspace level — listens on document.body for hovers over
 * style-coach decorations rather than per-decoration mount.
 */

interface PopoverState {
  rule: string;
  message: string;
  fix: string;
  matchedText: string;
  /** Absolute ProseMirror position of the start of the matched span. We
   *  pull these off the decoration's data attributes so Apply targets the
   *  specific instance the user hovered — not the first occurrence found
   *  by a doc-wide text search. */
  from: number;
  to: number;
  rect: DOMRect;
  /** Apply replaces the matched text via the live ProseMirror editor. */
  canApply: boolean;
}

// Per-session dismissed matches. Keyed by `${rule}::${matched}` so re-typing
// a dismissed phrase elsewhere doesn't suppress its underline again.
const dismissed = new Set<string>();

export function StyleCoachPopover() {
  const [state, setState] = useState<PopoverState | null>(null);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onMouseOver = (e: MouseEvent) => {
      if (pinned) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const el = target.closest<HTMLElement>(".atlas-style");
      if (!el) {
        setState(null);
        return;
      }
      const rule = el.getAttribute("data-style-rule") ?? "";
      const message = el.getAttribute("data-style-message") ?? "";
      const fix = el.getAttribute("data-style-fix") ?? "";
      const fromAttr = el.getAttribute("data-style-from");
      const toAttr = el.getAttribute("data-style-to");
      const matched = el.textContent ?? "";
      if (!rule || dismissed.has(`${rule}::${matched}`)) {
        setState(null);
        return;
      }
      const from = fromAttr ? parseInt(fromAttr, 10) : NaN;
      const to = toAttr ? parseInt(toAttr, 10) : NaN;
      const rect = el.getBoundingClientRect();
      // Apply makes sense only when the fix is a concrete replacement —
      // we filter out guidance-style fixes wrapped in parens.
      const canApply =
        fix.length > 0 &&
        !/^\(/.test(fix) &&
        fix !== matched &&
        Number.isFinite(from) &&
        Number.isFinite(to);
      setState({
        rule,
        message,
        fix,
        matchedText: matched,
        from,
        to,
        rect,
        canApply,
      });
    };
    const onMouseOut = (e: MouseEvent) => {
      if (pinned) return;
      // Close only when the mouse leaves the highlighted span entirely.
      const related = e.relatedTarget as HTMLElement | null;
      if (related && related.closest(".atlas-style")) return;
      // Brief delay so the user can move into the popover card without it
      // disappearing under their cursor.
      window.setTimeout(() => {
        if (!pinned) setState(null);
      }, 80);
    };
    document.body.addEventListener("mouseover", onMouseOver);
    document.body.addEventListener("mouseout", onMouseOut);
    return () => {
      document.body.removeEventListener("mouseover", onMouseOver);
      document.body.removeEventListener("mouseout", onMouseOut);
    };
  }, [pinned]);

  if (!state) return null;

  function dismiss() {
    if (state) {
      dismissed.add(`${state.rule}::${state.matchedText}`);
    }
    setPinned(false);
    setState(null);
  }

  function apply() {
    if (!state || !state.canApply) return;
    const editor = (window as unknown as { __atlasEditor?: AtlasEditor })
      .__atlasEditor;
    if (!editor) {
      setState(null);
      return;
    }
    // Use the exact positions captured on the decoration so multi-instance
    // phrases ("in order to" appearing three times in the doc) replace the
    // SPECIFIC one the user hovered, not whichever shows up first.
    const { from, to, fix, matchedText, rule } = state;
    const docSize = editor.view.state.doc.content.size;
    if (from < 0 || to > docSize || from >= to) {
      setState(null);
      return;
    }
    editor
      .chain()
      .focus()
      .setTextSelection({ from, to })
      .insertContent(fix)
      .run();
    dismissed.add(`${rule}::${matchedText}`);
    setPinned(false);
    setState(null);
  }

  // Positioned above the span by default; flip below if the span is near
  // the top of the viewport.
  const { rect } = state;
  const placeAbove = rect.top > 140;
  const style: React.CSSProperties = placeAbove
    ? {
        left: rect.left,
        bottom: window.innerHeight - rect.top + 8,
      }
    : {
        left: rect.left,
        top: rect.bottom + 8,
      };

  return createPortal(
    <div
      role="dialog"
      onMouseEnter={() => setPinned(true)}
      onMouseLeave={() => {
        setPinned(false);
        setState(null);
      }}
      className="fixed z-40 panel rounded-lg shadow-2xl p-3 w-[280px] max-w-[90vw] pointer-events-auto"
      style={style}
    >
      <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-mono uppercase tracking-[0.15em] text-subtle">
        <AlertTriangle className="size-3 text-warning" />
        <span>{state.rule.replace(/-/g, " ")}</span>
        <button
          onClick={dismiss}
          aria-label="Dismiss this match"
          className="ml-auto size-4 rounded text-subtle hover:text-foreground hover:bg-surface-2 flex items-center justify-center"
        >
          <X className="size-3" />
        </button>
      </div>
      <p className="text-[12px] text-foreground leading-snug mb-1.5">
        {state.message}
      </p>
      <div className="text-[11px] text-muted leading-snug mb-2 font-mono">
        <span className="text-warning line-through">{state.matchedText}</span>
        {state.canApply && (
          <>
            <span className="mx-1.5 text-subtle">→</span>
            <span className="text-accent">{state.fix}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-1.5 justify-end">
        <button
          onClick={dismiss}
          className="btn btn-ghost h-7 text-[11px] text-muted"
        >
          Dismiss
        </button>
        {state.canApply ? (
          <button
            onClick={apply}
            className="btn btn-primary h-7 text-[11px]"
          >
            <Sparkles className="size-3.5" />
            Apply
          </button>
        ) : (
          <span
            className={cn(
              "text-[10.5px] text-subtle italic px-1.5",
              "h-7 inline-flex items-center",
            )}
          >
            {state.fix || "(guidance only)"}
          </span>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Narrow shape for the editor handle stored on window.__atlasEditor. */
interface AtlasEditor {
  view: {
    state: {
      doc: {
        content: { size: number };
      };
    };
  };
  chain: () => {
    focus: () => {
      setTextSelection: (range: { from: number; to: number }) => {
        insertContent: (text: string) => { run: () => void };
      };
    };
  };
}
