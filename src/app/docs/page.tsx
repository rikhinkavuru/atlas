import Link from "next/link";
import { LandingNav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import {
  BookOpen,
  Keyboard,
  Mic,
  Target,
  Library,
  ScrollText,
} from "lucide-react";

export const metadata = {
  title: "Atlas — Docs",
};

const SECTIONS = [
  {
    icon: <BookOpen className="size-5" />,
    title: "Getting started",
    body: "Open the workspace, drop a PDF, highlight a sentence, hit ⌘L. You'll be productive inside a minute.",
    href: "#getting-started",
  },
  {
    icon: <Keyboard className="size-5" />,
    title: "Keyboard shortcuts",
    body: "⌘K opens the command palette. ⌘L focuses the agent. ⌘⇧A runs the critic. ⌘. enters focus mode. Press ? anywhere for the full sheet.",
    href: "#shortcuts",
  },
  {
    icon: <Mic className="size-5" />,
    title: "Voice profile",
    body: "Paste 1–3 paragraphs of your own writing into Settings → Voice. Atlas extracts a style fingerprint and conditions every rewrite to match.",
    href: "#voice",
  },
  {
    icon: <Target className="size-5" />,
    title: "Rubrics & venues",
    body: "Pick a venue in the critic dropdown (NeurIPS, ACL, Nature, JAMA, Cell, PhD thesis…). Each score traces back to the specific rubric line it was graded against.",
    href: "#rubrics",
  },
  {
    icon: <Library className="size-5" />,
    title: "Citation library (Nia)",
    body: "Paste paper URLs into Settings → Citation library. Atlas indexes them via Nia; the agent prefers your indexed sources before falling back to CrossRef / OpenAlex / Semantic Scholar.",
    href: "#nia",
  },
  {
    icon: <ScrollText className="size-5" />,
    title: "Response-to-Reviewers",
    body: "File → New review session. Paste reviewer text, Atlas parses each comment, drafts grounded responses, exports a venue-ready letter.",
    href: "#reviewers",
  },
];

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNav />
      <main className="pt-28 pb-20 px-5">
        <div className="max-w-[1000px] mx-auto">
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-accent mb-3">
            Docs
          </div>
          <h1 className="text-[48px] sm:text-[64px] leading-[1.02] tracking-[-0.03em] font-semibold">
            Everything you need to ship your next paper.
          </h1>
          <p className="mt-5 text-[16px] text-muted max-w-[640px] leading-relaxed">
            The full feature reference, keyboard sheet, and recipes for the
            workflows that come up most often.
          </p>

          <div className="mt-14 grid sm:grid-cols-2 gap-3">
            {SECTIONS.map((s) => (
              <Link
                key={s.title}
                href={s.href}
                className="panel p-5 hover:border-border-strong transition-colors group"
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <span className="size-9 rounded-md bg-accent-soft border border-[#2d3d12] flex items-center justify-center text-accent">
                    {s.icon}
                  </span>
                  <span className="text-[15px] font-medium text-foreground">
                    {s.title}
                  </span>
                </div>
                <p className="text-[13px] text-muted leading-relaxed">
                  {s.body}
                </p>
              </Link>
            ))}
          </div>

          <Section id="getting-started" title="Getting started">
            <p>
              Atlas runs entirely in your browser. Visit{" "}
              <Link href="/app" className="text-accent underline">
                /app
              </Link>{" "}
              to open the workspace. A sample paper is preloaded so you can
              test the agent immediately. Paste an OpenAI or Anthropic API key
              in Settings → API keys to enable real models, or stay in Mock
              mode for scripted demos.
            </p>
          </Section>

          <Section id="shortcuts" title="Keyboard shortcuts">
            <ShortcutGrid />
          </Section>

          <Section id="voice" title="Voice profile">
            <p>
              In <strong>Settings → Voice</strong>, paste one or more
              paragraphs of your own writing. The longer and more representative
              the sample, the better the fingerprint. Atlas computes:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-3">
              <li>Average and median sentence length</li>
              <li>Hedge rate and preferred hedge phrases</li>
              <li>Passive-construction ratio</li>
              <li>Citation density per 1k words</li>
              <li>Domain vocabulary and characteristic bigrams</li>
            </ul>
            <p className="mt-3">
              The profile is injected as hard constraints in every Edit / Plan
              / Ask / Cite call. Add free-form &ldquo;style notes&rdquo; for
              advisor preferences or banned phrases.
            </p>
          </Section>

          <Section id="rubrics" title="Rubrics & venues">
            <p>
              Atlas ships with rubrics for NeurIPS / ICLR / ACL / EMNLP /
              Nature / JAMA / Cell / PhD thesis chapter and a generic
              academic preset. Each rubric has weighted dimensions with
              explicit criteria. Pick a venue from the critic dropdown and
              every score, every issue, and every reviewer summary traces back
              to a rubric line.
            </p>
          </Section>

          <Section id="nia" title="Citation library (Nia)">
            <p>
              Drop a Nia API key in Settings → API keys. In Settings →
              Citation library, paste any URL — arXiv preprint, journal
              article, blog post, documentation page. Atlas posts it to{" "}
              <code className="font-mono">apigcp.trynia.ai/v2/sources</code>{" "}
              with{" "}
              <code className="font-mono">add_as_global_source: false</code>{" "}
              so it&apos;s private to your tenant. Status polls live until
              the source flips to <code>completed</code>. After that the
              agent&apos;s Cite mode prefers your indexed sources before
              falling back to CrossRef / OpenAlex / Semantic Scholar.
            </p>
          </Section>

          <Section id="reviewers" title="Response-to-Reviewers">
            <p>
              <strong>File → New review session.</strong> Paste reviewer text
              from OpenReview, the journal editor, or a meta-review PDF. Atlas
              parses each comment into a numbered item per reviewer. Hit{" "}
              <strong>Draft all</strong> or draft one at a time; each response
              is grounded in your manuscript and matches your voice profile.{" "}
              <strong>Export letter</strong> produces a Markdown response file
              ready to drop into the journal portal or OpenReview.
            </p>
          </Section>

          <Section id="provenance" title="Provenance schema">
            <p>
              Atlas exports a JSON-LD ledger alongside every paper. The shape:
            </p>
            <pre className="mt-4 text-[11.5px] font-mono bg-background border border-border rounded-md p-4 overflow-x-auto leading-relaxed">
{`{
  "@context": "https://atlas.example/schemas/provenance/v1",
  "@type": "AtlasProvenanceLedger",
  "paperId": "p_...",
  "paperTitle": "…",
  "workspaceId": "ws_...",
  "rootHash": "<sha256 of canonicalised chain head + workspaceId>",
  "signature": "<base64 ECDSA-P256 over rootHash>",
  "publicKey":  { "kty": "EC", "crv": "P-256", "x": "…", "y": "…" },
  "publicKeyFingerprint": "<first 16 hex chars of sha256(publicKey)>",
  "events": [
    {
      "id": "ev_…", "timestamp": <ms>, "kind": "ai-edit",
      "actor": { "type": "ai", "label": "Atlas Agent · openai" },
      "provider": "openai", "model": "gpt-4o-mini",
      "before": "…", "after": "…",
      "sources": [ { "label", "origin", "doi?", "url?", "quote" } ],
      "unsupportedClaims": [ "…" ],
      "position": { "from": 1240, "to": 1320 },
      "prev": "<previous event hash | null>",
      "hash": "<sha256(canonicalised(prev + content))>"
    }
  ],
  "version": 1
}`}
            </pre>
            <p className="mt-3">
              Validation is a re-walk of the hash chain plus ECDSA verification
              of the root against the embedded public key. The canonical JSON
              form is sorted-keys, no whitespace, undefined-stripped — see{" "}
              <code className="font-mono text-foreground">src/lib/provenance.ts</code>{" "}
              for the reference implementation, and{" "}
              <Link
                href="/api/provenance/verify"
                className="text-accent underline underline-offset-2"
              >
                /api/provenance/verify
              </Link>{" "}
              for the public verifier endpoint.
            </p>
          </Section>

          <Section id="changelog" title="Changelog">
            <p className="mb-4">
              Tracked in detail at{" "}
              <Link
                href="/changelog"
                className="text-accent underline underline-offset-2"
              >
                /changelog
              </Link>
              . Recent releases:
            </p>
            <ul className="space-y-3">
              <Change
                ver="v0.4.0"
                date="2026-05-18"
                bullets={[
                  "ECDSA-P256 signed Provenance Ledger + per-claim audit (/api/provenance/explain-claim)",
                  "Inline provenance hover in the editor",
                  "Reproducibility Spine v1 (bind sentences to GitHub / arXiv / DOI / W&B / Jupyter)",
                  "Live OpenReview corpus probe + comparison harness on /reviewer-model",
                  "Multi-venue submission forecast across all 8 rubrics",
                  "Signed Lab Capsules + Atlas Honesty Badge SVG endpoint",
                  "Real auth via Clerk (fallback-safe without keys)",
                ]}
              />
              <Change
                ver="v0.3.0"
                date="2026-05-17"
                bullets={[
                  "Public landing page, /app workspace, /pricing /docs /privacy /security",
                  "Statusbar with autosave state + focus mode (⌘.)",
                  "Resizable agent panel",
                  "Reader-mode proxy for iframe-blocked sources",
                ]}
              />
              <Change
                ver="v0.2.0"
                date="2026-05-17"
                bullets={[
                  "PDF import via pdfjs",
                  "Voice profile fingerprinting + injection",
                  "Response-to-Reviewers studio",
                  "Sourced editing with provenance + 'Needs citation' badges",
                  "Workspace .atlaslab.json export/import, LaTeX templates",
                ]}
              />
              <Change
                ver="v0.1.0"
                date="2026-05-17"
                bullets={[
                  "Verified-citation pipeline (CrossRef, OpenAlex, Semantic Scholar, Nia)",
                  "Rubric-transparent analyzer with 8 venue presets",
                  "Plan-before-edit agent mode",
                  "Nia citation library integration",
                ]}
              />
            </ul>
          </Section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="mt-16 pt-8 border-t border-border text-[14.5px] text-muted leading-relaxed"
    >
      <h2 className="text-[24px] font-semibold tracking-tight text-foreground mb-4">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Change({
  ver,
  date,
  bullets,
}: {
  ver: string;
  date: string;
  bullets: string[];
}) {
  return (
    <li className="panel p-4">
      <div className="flex items-center gap-2 text-[10.5px] font-mono uppercase tracking-[0.15em] text-subtle mb-2">
        <span className="text-foreground">{ver}</span>
        <span>·</span>
        <span>{date}</span>
      </div>
      <ul className="space-y-1 text-[13.5px] text-muted">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="size-1 rounded-full bg-accent mt-2 shrink-0" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </li>
  );
}

function ShortcutGrid() {
  const groups: [string, [string, string][]][] = [
    [
      "Navigation",
      [
        ["Command palette", "⌘ K"],
        ["Toggle agent", "⌘ L"],
        ["Paper critic", "⌘ ⇧ A"],
        ["Settings", "⌘ ,"],
        ["Focus mode", "⌘ ."],
        ["Shortcuts", "?"],
      ],
    ],
    [
      "Editing",
      [
        ["Bold / italic", "⌘ B / ⌘ I"],
        ["Heading 1 / 2 / 3", "⌘ ⌥ 1 / 2 / 3"],
        ["Bulleted list", "⌘ ⇧ 8"],
        ["Quote", "⌘ ⇧ B"],
        ["Slash menu", "/"],
        ["Undo / Redo", "⌘ Z / ⇧ ⌘ Z"],
      ],
    ],
    [
      "Agent",
      [
        ["Send", "↵"],
        ["Newline", "⇧ ↵"],
        ["Switch mode", "Click chip"],
        ["Accept proposal", "Click Accept"],
        ["Reject proposal", "Click Reject"],
      ],
    ],
  ];
  return (
    <div className="grid sm:grid-cols-3 gap-6">
      {groups.map(([g, items]) => (
        <div key={g}>
          <div className="text-[10px] uppercase tracking-[0.15em] text-subtle font-mono mb-2">
            {g}
          </div>
          <ul className="space-y-1">
            {items.map(([label, keys]) => (
              <li
                key={label}
                className="flex items-center justify-between text-[12.5px]"
              >
                <span className="text-muted">{label}</span>
                <span className="font-mono text-[11px] text-foreground">
                  {keys.split(" ").map((k, i) => (
                    <span key={i} className="kbd ml-1">
                      {k}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
