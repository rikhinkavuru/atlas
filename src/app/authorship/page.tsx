import Link from "next/link";
import { ShieldCheck, FileSignature, ArrowRight, AlertTriangle } from "lucide-react";
import { LandingNav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";

export const metadata = {
  title: "Atlas — Authorship Ledger · signed AI-use disclosure",
  description:
    "A signed, reviewer-verifiable record of how much of your manuscript was written by you vs. AI. Built on Atlas's provenance ledger; ready-made disclosure text for NeurIPS, Nature, ACL, ICML, and more.",
};

const VENUES = [
  {
    name: "NeurIPS",
    rule: "LLM use must be disclosed in the camera-ready under the LLM policy.",
  },
  {
    name: "Nature",
    rule: "AI tools cannot be listed as authors; their use must be disclosed in Methods or Acknowledgements.",
  },
  {
    name: "Science",
    rule: "All AI assistance must be declared; authors take full responsibility for content.",
  },
  {
    name: "ACL",
    rule: "Generative-AI use must appear in a dedicated section in the limitations or appendix.",
  },
  {
    name: "ICML",
    rule: "LLM use beyond standard editing must be disclosed in a statement.",
  },
  {
    name: "JAMA",
    rule: "AI-assisted writing must be disclosed; AI cannot be an author.",
  },
];

const PRINCIPLES = [
  {
    title: "Verification, not detection",
    body: "AI-detection tools fail (Turnitin and GPTZero have both retracted accuracy claims). Atlas does the opposite: you prove what you wrote, signed at the moment you wrote it. Reviewers verify the signature instead of guessing.",
  },
  {
    title: "Tied to your provenance ledger",
    body: "An attestation references the ledger's root hash, so a reviewer who wants to audit the math can fetch the underlying chain of signed events. Tamper with either artifact and the signature breaks.",
  },
  {
    title: "Author-controlled keys",
    body: "Atlas generates a per-workspace ECDSA-P256 key in your browser. The private key never leaves your device; only the public key is embedded in published attestations. Atlas, the company, cannot forge attestations on your behalf.",
  },
  {
    title: "Decline-friendly",
    body: "Don't want to publish your numbers? Sign locally and paste the JSON-LD payload into your submission cover letter. The hosted /a/<shareKey> page is convenient, not required.",
  },
];

export default function AuthorshipPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNav />
      <main className="pt-28 pb-20 px-5">
        <div className="max-w-[1000px] mx-auto">
          <div className="flex items-center gap-3 mb-3 text-[11px] font-mono uppercase tracking-[0.22em]">
            <span className="text-accent flex items-center gap-1.5">
              <FileSignature className="size-3" />
              The Authorship Ledger
            </span>
            <span className="h-px w-6 bg-border" />
            <span className="text-accent">Shipped · free</span>
          </div>
          <h1 className="text-[44px] sm:text-[56px] leading-[1.05] tracking-[-0.025em] font-semibold">
            Prove what you wrote.{" "}
            <span className="italic font-serif text-accent">
              Signed at source.
            </span>
          </h1>
          <p className="mt-5 max-w-[680px] text-[15px] text-muted leading-relaxed">
            Every major venue now requires you to disclose how much of your
            manuscript was written by an LLM. Authors fill these in by hand
            with no way for reviewers to verify the numbers. Atlas already
            records every AI edit in a signed provenance ledger. The
            Authorship Ledger turns that record into a journal-ready,
            cryptographically-verifiable AI-use disclosure — without you
            doing the bookkeeping.
          </p>

          <div className="flex flex-wrap gap-3 mt-9">
            <Link href="/app" className="btn btn-primary btn-lg group">
              Open the workspace
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/verify"
              className="btn btn-lg text-[13px] text-muted hover:text-foreground"
            >
              Verify someone&apos;s attestation
            </Link>
          </div>

          <Section title="How it works">
            <ol className="space-y-4 mt-5">
              <Step
                n={1}
                title="Write in Atlas with the agent on"
                body="Every AI proposal you accept lands as a signed provenance event with hash, prompt, sources, and unsupported-claim record. Edits you make yourself are tagged as `author`. Imports are tagged separately. Nothing is silent."
              />
              <Step
                n={2}
                title="Open File → Sign AI-use attestation…"
                body="Atlas builds a per-paper breakdown — human-authored vs. AI-with-citation vs. AI-without-citation vs. imported — and signs it with your workspace key. The attestation references the ledger's root hash so the two artifacts are linked."
              />
              <Step
                n={3}
                title="Paste the URL into your submission's AI-disclosure field"
                body="Reviewers and program chairs visit /a/<shareKey> to see the breakdown, the signature verification, and the venue-specific disclosure text. Atlas re-checks the chain + signature server-side on every page load."
              />
              <Step
                n={4}
                title="Re-sign after each revision"
                body="A new attestation supersedes the old one and gets a new URL — the original remains the canonical record at submission. Reviewers can compare attestations across revisions to see how AI involvement shifted."
              />
            </ol>
          </Section>

          <Section title="Pre-baked disclosure templates">
            <p className="mb-5">
              Atlas ships venue-specific disclosure text generated from your
              actual numbers. Copy verbatim into your submission, or use as a
              starting point. Templates today:
            </p>
            <ul className="grid sm:grid-cols-2 gap-2">
              {VENUES.map((v) => (
                <li
                  key={v.name}
                  className="border border-border rounded-lg p-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] font-semibold text-foreground">
                      {v.name}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-[0.12em] border border-accent/40 bg-accent-soft text-accent">
                      template
                    </span>
                  </div>
                  <p className="text-[12px] text-muted leading-relaxed">
                    {v.rule}
                  </p>
                </li>
              ))}
            </ul>
            <p className="text-[11.5px] text-subtle mt-5 leading-relaxed">
              Atlas crafts a body for each — references the manuscript, names
              the tool + version, lists the numeric breakdown, and links the
              underlying ledger root hash. Authors should still review before
              submitting; venue rules evolve.
            </p>
          </Section>

          <Section title="Principles">
            <ul className="grid sm:grid-cols-2 gap-3">
              {PRINCIPLES.map((p) => (
                <li key={p.title} className="panel p-4 rounded-lg">
                  <div className="text-[14px] font-semibold text-foreground mb-1">
                    {p.title}
                  </div>
                  <p className="text-[12.5px] text-muted leading-relaxed">
                    {p.body}
                  </p>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="What this is NOT">
            <ul className="space-y-2.5 text-[13px] text-muted leading-relaxed">
              <li className="flex items-start gap-2">
                <AlertTriangle className="size-4 text-warning mt-0.5 shrink-0" />
                <span>
                  <strong className="text-foreground">
                    Not an AI detector.
                  </strong>{" "}
                  Atlas can only attest to AI edits it observed. If you wrote a
                  paragraph in ChatGPT and pasted it in, Atlas will tag it as
                  an import — not as AI-generated. The breakdown reflects what
                  Atlas saw, not the ground truth.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle className="size-4 text-warning mt-0.5 shrink-0" />
                <span>
                  <strong className="text-foreground">
                    Not a substitute for honest disclosure.
                  </strong>{" "}
                  If you bypass Atlas to draft elsewhere, the attestation
                  understates AI involvement. The signature confirms the
                  numbers were produced by your workspace; it does not
                  guarantee they represent everything that happened.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle className="size-4 text-warning mt-0.5 shrink-0" />
                <span>
                  <strong className="text-foreground">
                    Not a venue endorsement.
                  </strong>{" "}
                  Atlas-attested disclosures are accepted wherever AI-use
                  disclosure is accepted. We do not have agreements with
                  individual venues — though we are actively reaching out and
                  would love to (lab@paper-atlas.com).
                </span>
              </li>
            </ul>
          </Section>

          <div className="mt-16 panel p-7 rounded-2xl flex items-center justify-between gap-6">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-accent mb-1.5 flex items-center gap-1.5">
                <ShieldCheck className="size-3" />
                Try it
              </div>
              <h3 className="text-[20px] font-semibold tracking-tight">
                Sign your first attestation in under a minute.
              </h3>
              <p className="text-[13px] text-muted mt-1 leading-relaxed">
                Open the workspace, paste a paragraph, accept an AI edit, then
                File → Sign AI-use attestation… You&apos;ll have a public,
                verifiable URL in a single click.
              </p>
            </div>
            <Link href="/app" className="btn btn-primary btn-lg shrink-0 group">
              Open workspace
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
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
    <section className="mt-14">
      <h2 className="text-[22px] font-semibold tracking-tight text-foreground mb-3">
        {title}
      </h2>
      <div className="text-[13.5px] text-muted leading-relaxed">{children}</div>
    </section>
  );
}

function Step({
  n,
  title,
  body,
}: {
  n: number;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-4 items-start">
      <span className="size-8 rounded-full bg-accent-soft border border-accent/30 text-accent flex items-center justify-center text-[12px] font-semibold shrink-0">
        {n}
      </span>
      <div>
        <div className="text-[14px] font-semibold text-foreground mb-0.5">
          {title}
        </div>
        <p className="text-[13px] text-muted leading-relaxed">{body}</p>
      </div>
    </li>
  );
}
