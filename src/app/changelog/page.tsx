import Link from "next/link";
import { LandingNav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "Atlas — Changelog",
  description: "What shipped in Atlas, in reverse chronological order.",
};

interface Release {
  version: string;
  date: string;
  headline: string;
  items: { tag: "ship" | "fix" | "polish" | "moat"; text: string }[];
}

const RELEASES: Release[] = [
  {
    version: "v0.4.0",
    date: "2026-05-18",
    headline: "Moats come to life",
    items: [
      {
        tag: "moat",
        text: "Provenance Ledger now signed end-to-end with per-workspace ECDSA-P256 keypair (Web Crypto). Signature embedded alongside the hash chain; public Verify route validates both.",
      },
      {
        tag: "moat",
        text: "Reproducibility Spine v1 — bind manuscript passages to GitHub commits, arXiv IDs, DOIs, Jupyter notebooks, or any URL. /api/binding/check runs kind-specific freshness probes; sidebar Spine tab surfaces stale claims.",
      },
      {
        tag: "moat",
        text: "Real OpenReview live integration on /reviewer-model — public-API probe streams sample (paper, reviews) tuples for ICLR 2022 / 2023 / 2024 so the corpus shape is visible, not promised.",
      },
      {
        tag: "ship",
        text: "Interactive hero demo replaces the static mock. Click the highlighted sentence on the landing to walk the agent through the rewrite-with-sources flow.",
      },
      {
        tag: "ship",
        text: "Atlas Honesty Badge — dynamic SVG endpoint at /api/badge that embeds anywhere with authorship breakdown + signature root.",
      },
      { tag: "polish", text: "Custom 404 page. /changelog as its own route." },
    ],
  },
  {
    version: "v0.3.0",
    date: "2026-05-17",
    headline: "Workspace polish + launch surface",
    items: [
      { tag: "ship", text: "Public landing page at /, app moved to /app." },
      {
        tag: "ship",
        text: "/pricing /docs /privacy /security /verify /reviewer-model routes; landing nav + footer updated.",
      },
      {
        tag: "ship",
        text: "Bottom statusbar with autosave indicator + focus mode (⌘.) + resizable agent panel.",
      },
      {
        tag: "ship",
        text: "Reader-mode proxy for iframe-blocked sources at /api/reader.",
      },
      {
        tag: "fix",
        text: "Icon-only top-bar buttons no longer clip (.btn-icon variant).",
      },
      {
        tag: "fix",
        text: "Agent panel scroll freeze when re-entering the panel from another tab.",
      },
      {
        tag: "polish",
        text: "Honest Reviewer Model page — fabricated row counts removed, every head marked roadmap.",
      },
    ],
  },
  {
    version: "v0.2.0",
    date: "2026-05-17",
    headline: "Voice + PDF + R&R",
    items: [
      { tag: "ship", text: "PDF import via pdfjs (drag-anywhere, multi-PDF)." },
      {
        tag: "ship",
        text: "Voice profile fingerprinting (sentence length, hedge rate, vocabulary, characteristic bigrams) injected into every rewrite.",
      },
      {
        tag: "ship",
        text: "Response-to-Reviewers studio — paste OpenReview/email text, parsed per item, drafted per item, exported as a venue-ready letter.",
      },
      {
        tag: "ship",
        text: "Sourced editing with provenance — every AI rewrite carries supporting quotes; unsupported claims bucketed as 'Needs citation'.",
      },
      {
        tag: "ship",
        text: ".atlaslab.json workspace export + LaTeX export with NeurIPS / ACL / IEEEtran templates.",
      },
    ],
  },
  {
    version: "v0.1.0",
    date: "2026-05-17",
    headline: "First wave",
    items: [
      {
        tag: "ship",
        text: "Verified-citation pipeline (CrossRef, OpenAlex, Semantic Scholar, Nia in parallel).",
      },
      {
        tag: "ship",
        text: "Rubric-transparent analyzer with 8 venue presets, per-score evidence + jump-to-line.",
      },
      {
        tag: "ship",
        text: "Plan-before-edit agent mode — multi-step plan, per-step accept/reject.",
      },
      { tag: "ship", text: "Nia citation library integration." },
    ],
  },
];

const TAG_STYLE: Record<Release["items"][number]["tag"], string> = {
  ship: "text-accent border-[#2d3d12] bg-accent-soft",
  fix: "text-info border-info/40 bg-info/5",
  polish: "text-subtle border-border bg-surface-2",
  moat: "text-foreground border-foreground/30 bg-foreground/5",
};

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNav />
      <main className="pt-28 pb-20 px-5">
        <div className="max-w-[820px] mx-auto">
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-accent mb-3">
            Changelog
          </div>
          <h1 className="text-[44px] sm:text-[56px] leading-[1.05] tracking-[-0.025em] font-semibold">
            What we shipped, in reverse chronological order.
          </h1>
          <p className="mt-5 max-w-[560px] text-[15px] text-muted leading-relaxed">
            Tagged{" "}
            <Tag tag="ship">ship</Tag>{" "}
            <Tag tag="moat">moat</Tag>{" "}
            <Tag tag="fix">fix</Tag>{" "}
            <Tag tag="polish">polish</Tag>. New entries land here the moment
            they hit main.
          </p>

          <div className="mt-14 space-y-12">
            {RELEASES.map((r) => (
              <article key={r.version} className="grid sm:grid-cols-[120px_1fr] gap-6">
                <header className="sm:text-right">
                  <div className="text-[15px] font-semibold tracking-tight">
                    {r.version}
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-subtle mt-0.5">
                    {r.date}
                  </div>
                </header>
                <div>
                  <h2 className="text-[20px] font-semibold tracking-tight text-foreground mb-3">
                    {r.headline}
                  </h2>
                  <ul className="space-y-2.5">
                    {r.items.map((it, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2.5 text-[13.5px] text-muted leading-relaxed"
                      >
                        <Tag tag={it.tag} />
                        <span className="text-foreground/90">{it.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-16 pt-8 border-t border-border flex items-center gap-3">
            <Link href="/app" className="btn btn-primary h-9 text-[12.5px] px-4">
              Open the workspace
              <ArrowRight className="size-3.5" />
            </Link>
            <Link
              href="/reviewer-model"
              className="btn h-9 text-[12.5px] px-4 text-muted"
            >
              Reviewer Model roadmap
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Tag({
  tag,
  children,
}: {
  tag: Release["items"][number]["tag"];
  children?: React.ReactNode;
}) {
  return (
    <span
      className={`shrink-0 inline-flex items-center justify-center min-w-[44px] px-1.5 py-0.5 rounded text-[9.5px] font-mono uppercase tracking-[0.15em] border ${TAG_STYLE[tag]}`}
    >
      {children ?? tag}
    </span>
  );
}
