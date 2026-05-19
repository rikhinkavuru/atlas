"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  ShieldAlert,
  Loader2,
  X,
  Copy,
  Check,
  ExternalLink,
  Upload,
} from "lucide-react";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { useAtlas, activePaper } from "@/lib/store";
import { cn } from "@/lib/cn";

interface PublishResult {
  shareKey: string;
  sharePath: string;
  /** Resolved against window.location.origin on the client. */
  absoluteUrl: string;
}

/**
 * Publish-to-public dialog for the active paper's ledger.
 *
 * Triggered by `atlas:open-publish-ledger` (command palette + NavMenu fire
 * this). POSTs the current ledger to /api/ledger/publish and surfaces the
 * resulting /p/<shareKey> URL with Copy + Open affordances.
 */
export function PublishLedgerDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const on = () => setOpen(true);
    const off = () => setOpen(false);
    window.addEventListener("atlas:open-publish-ledger", on);
    window.addEventListener("atlas:close-publish-ledger", off);
    return () => {
      window.removeEventListener("atlas:open-publish-ledger", on);
      window.removeEventListener("atlas:close-publish-ledger", off);
    };
  }, []);

  return (
    <AnimatePresence>
      {open && <DialogBody onClose={() => setOpen(false)} />}
    </AnimatePresence>
  );
}

function DialogBody({ onClose }: { onClose: () => void }) {
  const ref = useFocusTrap<HTMLDivElement>(true);
  const paper = useAtlas((s) => activePaper(s));
  const ledger = useAtlas((s) => (paper ? s.ledgers[paper.id] : undefined));

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublishResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const events = ledger?.events.length ?? 0;
  const hasLedger = !!ledger && events > 0;

  async function publish() {
    if (!paper || !ledger) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/ledger/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ledger, paperTitle: paper.title }),
      });
      const data = (await r.json()) as {
        ok: boolean;
        shareKey?: string;
        sharePath?: string;
        error?: string;
        message?: string;
        required?: string;
      };
      // Tier-gating returns 402 with { error: "tier_insufficient", required:
      // "pro", message: "..." }. Surface that as an upgrade prompt rather
      // than a generic error.
      if (r.status === 402 && data.error === "tier_insufficient") {
        setError(
          data.message ??
            "Publishing to a public URL requires the Pro tier. Open Settings to upgrade.",
        );
        return;
      }
      if (!data.ok || !data.shareKey || !data.sharePath) {
        throw new Error(data.error ?? `publish returned ${r.status}`);
      }
      const absoluteUrl = `${window.location.origin}${data.sharePath}`;
      setResult({
        shareKey: data.shareKey,
        sharePath: data.sharePath,
        absoluteUrl,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function copyUrl() {
    if (!result) return;
    void navigator.clipboard.writeText(result.absoluteUrl).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
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
        className="panel relative w-full max-w-[520px] rounded-xl p-5 shadow-2xl"
      >
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="size-4 text-accent" />
          <h3 className="text-[14px] font-semibold text-foreground">
            Publish this ledger
          </h3>
          <button
            onClick={onClose}
            className="ml-auto size-6 rounded flex items-center justify-center text-subtle hover:text-foreground hover:bg-surface-2"
            aria-label="Close"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {!hasLedger && (
          <div className="space-y-3">
            <div className="border border-dashed border-warning/40 bg-warning/5 text-warning rounded p-3 flex items-start gap-2 text-[12px]">
              <ShieldAlert className="size-4 mt-0.5 shrink-0" />
              <span>
                This paper has no provenance events yet. The ledger is built
                automatically as you accept AI proposals, import PDFs, or cite
                claims. Use the workspace for a few minutes, then come back.
              </span>
            </div>
            <button
              onClick={onClose}
              className="btn h-8 text-[12px] w-full"
            >
              Got it
            </button>
          </div>
        )}

        {hasLedger && !result && (
          <div className="space-y-3">
            <p className="text-[12.5px] text-muted leading-relaxed">
              Atlas will upload <span className="text-foreground">{events}</span>{" "}
              hash-chained event{events === 1 ? "" : "s"} from{" "}
              <span className="text-foreground">{paper?.title}</span> and
              return a public URL. The shareKey is derived from the ledger
              root-hash — re-publishing an unmodified ledger returns the same
              URL.
            </p>
            <ul className="space-y-1.5 text-[11.5px] text-subtle leading-relaxed">
              <li className="flex items-start gap-2">
                <Check className="size-3 mt-0.5 shrink-0 text-accent" />
                Reviewers can fetch the ledger from a URL you control.
              </li>
              <li className="flex items-start gap-2">
                <Check className="size-3 mt-0.5 shrink-0 text-accent" />
                Edits made after publishing produce a new URL — the original
                remains the canonical record at submission.
              </li>
              <li className="flex items-start gap-2">
                <Check className="size-3 mt-0.5 shrink-0 text-accent" />
                The hash chain + signature are re-walked server-side on every
                visit.
              </li>
            </ul>
            {error && (
              <div className="text-[11.5px] text-warning bg-warning/5 border border-warning/40 rounded p-2">
                {error}
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={onClose}
                className="btn btn-ghost h-8 text-[12px] text-muted"
              >
                Cancel
              </button>
              <button
                onClick={publish}
                disabled={busy}
                className="btn btn-primary h-8 text-[12px] disabled:opacity-50"
              >
                {busy ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Publishing
                  </>
                ) : (
                  <>
                    <Upload className="size-3.5" />
                    Publish ledger
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="border border-accent/30 bg-accent-soft/40 rounded p-3 text-[12px] flex items-start gap-2">
              <ShieldCheck className="size-4 mt-0.5 shrink-0 text-accent" />
              <span className="text-foreground/90">
                Published. Anyone with this URL can verify the ledger —
                including the signature and full chain — on demand.
              </span>
            </div>
            <label className="block">
              <span className="text-[10.5px] font-mono uppercase tracking-[0.15em] text-subtle">
                Public URL
              </span>
              <div className="mt-1 flex items-center gap-1.5">
                <input
                  readOnly
                  value={result.absoluteUrl}
                  className="input flex-1 text-[12px] font-mono"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  onClick={copyUrl}
                  className={cn(
                    "btn btn-icon h-9 w-9",
                    copied && "text-accent border-accent/40 bg-accent-soft",
                  )}
                  aria-label="Copy URL"
                  title={copied ? "Copied" : "Copy URL"}
                >
                  {copied ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </button>
              </div>
            </label>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={onClose}
                className="btn btn-ghost h-8 text-[12px] text-muted"
              >
                Done
              </button>
              <a
                href={result.sharePath}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary h-8 text-[12px]"
              >
                <ExternalLink className="size-3.5" />
                Open public page
              </a>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
