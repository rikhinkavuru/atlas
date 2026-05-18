import Link from "next/link";
import { LandingNav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import {
  ShieldCheck,
  ShieldAlert,
  Inbox,
  ArrowRight,
  ExternalLink,
  Library,
  Sparkles,
  Target,
} from "lucide-react";

export const metadata = {
  title: "Atlas — For reviewers",
  description:
    "Reviewing an Atlas-drafted paper? Here is what to check, how to use the public verifier, and what the Atlas Honesty Badge means.",
  alternates: { canonical: "/for-reviewers" },
};

const CHECKS = [
  {
    icon: <ShieldCheck className="size-4" />,
    title: "Verify the signature",
    body: "Drop the .atlas-ledger.jsonld file into the public Verify route. Atlas re-walks the SHA-256 hash chain and checks the ECDSA-P256 signature against the embedded public key. If either fails, the paper has been tampered with after export.",
  },
  {
    icon: <Sparkles className="size-4" />,
    title: "Read the authorship breakdown",
    body: "The badge and the verifier both show what fraction of the manuscript was author-written, AI-edited with a verified source, AI-edited without a source, or imported. Numbers don't tell you the paper is good — they tell you how to read it.",
  },
  {
    icon: <ShieldAlert className="size-4" />,
    title: "Look at unsourced claims",
    body: "Any claim the agent emitted that it couldn't ground gets bucketed as 'Needs citation'. The count appears in the report. A nonzero count isn't disqualifying — but it's where to focus your scepticism.",
  },
  {
    icon: <Inbox className="size-4" />,
    title: "Cross-check the response letter",
    body: "If the authors used Atlas's Response-to-Reviewers studio, the letter cites which manuscript section each response was grounded in. Open those sections and confirm the change actually landed.",
  },
];

export default function ForReviewersPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNav />
      <main className="pt-28 pb-20 px-5">
        <div className="max-w-[1000px] mx-auto">
          <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-accent mb-3">
            For reviewers
          </div>
          <h1 className="text-[48px] sm:text-[64px] leading-[1.02] tracking-[-0.025em] font-semibold">
            Reviewing an Atlas paper?
          </h1>
          <p className="mt-6 max-w-[640px] text-[15.5px] text-muted leading-relaxed">
            If the authors used Atlas, the submission ships with a public
            provenance ledger and an embeddable honesty badge. You don&apos;t
            need an Atlas account to read either — both are public, and the
            verifier runs in your browser.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/verify"
              className="btn btn-primary h-10 text-[13px] px-5"
            >
              Open the verifier
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/verify"
              className="btn h-10 text-[13px] px-5 text-muted"
            >
              <ShieldCheck className="size-4" />
              Try a sample ledger
            </Link>
          </div>

          <Section title="What to check">
            <ul className="grid sm:grid-cols-2 gap-3 mt-2">
              {CHECKS.map((c, i) => (
                <li key={i} className="panel p-5 rounded-lg">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="size-7 rounded-md bg-accent-soft border border-[#2d3d12] flex items-center justify-center text-accent">
                      {c.icon}
                    </span>
                    <span className="text-[13px] font-semibold text-foreground">
                      {c.title}
                    </span>
                  </div>
                  <p className="text-[13px] text-muted leading-relaxed">
                    {c.body}
                  </p>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="What the badge means">
            <p className="mb-5 text-[14.5px]">
              The Atlas Honesty Badge is a dynamic SVG generated from the
              paper&apos;s ledger. It encodes the authorship breakdown, links
              to the public verifier, and shows the first 14 hex chars of the
              root hash so two papers can be told apart at a glance.
            </p>
            <div className="border border-border rounded-lg bg-background p-4 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/api/badge?author=44&sourced=32&ai=16&imported=8&paper=AtlasRAG&hash=9b27d1856ff3"
                alt="Sample Atlas Honesty Badge"
                width={640}
                height={88}
                className="max-w-full"
              />
            </div>
            <ul className="mt-5 space-y-2 text-[13.5px]">
              <BadgeLegendRow
                color="bg-foreground"
                label="Author"
                body="Characters written by the manuscript author directly."
              />
              <BadgeLegendRow
                color="bg-accent"
                label="Sourced AI"
                body="AI-edited characters that carry a verified supporting quote from the user's selection, draft, library, or external citation."
              />
              <BadgeLegendRow
                color="bg-info"
                label="Unsourced AI"
                body="AI-edited characters whose claims were not grounded at edit time. The verifier counts these separately so reviewers can focus there."
              />
              <BadgeLegendRow
                color="bg-warning"
                label="Imported"
                body="Characters that came from an imported PDF or pasted source rather than original authoring."
              />
            </ul>
          </Section>

          <Section title="If the paper has no badge">
            <p>
              That&apos;s OK — Atlas is opt-in, and most submissions today are
              still drafted in tools that don&apos;t carry provenance.
              You&apos;ll review them the way you always have. If you want to
              encourage Atlas-grade disclosure for future submissions, the
              short link is{" "}
              <Link
                href="/"
                className="text-accent underline underline-offset-2"
              >
                atlas.app
              </Link>
              .
            </p>
          </Section>

          <Section title="Quick links for reviewers">
            <ul className="grid sm:grid-cols-3 gap-3 mt-2">
              {[
                {
                  icon: <ShieldCheck className="size-4" />,
                  title: "Verifier",
                  body: "Drop a ledger, get a one-page report.",
                  href: "/verify",
                  cta: "Open",
                },
                {
                  icon: <Library className="size-4" />,
                  title: "Reviewer Model",
                  body: "The roadmap for the venue-specific reviewer fine-tune.",
                  href: "/reviewer-model",
                  cta: "Read",
                },
                {
                  icon: <Target className="size-4" />,
                  title: "Privacy",
                  body: "What Atlas does and doesn't store, plainly.",
                  href: "/privacy",
                  cta: "Read",
                },
              ].map((q) => (
                <li key={q.title} className="panel p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="size-7 rounded-md bg-accent-soft border border-[#2d3d12] flex items-center justify-center text-accent">
                      {q.icon}
                    </span>
                    <span className="text-[13px] font-semibold text-foreground">
                      {q.title}
                    </span>
                  </div>
                  <p className="text-[12.5px] text-muted leading-relaxed mb-2">
                    {q.body}
                  </p>
                  <Link
                    href={q.href}
                    className="text-[12px] text-accent underline underline-offset-2 inline-flex items-center gap-1"
                  >
                    {q.cta}
                    <ExternalLink className="size-3" />
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-16 pt-8 border-t border-border text-[14.5px] text-muted leading-relaxed">
      <h2 className="text-[26px] font-semibold tracking-tight text-foreground mb-5">
        {title}
      </h2>
      {children}
    </section>
  );
}

function BadgeLegendRow({
  color,
  label,
  body,
}: {
  color: string;
  label: string;
  body: string;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span className={`mt-1.5 size-2.5 rounded-sm shrink-0 ${color}`} />
      <span>
        <span className="text-foreground font-medium">{label}</span> · {body}
      </span>
    </li>
  );
}
