"use client";

import { useEffect, useMemo, useState } from "react";
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
  FileSignature,
  Download,
} from "lucide-react";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { useAtlas, activePaper } from "@/lib/store";
import { useSettings } from "@/lib/settings";
import {
  buildAuthorshipAttestation,
  exportAttestationJsonLd,
  pct,
  type AuthorshipAttestation,
  type DisclosureTemplate,
} from "@/lib/authorship";
import {
  renderDisclosure,
  TEMPLATE_LABELS,
  TEMPLATE_ORDER,
} from "@/lib/disclosure-templates";
import { ATLAS_VERSION } from "@/lib/version";
import { cn } from "@/lib/cn";

interface PublishResult {
  shareKey: string;
  sharePath: string;
  absoluteUrl: string;
}

/**
 * Authorship attestation dialog.
 *
 * Lives at workspace level. Opens when File → "Author this disclosure…" or
 * the `atlas:open-authorship` event fires. Builds a signed attestation
 * from the active paper's ledger + author identity, lets the user preview
 * disclosure text for major venues, and publishes to a /a/<shareKey>
 * page (Pro tier required for publish; preview + JSON download free).
 */
export function AuthorshipDialog() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setOpen(true);
    const off = () => setOpen(false);
    window.addEventListener("atlas:open-authorship", on);
    window.addEventListener("atlas:close-authorship", off);
    return () => {
      window.removeEventListener("atlas:open-authorship", on);
      window.removeEventListener("atlas:close-authorship", off);
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
  const authorName = useSettings((s) => s.authorName);
  const authorOrcid = useSettings((s) => s.authorOrcid);
  const toggleSettings = useAtlas((s) => s.toggleSettings);

  const [attestation, setAttestation] =
    useState<AuthorshipAttestation | null>(null);
  const [building, setBuilding] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublishResult | null>(null);
  const [tab, setTab] = useState<DisclosureTemplate>("neurips");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const events = ledger?.events.length ?? 0;
  const hasLedger = !!ledger && events > 0;
  const hasIdentity = authorName.trim().length > 0;

  const author = useMemo(
    () => ({
      name: authorName.trim() || "Author",
      orcid: authorOrcid.trim() || undefined,
    }),
    [authorName, authorOrcid],
  );

  // Build the attestation once we have everything we need. The signing
  // step is async (Web Crypto) so we surface a brief building state.
  //
  // Subtle: the disclosure templates accept an optional `shareUrl`. Before
  // publishing, that URL is undefined, so the signed bytes (and therefore the
  // shareKey) reflect a disclosure that does NOT cite the URL. After publish,
  // we re-build the attestation with `result?.absoluteUrl` so the in-dialog
  // preview shows the URL-citing version — but that re-built attestation has
  // a DIFFERENT hash than what's stored on the server. This is by design:
  //   1. The published attestation at /a/<shareKey> is the canonical, signed
  //      record without URL self-reference (chicken-and-egg avoided).
  //   2. The dialog preview after publish shows the more user-friendly
  //      version that includes the share URL inline — for copying into a
  //      submission form where the URL helps reviewers find the attestation.
  //   3. The downloaded JSON-LD button hands over the URL-citing version, so
  //      callers who want to embed the disclosure in a paper get the better
  //      text; the server copy is the verification target.
  useEffect(() => {
    if (!hasLedger || !ledger || !paper) {
      setAttestation(null);
      return;
    }
    let cancelled = false;
    setBuilding(true);
    setError(null);
    buildAuthorshipAttestation(
      {
        ledger,
        paperTitle: paper.title,
        author,
        coAuthors: [],
        atlasVersion: ATLAS_VERSION,
      },
      (template, args) =>
        renderDisclosure(template, {
          paperTitle: args.paperTitle,
          author: args.author,
          coAuthors: args.coAuthors ?? [],
          breakdown: args.breakdown,
          totalChars: args.totalChars,
          atlasVersion: args.atlasVersion,
          shareUrl: result?.absoluteUrl,
        }),
    )
      .then((att) => {
        if (!cancelled) setAttestation(att);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setBuilding(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hasLedger, ledger, paper, author, result?.absoluteUrl]);

  async function publish() {
    if (!attestation) return;
    setPublishBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/authorship/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attestation }),
      });
      const data = (await r.json()) as {
        ok: boolean;
        shareKey?: string;
        sharePath?: string;
        error?: string;
        message?: string;
      };
      if (r.status === 402 && data.error === "tier_insufficient") {
        setError(
          data.message ??
            "Publishing to a public URL requires the Pro tier. Open Settings → Billing to upgrade.",
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
      setPublishBusy(false);
    }
  }

  function copy(label: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1400);
    });
  }

  function downloadJsonLd() {
    if (!attestation) return;
    const data = exportAttestationJsonLd(attestation);
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/ld+json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `atlas-authorship-${attestation.attestationHash.slice(0, 10)}.jsonld`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const activeDisclosure = attestation?.disclosures.find(
    (d) => d.template === tab,
  );

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
        className="panel relative w-full max-w-[720px] rounded-xl p-5 shadow-2xl max-h-[88vh] overflow-y-auto"
      >
        <div className="flex items-center gap-2 mb-3">
          <FileSignature className="size-4 text-accent" />
          <h3 className="text-[14px] font-semibold text-foreground">
            AI-use authorship attestation
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
          <NoLedgerState onClose={onClose} />
        )}

        {hasLedger && !hasIdentity && (
          <NoIdentityState
            onClose={onClose}
            onOpenSettings={() => {
              onClose();
              toggleSettings(true);
            }}
          />
        )}

        {hasLedger && hasIdentity && (
          <div className="space-y-4">
            <p className="text-[12.5px] text-muted leading-relaxed">
              Atlas will sign a disclosure tying{" "}
              <span className="text-foreground">{paper?.title}</span> to{" "}
              <span className="text-foreground">{author.name}</span>
              {author.orcid && (
                <>
                  {" "}
                  (ORCID{" "}
                  <span className="text-accent">{author.orcid}</span>)
                </>
              )}{" "}
              and the ledger&apos;s {events} chained event
              {events === 1 ? "" : "s"}. Anyone with the resulting URL can
              independently verify the signature and the underlying provenance.
            </p>

            {building && (
              <div className="flex items-center gap-2 text-[12px] text-muted">
                <Loader2 className="size-3.5 animate-spin" />
                Signing attestation locally…
              </div>
            )}

            {attestation && (
              <>
                <BreakdownGrid attestation={attestation} />

                <div className="border-t border-border pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-[12.5px] font-semibold text-foreground">
                        Venue disclosure preview
                      </div>
                      <p className="text-[11.5px] text-subtle mt-0.5">
                        Generated text for {TEMPLATE_LABELS[tab]}.
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        activeDisclosure &&
                        copy("disclosure", activeDisclosure.body)
                      }
                      className="btn btn-ghost h-7 text-[11.5px]"
                    >
                      {copied === "disclosure" ? (
                        <>
                          <Check className="size-3.5 text-accent" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="size-3.5" />
                          Copy text
                        </>
                      )}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {TEMPLATE_ORDER.map((t) => (
                      <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={cn(
                          "px-2.5 h-7 rounded text-[11.5px] border transition-colors",
                          tab === t
                            ? "border-accent bg-accent-soft text-foreground"
                            : "border-border bg-surface hover:bg-surface-2 text-muted",
                        )}
                      >
                        {TEMPLATE_LABELS[t]}
                      </button>
                    ))}
                  </div>
                  <pre className="bg-surface-2 border border-border rounded p-3 text-[12px] leading-relaxed whitespace-pre-wrap font-sans text-foreground/85 max-h-[260px] overflow-y-auto">
                    {activeDisclosure?.body ?? ""}
                  </pre>
                </div>

                <div className="border-t border-border pt-4 space-y-2 text-[11px] font-mono text-subtle">
                  <Pair
                    label="Attestation hash"
                    value={attestation.attestationHash}
                    onCopy={() =>
                      copy("hash", attestation.attestationHash)
                    }
                    copied={copied === "hash"}
                  />
                  <Pair
                    label="Public-key fingerprint"
                    value={attestation.publicKeyFingerprint}
                    onCopy={() =>
                      copy(
                        "fingerprint",
                        attestation.publicKeyFingerprint,
                      )
                    }
                    copied={copied === "fingerprint"}
                  />
                  <Pair
                    label="Ledger root hash"
                    value={attestation.ledgerRootHash}
                    onCopy={() =>
                      copy("ledger-root", attestation.ledgerRootHash)
                    }
                    copied={copied === "ledger-root"}
                  />
                </div>

                {error && (
                  <div className="text-[11.5px] text-warning bg-warning/5 border border-warning/40 rounded p-2">
                    {error}
                  </div>
                )}

                {!result && (
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={downloadJsonLd}
                      className="btn btn-ghost h-8 text-[12px]"
                    >
                      <Download className="size-3.5" />
                      Download JSON-LD
                    </button>
                    <button
                      onClick={onClose}
                      className="btn btn-ghost h-8 text-[12px] text-muted"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={publish}
                      disabled={publishBusy}
                      className="btn btn-primary h-8 text-[12px] disabled:opacity-50"
                    >
                      {publishBusy ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          Publishing
                        </>
                      ) : (
                        <>
                          <Upload className="size-3.5" />
                          Publish attestation
                        </>
                      )}
                    </button>
                  </div>
                )}

                {result && (
                  <div className="space-y-3 pt-1">
                    <div className="border border-accent/30 bg-accent-soft/40 rounded p-3 text-[12px] flex items-start gap-2">
                      <ShieldCheck className="size-4 mt-0.5 shrink-0 text-accent" />
                      <span className="text-foreground/90">
                        Published. Cite this URL in your submission&apos;s
                        AI-disclosure field — anyone can verify the chain +
                        signature server-side.
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
                          onClick={() => copy("share", result.absoluteUrl)}
                          className={cn(
                            "btn btn-icon h-9 w-9",
                            copied === "share" &&
                              "text-accent border-accent/40 bg-accent-soft",
                          )}
                          aria-label="Copy URL"
                        >
                          {copied === "share" ? (
                            <Check className="size-3.5" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </button>
                      </div>
                    </label>
                    <div className="flex items-center justify-end gap-2">
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
              </>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function NoLedgerState({ onClose }: { onClose: () => void }) {
  return (
    <div className="space-y-3">
      <div className="border border-dashed border-warning/40 bg-warning/5 text-warning rounded p-3 flex items-start gap-2 text-[12px]">
        <ShieldAlert className="size-4 mt-0.5 shrink-0" />
        <span>
          This paper has no provenance events yet, so there&apos;s nothing to
          attest. Atlas builds the ledger automatically as you accept AI
          proposals, import PDFs, or cite claims. Work in the editor for a few
          minutes, then come back.
        </span>
      </div>
      <button onClick={onClose} className="btn h-8 text-[12px] w-full">
        Got it
      </button>
    </div>
  );
}

function NoIdentityState({
  onClose,
  onOpenSettings,
}: {
  onClose: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="border border-dashed border-warning/40 bg-warning/5 text-warning rounded p-3 flex items-start gap-2 text-[12px]">
        <ShieldAlert className="size-4 mt-0.5 shrink-0" />
        <span>
          To sign an attestation under your name, Atlas needs an author
          identity. Add your display name (and ORCID iD, if you have one) in
          Settings → Voice. You can sign without ORCID, but journals
          increasingly want it.
        </span>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="btn btn-ghost h-8 text-[12px]">
          Later
        </button>
        <button
          onClick={onOpenSettings}
          className="btn btn-primary h-8 text-[12px]"
        >
          Open Settings → Voice
        </button>
      </div>
    </div>
  );
}

function BreakdownGrid({
  attestation,
}: {
  attestation: AuthorshipAttestation;
}) {
  const b = attestation.breakdown;
  return (
    <div className="border border-border rounded-lg p-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Human author" value={pct(b.author)} accent />
        <Stat label="AI · cited" value={pct(b.aiSourced)} />
        <Stat
          label="AI · uncited"
          value={pct(b.aiUnsourced)}
          warning={b.aiUnsourced > 0.4}
        />
        <Stat label="Imported" value={pct(b.imported)} />
      </div>
      <div className="mt-4 h-1.5 rounded-full overflow-hidden bg-surface-2 flex">
        <span className="bg-accent" style={{ width: `${b.author * 100}%` }} />
        <span className="bg-info" style={{ width: `${b.aiSourced * 100}%` }} />
        <span
          className="bg-warning"
          style={{ width: `${b.aiUnsourced * 100}%` }}
        />
        <span
          className="bg-subtle"
          style={{ width: `${b.imported * 100}%` }}
        />
      </div>
      <p className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-subtle mt-3">
        {attestation.totalChars.toLocaleString()} chars · derived from{" "}
        {attestation.ledgerEventCount} ledger events
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  warning,
}: {
  label: string;
  value: string;
  accent?: boolean;
  warning?: boolean;
}) {
  return (
    <div>
      <div className="text-[10.5px] font-mono uppercase tracking-[0.15em] text-subtle">
        {label}
      </div>
      <div
        className={cn(
          "text-[20px] font-semibold tracking-tight mt-0.5",
          accent && "text-accent",
          warning && "text-warning",
          !accent && !warning && "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Pair({
  label,
  value,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-40 text-subtle/70">{label}</span>
      <span className="flex-1 text-foreground/80 break-all">{value}</span>
      <button
        onClick={onCopy}
        className="size-6 rounded hover:bg-surface-2 flex items-center justify-center text-subtle hover:text-foreground"
        aria-label={`Copy ${label}`}
      >
        {copied ? (
          <Check className="size-3 text-accent" />
        ) : (
          <Copy className="size-3" />
        )}
      </button>
    </div>
  );
}
