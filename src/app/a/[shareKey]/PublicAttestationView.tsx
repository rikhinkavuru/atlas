"use client";

import { useState } from "react";
import { Check, Copy, AlertTriangle, ShieldCheck } from "lucide-react";
import type { PublishedAttestation } from "@/lib/authorship-store";
import {
  pct,
  exportAttestationJsonLd,
  type DisclosureTemplate,
} from "@/lib/authorship";
import { TEMPLATE_LABELS, TEMPLATE_ORDER } from "@/lib/disclosure-templates";
import { cn } from "@/lib/cn";

interface Props {
  record: PublishedAttestation;
  signature: {
    status: "valid" | "invalid" | "hash-mismatch" | "missing";
    fingerprint?: string;
  };
  canonical: string;
}

export function PublicAttestationView({ record, signature, canonical }: Props) {
  const { attestation } = record;
  const [tab, setTab] = useState<DisclosureTemplate>("neurips");
  const [copied, setCopied] = useState<string | null>(null);

  function copyText(label: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1400);
    });
  }

  function downloadJsonLd() {
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

  const active = attestation.disclosures.find((d) => d.template === tab);

  return (
    <div className="mt-10 grid gap-8">
      <SignatureBanner signature={signature} />

      <section className="panel p-7 rounded-2xl">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Stat label="Human author" value={pct(attestation.breakdown.author)} accent />
          <Stat
            label="AI · cited"
            value={pct(attestation.breakdown.aiSourced)}
          />
          <Stat
            label="AI · uncited"
            value={pct(attestation.breakdown.aiUnsourced)}
            warning={attestation.breakdown.aiUnsourced > 0.4}
          />
          <Stat label="Imported" value={pct(attestation.breakdown.imported)} />
        </div>
        <div className="mt-5 h-2 rounded-full overflow-hidden bg-surface-2 flex">
          <span
            className="bg-accent"
            style={{ width: `${attestation.breakdown.author * 100}%` }}
          />
          <span
            className="bg-info"
            style={{ width: `${attestation.breakdown.aiSourced * 100}%` }}
          />
          <span
            className="bg-warning"
            style={{ width: `${attestation.breakdown.aiUnsourced * 100}%` }}
          />
          <span
            className="bg-subtle"
            style={{ width: `${attestation.breakdown.imported * 100}%` }}
          />
        </div>
        <p className="text-[11.5px] text-subtle mt-3 font-mono leading-relaxed">
          Computed across {attestation.totalChars.toLocaleString()} characters of
          paper content · attested by{" "}
          <span className="text-foreground">{attestation.author.name}</span>
          {attestation.author.orcid && (
            <>
              {" "}· ORCID{" "}
              <span className="text-accent">{attestation.author.orcid}</span>
            </>
          )}
        </p>
      </section>

      <section className="panel p-7 rounded-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight">
              Venue disclosure
            </h2>
            <p className="text-[12.5px] text-subtle mt-0.5">
              Generated text for {TEMPLATE_LABELS[tab]}. Authors should still
              review before submitting.
            </p>
          </div>
          <button
            onClick={() =>
              active && copyText("disclosure", active.body)
            }
            className="btn btn-ghost h-8 text-[12px]"
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
        <div className="flex flex-wrap gap-1 mb-4">
          {TEMPLATE_ORDER.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-3 h-8 rounded-md text-[12px] border transition-colors",
                tab === t
                  ? "border-accent bg-accent-soft text-foreground"
                  : "border-border bg-surface hover:bg-surface-2 text-muted",
              )}
            >
              {TEMPLATE_LABELS[t]}
            </button>
          ))}
        </div>
        <pre className="bg-surface-2 border border-border rounded-lg p-5 text-[13px] leading-relaxed whitespace-pre-wrap font-sans text-foreground/90">
          {active?.body ?? "(no disclosure available)"}
        </pre>
      </section>

      <section className="panel p-7 rounded-2xl">
        <h2 className="text-[18px] font-semibold tracking-tight mb-1">
          Verification fingerprints
        </h2>
        <p className="text-[12.5px] text-subtle mb-5">
          Atlas signed this attestation with the author&apos;s workspace key. The
          ledger root hash links it to the underlying provenance record.
        </p>
        <dl className="space-y-3 text-[12.5px] font-mono">
          <Pair
            label="Attestation hash"
            value={attestation.attestationHash}
            onCopy={() => copyText("hash", attestation.attestationHash)}
            copied={copied === "hash"}
          />
          <Pair
            label="Public key fingerprint"
            value={attestation.publicKeyFingerprint}
            onCopy={() =>
              copyText("fingerprint", attestation.publicKeyFingerprint)
            }
            copied={copied === "fingerprint"}
          />
          <Pair
            label="Ledger root hash"
            value={attestation.ledgerRootHash}
            onCopy={() =>
              copyText("ledger-root", attestation.ledgerRootHash)
            }
            copied={copied === "ledger-root"}
          />
          <Pair
            label="Atlas version"
            value={attestation.atlasVersion}
            mono={false}
          />
          <Pair
            label="Generated at"
            value={new Date(attestation.generatedAt).toISOString()}
            mono={false}
          />
        </dl>
        <div className="flex gap-2 mt-6">
          <button onClick={downloadJsonLd} className="btn btn-ghost h-8 text-[12px]">
            Download JSON-LD
          </button>
          <button
            onClick={() => copyText("canonical", canonical)}
            className="btn btn-ghost h-8 text-[12px]"
          >
            {copied === "canonical" ? (
              <>
                <Check className="size-3.5 text-accent" />
                Copied
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                Copy share URL
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}

function SignatureBanner({
  signature,
}: {
  signature: Props["signature"];
}) {
  const map = {
    valid: {
      icon: <ShieldCheck className="size-4 text-accent" />,
      label: "Signature valid",
      detail: "Re-hashed and verified server-side on load.",
      tone: "accent" as const,
    },
    invalid: {
      icon: <AlertTriangle className="size-4 text-danger" />,
      label: "Signature invalid",
      detail:
        "The attestation's signature did not verify against its embedded public key. Treat the disclosure as unattested.",
      tone: "danger" as const,
    },
    "hash-mismatch": {
      icon: <AlertTriangle className="size-4 text-danger" />,
      label: "Payload modified",
      detail:
        "The attestation payload was changed after signing — the recorded hash doesn't match the canonical bytes. Treat as unattested.",
      tone: "danger" as const,
    },
    missing: {
      icon: <AlertTriangle className="size-4 text-warning" />,
      label: "Unsigned attestation",
      detail:
        "This attestation was published without a signature. Anyone could have authored it.",
      tone: "warning" as const,
    },
  }[signature.status];

  return (
    <div
      className={cn(
        "panel p-4 rounded-xl flex items-start gap-3 border",
        map.tone === "accent" && "border-accent/40 bg-accent-soft",
        map.tone === "danger" && "border-danger/40 bg-danger/5",
        map.tone === "warning" && "border-warning/40 bg-warning/5",
      )}
    >
      {map.icon}
      <div className="flex-1">
        <div className="text-[13px] font-semibold text-foreground">
          {map.label}
        </div>
        <div className="text-[12px] text-muted mt-0.5 leading-relaxed">
          {map.detail}
        </div>
        {signature.fingerprint && (
          <div className="text-[11px] font-mono text-subtle mt-2 truncate">
            key fp · {signature.fingerprint}
          </div>
        )}
      </div>
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
      <div className="text-[11px] font-mono uppercase tracking-[0.15em] text-subtle">
        {label}
      </div>
      <div
        className={cn(
          "text-[24px] font-semibold tracking-tight mt-1",
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
  mono = true,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
  copied?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 text-[12px]">
      <dt className="w-44 text-subtle">{label}</dt>
      <dd
        className={cn(
          "flex-1 text-foreground/85 break-all",
          mono && "font-mono",
        )}
      >
        {value}
      </dd>
      {onCopy && (
        <button
          onClick={onCopy}
          className="size-7 rounded-md hover:bg-surface-2 flex items-center justify-center text-subtle hover:text-foreground"
          aria-label={`Copy ${label}`}
        >
          {copied ? (
            <Check className="size-3.5 text-accent" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </button>
      )}
    </div>
  );
}
