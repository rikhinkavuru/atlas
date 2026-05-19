"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Package,
  Download,
  Loader2,
  AlertTriangle,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { useAtlas, activePaper } from "@/lib/store";
import { useSettings } from "@/lib/settings";
import {
  buildArxivBundle,
  listVenueTemplateOptions,
  type BundleResult,
} from "@/lib/arxiv-bundle";
import { cn } from "@/lib/cn";

/**
 * arXiv submission bundle dialog. Triggered by `atlas:open-arxiv-bundle`.
 * The user picks a venue template + authors line + whether to embed the
 * Atlas honesty badge, then clicks "Build bundle" to download a zip.
 *
 * The whole pipeline runs client-side via JSZip — paper text never crosses
 * our network.
 */
export function ArxivBundleDialog() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener("atlas:open-arxiv-bundle", on);
    return () => window.removeEventListener("atlas:open-arxiv-bundle", on);
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
  const authorName = useSettings((s) => s.authorName);

  const templates = useMemo(() => listVenueTemplateOptions(), []);
  const [authors, setAuthors] = useState(authorName || "");
  const [template, setTemplate] = useState(templates[0]?.id ?? "generic");
  const [embedBadge, setEmbedBadge] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BundleResult | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const hasLedger = ledger && ledger.events.length > 0;

  async function build() {
    if (!paper) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await buildArxivBundle({
        paper,
        authors: authors.trim() || "Anonymous Authors",
        venueTemplate: template,
        ledger: ledger ?? undefined,
        embedBadge: hasLedger && embedBadge,
      });
      setResult(r);
      const url = URL.createObjectURL(r.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = r.fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
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
        className="panel relative w-full max-w-[600px] rounded-xl p-5 shadow-2xl"
      >
        <div className="flex items-center gap-2 mb-3">
          <Package className="size-4 text-accent" />
          <h3 className="text-[14px] font-semibold text-foreground">
            Build arXiv submission bundle
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
          <div className="space-y-3">
            <p className="text-[12.5px] text-muted leading-relaxed">
              Atlas assembles a zip with the .tex, references.bib, optional
              signed ledger, and a README explaining anything you need to do
              manually (e.g. download remote figures). The whole pipeline
              runs in your browser; paper text never touches our server.
            </p>

            <label className="block">
              <span className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-subtle">
                Authors line
              </span>
              <input
                value={authors}
                onChange={(e) => setAuthors(e.target.value)}
                placeholder="Author One, Author Two"
                className="input mt-1 w-full"
              />
            </label>

            <label className="block">
              <span className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-subtle">
                Venue template
              </span>
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="input mt-1 w-full"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <span className="text-[10.5px] text-subtle mt-1 block">
                Generic uses article.cls. arXiv accepts venue-specific
                class files — drop yours next to paper.tex if needed.
              </span>
            </label>

            <label
              className={cn(
                "flex items-start gap-2 text-[12.5px] cursor-pointer",
                !hasLedger && "opacity-50 cursor-not-allowed",
              )}
            >
              <input
                type="checkbox"
                checked={embedBadge && !!hasLedger}
                disabled={!hasLedger}
                onChange={(e) => setEmbedBadge(e.target.checked)}
                className="accent-accent mt-0.5"
              />
              <span>
                Embed Atlas honesty badge URL as a .tex header comment
                <span className="block text-[11px] text-subtle leading-tight mt-0.5">
                  {hasLedger
                    ? `${ledger.events.length} ledger events will be exported alongside in atlas-ledger.jsonld so reviewers can verify offline.`
                    : "No ledger events yet for this paper — work in the editor first."}
                </span>
              </span>
            </label>

            {error && (
              <div className="text-[11.5px] text-warning bg-warning/5 border border-warning/40 rounded p-2 flex items-start gap-1.5">
                <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {result && (
              <div className="rounded-md border border-accent/30 bg-accent-soft/40 text-accent text-[11.5px] p-2.5 space-y-1">
                <div className="flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="size-3.5" />
                  Built {result.fileName}
                </div>
                <div className="text-foreground/80">
                  {result.filesIncluded.length} file
                  {result.filesIncluded.length === 1 ? "" : "s"} packaged:{" "}
                  <span className="font-mono">
                    {result.filesIncluded.join(", ")}
                  </span>
                </div>
                {result.warnings.map((w, i) => (
                  <div key={i} className="text-warning text-[11px]">
                    <AlertTriangle className="size-3 inline -mt-0.5 mr-1" />
                    {w}
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={onClose}
                className="btn btn-ghost h-8 text-[12px] text-muted"
              >
                Close
              </button>
              <button
                onClick={build}
                disabled={busy}
                className="btn btn-primary h-8 text-[12px] disabled:opacity-50"
              >
                {busy ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Building…
                  </>
                ) : result ? (
                  <>
                    <Download className="size-3.5" />
                    Re-download
                  </>
                ) : (
                  <>
                    <FileText className="size-3.5" />
                    Build bundle
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
