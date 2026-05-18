import Link from "next/link";
import { LandingNav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { ReviewerModelClient } from "./ReviewerModelClient";

export const metadata = {
  title: "Atlas — The Atlas Reviewer Model (roadmap)",
  description:
    "We are training a domain-specific reviewer model on the public OpenReview / ACL / arXiv-public-review corpora. Here is exactly what is shipped today, what is on the roadmap, and how to opt-in to the training corpus.",
};

const CORPUS = [
  {
    name: "OpenReview",
    detail: "ICLR · NeurIPS · TMLR · ARR · CoRL",
    license: "Public; redistributable per OpenReview API terms",
    stage: "ingestion pipeline in progress",
  },
  {
    name: "ACL Anthology",
    detail: "ACL · EMNLP · NAACL · COLING · TACL",
    license: "Public; CC BY 4.0 on metadata + PDFs",
    stage: "metadata schema mapped; full text pending",
  },
  {
    name: "arXiv with public review threads",
    detail: "Papers cross-posted with OpenReview / F1000 reviews",
    license: "Public; arXiv non-exclusive license",
    stage: "linker spec drafted; no rows ingested yet",
  },
  {
    name: "Accepted-paper diffs",
    detail: "arXiv v1 → camera-ready textual diff for accepted submissions",
    license: "Derived; redistribution restricted to weights / metrics",
    stage: "diff tooling prototyped; not run at scale",
  },
  {
    name: "Atlas user signal",
    detail:
      "Anonymised (draft, suggestion, decision) tuples from users who opt-in",
    license: "User-controlled; per-paper deletable",
    stage: "opt-in flow live (below); no contributions used in training yet",
  },
];

const HEADS = [
  "NeurIPS / ICML",
  "ICLR",
  "ACL / EMNLP",
  "Nature / Science",
  "JAMA / NEJM",
  "Cell / Mol Bio",
  "PhD thesis chapter",
];

const PRINCIPLES = [
  {
    title: "Open weights",
    body: "Trunk + venue heads released under a permissive license once each clears the held-out benchmark. Other tools can use them.",
  },
  {
    title: "Open evaluation",
    body: "Held-out review-pair benchmark per venue, published alongside each release. We grade ourselves the same way reviewers grade papers.",
  },
  {
    title: "Opt-in supervision",
    body: "User signal is never collected by default. Opt-in is per paper, anonymised before it touches the training pipeline, and revocable from Settings or this page.",
  },
  {
    title: "Deletion that actually deletes",
    body: "Opting out removes your signal from the next training run. Every model release documents its training cutoff so deletions are verifiable.",
  },
];

export default function ReviewerModelPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNav />
      <main className="pt-28 pb-20 px-5">
        <div className="max-w-[1000px] mx-auto">
          <div className="flex items-center gap-3 mb-3 text-[11px] font-mono uppercase tracking-[0.22em]">
            <span className="text-accent">The Atlas Reviewer Model</span>
            <span className="h-px w-6 bg-border" />
            <span className="text-warning">Roadmap · not yet shipped</span>
          </div>
          <h1 className="text-[44px] sm:text-[56px] leading-[1.05] tracking-[-0.025em] font-semibold">
            A reviewer-2 simulator that&apos;s actually trained on reviewer-2s.
          </h1>
          <p className="mt-5 max-w-[680px] text-[15px] text-muted leading-relaxed">
            General-purpose LLMs do a passable Reviewer-2 impression. The
            Atlas Reviewer Model aims to do it for real — by fine-tuning a
            domain-specific trunk on the public OpenReview, ACL Anthology, and
            arXiv-with-public-review corpora, with venue-specific heads. The
            page below names exactly what is shipped today (the heuristic
            forecast in the workspace, the opt-in flow on this page, the
            corpus pipeline as a public spec) and what is still on the
            roadmap.
          </p>

          <Section title="What ships today">
            <ul className="grid sm:grid-cols-2 gap-3">
              {[
                {
                  title: "Heuristic submission forecast",
                  body: "The accept-probability gauge in the analyzer drawer is a transparent rubric-to-logit transform, calibrated against published venue acceptance rates. It's the interim forecast the Reviewer Model will improve on.",
                  href: "/app",
                  cta: "See it in the workspace",
                },
                {
                  title: "Public corpus spec",
                  body: "The five-source corpus below is published with each source's license, redistribution rules, and current ingestion stage. No specific row counts until the data is in our hands.",
                  href: "#corpus",
                  cta: "Read the corpus",
                },
                {
                  title: "Opt-in flow + counter",
                  body: "You can opt your finalised papers into the future training corpus from below. Atlas tracks your decision locally; the page surfaces the running count of contributors.",
                  href: "#opt-in",
                  cta: "Decide below",
                },
                {
                  title: "Provenance ledger",
                  body: "Every AI edit recorded in the workspace is hash-chained and exportable. Reviewers can verify any draft's AI-disclosure breakdown publicly — independent of whether our reviewer model exists yet.",
                  href: "/verify",
                  cta: "Try the verifier",
                },
              ].map((c) => (
                <li key={c.title} className="panel p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="size-1.5 rounded-full bg-accent" />
                    <span className="text-[13px] font-semibold text-foreground">
                      {c.title}
                    </span>
                  </div>
                  <p className="text-[12.5px] text-muted leading-relaxed mb-2">
                    {c.body}
                  </p>
                  <Link
                    href={c.href}
                    className="text-[12px] text-accent underline underline-offset-2"
                  >
                    {c.cta} →
                  </Link>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Target corpus" id="corpus">
            <p className="mb-5">
              Five sources. Four public, one opt-in. We disclose the source,
              the license, and the current ingestion stage — and nothing else.
              When a source has measurable size we ship in the trained model
              we will name it then, not before.
            </p>
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-[13px]">
                <thead className="bg-surface-2">
                  <tr className="text-[10px] font-mono uppercase tracking-[0.15em] text-subtle">
                    <th className="text-left px-4 py-2.5 font-medium">Source</th>
                    <th className="text-left px-4 py-2.5 font-medium">Coverage</th>
                    <th className="text-left px-4 py-2.5 font-medium">License</th>
                    <th className="text-left px-4 py-2.5 font-medium">Stage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {CORPUS.map((c) => (
                    <tr key={c.name}>
                      <td className="px-4 py-3 text-foreground font-medium align-top">
                        {c.name}
                      </td>
                      <td className="px-4 py-3 text-muted align-top">
                        {c.detail}
                      </td>
                      <td className="px-4 py-3 text-subtle text-[12px] align-top">
                        {c.license}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-[0.12em] border border-warning/40 bg-warning/5 text-warning whitespace-nowrap">
                          {c.stage}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Target venue heads">
            <p className="mb-5">
              One shared trunk + a head per venue so adding a venue is
              incremental, not a re-fine-tune. Every head below is on the
              roadmap — none are trained or in evaluation yet.
            </p>
            <ul className="grid sm:grid-cols-2 gap-2">
              {HEADS.map((venue) => (
                <li
                  key={venue}
                  className="border border-border rounded-lg p-3 flex items-center gap-3"
                >
                  <span className="size-2 rounded-full bg-subtle/40" />
                  <span className="text-[13px] text-foreground">{venue}</span>
                  <span className="ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[0.15em] border border-border bg-surface-2 text-subtle">
                    roadmap
                  </span>
                </li>
              ))}
            </ul>
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

          <div id="opt-in">
            <ReviewerModelClient />
          </div>

          <Section title="Why isn't it trained yet?">
            <p className="mb-3">
              Two reasons, plainly stated:
            </p>
            <ul className="space-y-2 list-disc pl-5">
              <li>
                Stitching OpenReview + ACL Anthology + arXiv into clean (paper,
                review, decision) tuples is the work, and it is not a weekend
                of scraping. Doing it correctly — handling rebuttals, meta
                reviews, withdrawn submissions, retracted papers — is what
                makes the resulting model worth running.
              </li>
              <li>
                We would rather ship the heuristic forecast and the
                provenance ledger now (so the workspace is genuinely useful)
                and publish the corpus pipeline + model when the eval clears
                our bar, than market a trained model that does not exist.
              </li>
            </ul>
            <p className="mt-4">
              When numbers ship in the trained model, they appear here and on{" "}
              <Link href="/docs#changelog" className="text-accent underline">
                /docs#changelog
              </Link>{" "}
              the same day. Until then this page shows scope, not statistics.
            </p>
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
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="mt-16 pt-8 border-t border-border text-[14.5px] text-muted leading-relaxed"
    >
      <h2 className="text-[26px] font-semibold tracking-tight text-foreground mb-5">
        {title}
      </h2>
      {children}
    </section>
  );
}
