"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpenCheck,
  X,
  Check,
  Copy,
  Sparkles,
  Loader2,
} from "lucide-react";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { useAtlas, activePaper } from "@/lib/store";
import {
  BIB_FORMATS,
  type BibliographyFormat,
  formatBibliographyHtml,
} from "@/lib/bibliography";
import { cn } from "@/lib/cn";
import type { CitationCandidate, VerificationResult } from "@/types";

/**
 * Generate a References section for the active paper.
 *
 * Walks the paper's citation registry (populated when cite-mode candidates
 * or manual citation forms are accepted), renders each entry in the chosen
 * format, and either inserts the section at the end of the paper or copies
 * the HTML to the clipboard for paste into another tool.
 *
 * Fired by `atlas:open-references` from NavMenu + the command palette.
 */
export function ReferencesDialog() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener("atlas:open-references", on);
    return () => window.removeEventListener("atlas:open-references", on);
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
  const registry = useAtlas((s) =>
    paper ? s.citations[paper.id] ?? {} : {},
  );

  const [fmt, setFmt] = useState<BibliographyFormat>("apa");
  const [copied, setCopied] = useState(false);
  const [enriching, setEnriching] = useState<"idle" | "running" | "done">(
    "idle",
  );
  const [enrichSummary, setEnrichSummary] = useState<string>("");
  const registerCitation = useAtlas((s) => s.registerCitation);

  // Find which keys actually appear in the paper's HTML so we don't render
  // refs for citations the user deleted but whose metadata lingers in the
  // registry. Order of appearance matters for IEEE.
  const orderedRefs = useMemo<CitationCandidate[]>(() => {
    if (!paper) return [];
    const html = paper.html;
    const re = /data-key="([^"]+)"/g;
    const seen = new Set<string>();
    const out: CitationCandidate[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      const key = m[1];
      if (seen.has(key)) continue;
      seen.add(key);
      const meta = registry[key];
      if (meta) {
        out.push(meta);
      } else {
        // Citation chip in the paper but no metadata in the registry — synth
        // a minimal placeholder so the user sees "where's the title?" clearly.
        out.push({
          title: `[Missing metadata for ${key}]`,
          authors: [],
          year: null,
          doi: null,
          url: "",
          source: "manual",
          confidence: 0,
        });
      }
    }
    return out;
  }, [paper, registry]);

  const html = useMemo(
    () => formatBibliographyHtml(orderedRefs, fmt),
    [orderedRefs, fmt],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Find entries in the registry that look "thin" — title missing or empty,
  // no authors, year unknown. These are the manual-entry citations where
  // the user only typed the key (and maybe a URL) without going through the
  // Cite-mode candidate flow. Enrichment hits /api/verify-citation with
  // whatever signal we have (URL / DOI / key) and pulls back full metadata.
  const missingMetaKeys = useMemo(() => {
    return Object.entries(registry)
      .filter(([, c]) => {
        const isManual = c.source === "manual";
        const noTitle = !c.title || c.title === "[Missing metadata]";
        const noAuthors = !c.authors || c.authors.length === 0;
        return isManual || noTitle || noAuthors;
      })
      .map(([key, c]) => ({ key, candidate: c }));
  }, [registry]);

  async function enrichMissing() {
    if (!paper) return;
    setEnriching("running");
    setEnrichSummary("");
    let resolved = 0;
    let failed = 0;
    // Polite spacing between requests — CrossRef etc. ask wrappers to space
    // requests by ~100ms when running batches. The user-experienced latency
    // for 20 citations becomes ~3s which is fine for an explicit "enrich"
    // action; it avoids hammering the registries on long bibliographies.
    const PACE_MS = 150;
    for (let i = 0; i < missingMetaKeys.length; i++) {
      const { key, candidate } = missingMetaKeys[i];
      // Use DOI > URL > key as the query, in order of expected hit rate.
      const query = (candidate.doi || candidate.url || key).trim();
      if (!query) {
        failed++;
        continue;
      }
      try {
        const r = await fetch("/api/verify-citation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });
        if (!r.ok) {
          failed++;
        } else {
          const data = (await r.json()) as VerificationResult;
          if (data.resolved && data.best) {
            registerCitation(paper.id, key, data.best);
            resolved++;
          } else {
            failed++;
          }
        }
      } catch {
        failed++;
      }
      if (i < missingMetaKeys.length - 1) {
        await new Promise((res) => setTimeout(res, PACE_MS));
      }
    }
    setEnriching("done");
    setEnrichSummary(
      `${resolved} enriched, ${failed} couldn't resolve` +
        (resolved + failed === 0 ? " — nothing to enrich" : ""),
    );
    // Clear the "done" badge after 4s so the dialog doesn't accumulate.
    window.setTimeout(() => setEnriching("idle"), 4000);
  }

  function insert() {
    if (!paper) return;
    type EditorLike = {
      chain: () => {
        focus: () => {
          insertContentAt: (
            pos: number,
            html: string,
          ) => { run: () => void };
        };
        state: { doc: { content: { size: number } } };
      };
      state: { doc: { content: { size: number } } };
    };
    const ed = (window as unknown as { __atlasEditor?: EditorLike })
      .__atlasEditor;
    if (!ed) return;
    const end = ed.state.doc.content.size;
    ed.chain().focus().insertContentAt(end, html).run();
    onClose();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(html);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
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
        className="panel relative w-full max-w-[640px] max-h-[80vh] flex flex-col rounded-xl p-5 shadow-2xl"
      >
        <div className="flex items-center gap-2 mb-3">
          <BookOpenCheck className="size-4 text-accent" />
          <h3 className="text-[14px] font-semibold text-foreground">
            Generate references
          </h3>
          <button
            onClick={onClose}
            className="ml-auto size-6 rounded flex items-center justify-center text-subtle hover:text-foreground hover:bg-surface-2"
            aria-label="Close"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {BIB_FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFmt(f.id)}
              className={cn(
                "h-7 px-2 rounded text-[11px] border font-mono uppercase tracking-[0.1em]",
                fmt === f.id
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border bg-surface text-muted hover:text-foreground",
              )}
              title={f.example}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-[11.5px] text-subtle leading-relaxed">
            {orderedRefs.length === 0
              ? "No citations found in this paper. Insert citations via Cite mode or the / menu to populate."
              : `${orderedRefs.length} citation${orderedRefs.length === 1 ? "" : "s"} found.${
                  missingMetaKeys.length > 0
                    ? ` ${missingMetaKeys.length} missing metadata.`
                    : ""
                }`}
          </p>
          {missingMetaKeys.length > 0 && (
            <button
              type="button"
              onClick={enrichMissing}
              disabled={enriching === "running"}
              className="btn btn-ghost h-7 text-[11px] text-accent disabled:opacity-50 shrink-0"
              title="Resolve title / authors / year via CrossRef + OpenAlex + Semantic Scholar"
            >
              {enriching === "running" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              {enriching === "running"
                ? "Enriching…"
                : `Enrich missing (${missingMetaKeys.length})`}
            </button>
          )}
        </div>
        {enriching === "done" && enrichSummary && (
          <div className="text-[11px] text-subtle font-mono mb-2">
            {enrichSummary}
          </div>
        )}

        <div
          className="flex-1 overflow-y-auto border border-border rounded-md bg-surface-2/30 p-3 prose-reader text-[12.5px] leading-relaxed"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        <div className="flex items-center justify-end gap-2 pt-3">
          <button
            type="button"
            onClick={copy}
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
            {copied ? "Copied" : "Copy HTML"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost h-8 text-[12px] text-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={insert}
            disabled={orderedRefs.length === 0}
            className="btn btn-primary h-8 text-[12px] disabled:opacity-40"
          >
            <BookOpenCheck className="size-3.5" />
            Insert at end
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
