"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Download,
  Copy,
  Check,
  Printer,
  FileText,
  Inbox,
  ShieldAlert,
} from "lucide-react";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { useSettings } from "@/lib/settings";
import { cn } from "@/lib/cn";
import type { ReviewSession } from "@/types";
import {
  formatHtml,
  formatLatex,
  formatMarkdown,
  letterStats,
  type ResponseLetterFormat,
} from "@/lib/response-letter";

/**
 * Polished response-letter export. Three output formats (markdown / LaTeX /
 * HTML) with a live preview that respects the same toggles as the
 * downloaded artefact. Two booleans the user can flip before exporting:
 *  - Include rejected items (default on — honest)
 *  - Include pending-response stubs (default on — surfaces gaps)
 *
 * The HTML format opens in a new tab with `window.print()` set to fire
 * once the page loads, giving us "print to PDF" without bundling a PDF
 * library.
 */
export function ResponseLetterDialog({
  open,
  onClose,
  session,
  paperTitle,
}: {
  open: boolean;
  onClose: () => void;
  session: ReviewSession;
  paperTitle?: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <Body
          onClose={onClose}
          session={session}
          paperTitle={paperTitle}
        />
      )}
    </AnimatePresence>
  );
}

function Body({
  onClose,
  session,
  paperTitle,
}: {
  onClose: () => void;
  session: ReviewSession;
  paperTitle?: string;
}) {
  const ref = useFocusTrap<HTMLDivElement>(true);
  const authorName = useSettings((s) => s.authorName);

  const [fmt, setFmt] = useState<ResponseLetterFormat>("markdown");
  const [includeRejected, setIncludeRejected] = useState(true);
  const [includePending, setIncludePending] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const stats = useMemo(() => letterStats(session), [session]);

  const content = useMemo(() => {
    const opts = {
      paperTitle,
      authorName: authorName.trim() || undefined,
      includeRejected,
      includePending,
    };
    if (fmt === "markdown") return formatMarkdown(session, opts);
    if (fmt === "latex") return formatLatex(session, opts);
    return formatHtml(session, opts);
  }, [fmt, session, paperTitle, authorName, includeRejected, includePending]);

  function download() {
    const meta = FORMAT_META[fmt];
    const blob = new Blob([content], { type: meta.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `response-to-reviewers${meta.ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function printToPdf() {
    // Open the HTML version in a new tab and trigger the print dialog
    // automatically. The user's browser handles "Save as PDF" from the
    // print sheet. We bake an onload script into the HTML so this happens
    // without requiring a click in the new tab.
    const html =
      fmt === "html"
        ? content.replace(
            "</body>",
            "<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),200));</script></body>",
          )
        : (() => {
            const htmlVersion = formatHtml(session, {
              paperTitle,
              authorName: authorName.trim() || undefined,
              includeRejected,
              includePending,
            });
            return htmlVersion.replace(
              "</body>",
              "<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),200));</script></body>",
            );
          })();
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  // Drafted items HAVE a response already (just not marked addressed); the
  // warning should focus on items that genuinely lack a response (todo +
  // those drafted ones with an empty response field). Counting todo alone
  // matches reality without overstating the gap.
  const missingResponses = stats.todo;
  const reviewPending = stats.drafted;

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
        className="panel relative w-full max-w-[760px] max-h-[88vh] flex flex-col rounded-xl p-5 shadow-2xl"
      >
        <div className="flex items-center gap-2 mb-3">
          <Inbox className="size-4 text-accent" />
          <h3 className="text-[14px] font-semibold text-foreground">
            Export response-to-reviewers letter
          </h3>
          <button
            onClick={onClose}
            className="ml-auto size-6 rounded flex items-center justify-center text-subtle hover:text-foreground hover:bg-surface-2"
            aria-label="Close"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-3 mb-3 text-[11px] font-mono text-subtle">
          <span>
            <span className="text-foreground">{stats.total}</span> items
          </span>
          <span>
            <span className="text-accent">{stats.addressed}</span> addressed
          </span>
          <span>
            <span className="text-info">{stats.drafted}</span> drafted
          </span>
          {stats.todo > 0 && (
            <span className="text-warning">
              {stats.todo} not drafted yet
            </span>
          )}
          {stats.rejected > 0 && (
            <span className="text-warning">
              {stats.rejected} rejected
            </span>
          )}
        </div>

        {(missingResponses > 0 || reviewPending > 0) && (
          <div className="mb-3 rounded-md border border-warning/40 bg-warning/5 text-warning text-[11.5px] p-2 flex items-start gap-2">
            <ShieldAlert className="size-3.5 shrink-0 mt-0.5" />
            <span>
              {missingResponses > 0 && (
                <>
                  {missingResponses} item
                  {missingResponses === 1 ? "" : "s"} have no response yet —
                  the export will include &ldquo;[Response pending]&rdquo;
                  markers so you can find them.
                </>
              )}
              {missingResponses > 0 && reviewPending > 0 && " "}
              {reviewPending > 0 && (
                <>
                  {reviewPending} drafted but not yet marked addressed —
                  review before sending.
                </>
              )}
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mb-2">
          <div className="flex items-center gap-1">
            {(Object.keys(FORMAT_META) as ResponseLetterFormat[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFmt(f)}
                className={cn(
                  "h-7 px-2 rounded text-[11px] border font-mono uppercase tracking-[0.1em]",
                  fmt === f
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border bg-surface text-muted hover:text-foreground",
                )}
              >
                {FORMAT_META[f].label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1 text-[11px] text-muted cursor-pointer ml-2">
            <input
              type="checkbox"
              checked={includeRejected}
              onChange={(e) => setIncludeRejected(e.target.checked)}
              className="accent-accent"
            />
            Include rejected
          </label>
          <label className="flex items-center gap-1 text-[11px] text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={includePending}
              onChange={(e) => setIncludePending(e.target.checked)}
              className="accent-accent"
            />
            Include pending
          </label>
        </div>

        <div className="flex-1 overflow-y-auto border border-border rounded-md bg-surface-2/30 p-3 font-mono text-[11.5px] whitespace-pre-wrap leading-relaxed">
          {content}
        </div>

        <div className="flex items-center justify-end gap-2 pt-3">
          <button
            type="button"
            onClick={copyAll}
            className={cn(
              "btn btn-ghost h-8 text-[12px] text-muted",
              copied && "text-accent",
            )}
          >
            {copied ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={printToPdf}
            className="btn btn-ghost h-8 text-[12px] text-muted"
            title="Open in a new tab with print-to-PDF dialog"
          >
            <Printer className="size-3.5" />
            Print to PDF
          </button>
          <button
            type="button"
            onClick={download}
            className="btn btn-primary h-8 text-[12px]"
          >
            <Download className="size-3.5" />
            Download {FORMAT_META[fmt].ext}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

const FORMAT_META: Record<
  ResponseLetterFormat,
  { label: string; ext: string; mime: string }
> = {
  markdown: { label: "Markdown", ext: ".md", mime: "text/markdown" },
  latex: { label: "LaTeX", ext: ".tex", mime: "application/x-tex" },
  html: { label: "HTML", ext: ".html", mime: "text/html" },
};
