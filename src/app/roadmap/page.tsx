import Link from "next/link";
import { LandingNav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { Check, Clock, Compass, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Atlas — Roadmap",
  description:
    "What ships in Atlas, plainly: what's done, what's being worked on now, what's planned soon, and what's later.",
  alternates: { canonical: "/roadmap" },
};

type Status = "shipped" | "now" | "soon" | "later";

interface Item {
  status: Status;
  title: string;
  body: string;
  link?: { href: string; label: string };
}

const ITEMS: Item[] = [
  // shipped
  {
    status: "shipped",
    title: "Provenance Ledger with ECDSA-P256 signing",
    body: "Per-workspace Web Crypto keypair, hash-chained per-event, signature embedded alongside the root hash. Public verifier validates both.",
    link: { href: "/verify", label: "Verify" },
  },
  {
    status: "shipped",
    title: "Reproducibility Spine v1",
    body: "Bind sentences to W&B / GitHub / arXiv / DOI / Jupyter / generic URLs. Kind-specific freshness probes via /api/binding/check.",
  },
  {
    status: "shipped",
    title: "Real OpenReview corpus probe",
    body: "Live public-API integration on /reviewer-model — sample (paper, reviews) tuples from ICLR v1 + v2 archives.",
    link: { href: "/reviewer-model", label: "See the corpus" },
  },
  {
    status: "shipped",
    title: "Atlas Honesty Badge",
    body: "Dynamic SVG embeddable in arXiv comments, README, PDF. Linked from the public verifier.",
  },
  {
    status: "shipped",
    title: "Voice profile + sourced editing + 4-mode agent",
    body: "Edit / Ask / Plan / Cite per ⌘L, inline diff with Accept / Reject, voice fingerprint injected as hard constraints.",
  },
  {
    status: "shipped",
    title: "Rubric-graded venue critic",
    body: "8 venue presets — NeurIPS / ICLR / ACL / Nature / JAMA / Cell / thesis / generic. Click any score to see the rubric line that drove it.",
  },
  {
    status: "shipped",
    title: "Response-to-Reviewers studio",
    body: "Paste reviewer text, parse per item, draft grounded responses, export venue-ready letter.",
  },
  {
    status: "shipped",
    title: "Lab Graph + capsule export/import",
    body: "Real Lab entity in Settings — members, rules, shared sources, voice fingerprint. Portable .atlaslab-capsule.jsonld for onboarding labmates.",
  },
  {
    status: "shipped",
    title: "Public auth (Clerk) wired in fallback-safe mode",
    body: "Drop your Clerk keys into .env.local and accounts flip on. Without keys, Atlas runs key-less.",
    link: { href: "/sign-up", label: "Sign up" },
  },

  // now
  {
    status: "now",
    title: "Cloud sync for Pro tier",
    body: "End-to-end encrypted workspace bundle synced across devices. Workspace key derived per-account; server holds the ciphertext.",
  },
  {
    status: "now",
    title: "Atlas Reviewer Model · corpus pipeline",
    body: "Stitching OpenReview + ACL Anthology + arXiv-with-public-reviews into clean (paper, review, decision) tuples. Numbers ship to the changelog when they're real.",
  },
  {
    status: "now",
    title: "Realtime co-authoring (Lab tier)",
    body: "Y.js-backed multiplayer with presence cursors and suggestion mode. Public test on a private cohort first.",
  },

  // soon
  {
    status: "soon",
    title: "Mobile-responsive read mode",
    body: "Open any imported PDF + the ledger + the analyzer report on iPad / phone. Editing stays desktop-first for now.",
  },
  {
    status: "soon",
    title: "Zotero / Mendeley bridge",
    body: "Pull existing libraries in, sync new citations back. The bulk of researchers already manage references somewhere.",
  },
  {
    status: "soon",
    title: "Direct arXiv + OpenReview submission",
    body: "Press a button, get a deposit / submission. Atlas writes the disclosure section automatically.",
  },
  {
    status: "soon",
    title: "Word / Google Docs round-trip export",
    body: "For the advisor who only edits in Word. Provenance survives the round-trip.",
  },

  // later
  {
    status: "later",
    title: "Atlas Reviewer Model · v0.5 model release",
    body: "Trunk + venue heads released under a permissive license once each clears its held-out benchmark.",
  },
  {
    status: "later",
    title: "Custom academic embedding model",
    body: "Fine-tuned on OpenAlex + citation graph. Backbone for the citation library and separately licensable.",
  },
  {
    status: "later",
    title: "Lab Review Marketplace",
    body: "Junior researchers pay senior researchers in their field for structured pre-review against the venue rubric.",
  },
  {
    status: "later",
    title: "Atlas Disclosure Standard",
    body: "Publish the provenance JSON-LD schema, partner with one ML venue and one bio venue to make it the required disclosure format.",
  },
];

const STATUS_META: Record<
  Status,
  { label: string; icon: React.ReactNode; tone: string }
> = {
  shipped: {
    label: "Shipped",
    icon: <Check className="size-3.5" />,
    tone: "text-accent",
  },
  now: {
    label: "Now",
    icon: <Clock className="size-3.5" />,
    tone: "text-info",
  },
  soon: {
    label: "Soon",
    icon: <Compass className="size-3.5" />,
    tone: "text-warning",
  },
  later: {
    label: "Later",
    icon: <Compass className="size-3.5" />,
    tone: "text-subtle",
  },
};

export default function RoadmapPage() {
  const grouped: Record<Status, Item[]> = {
    shipped: [],
    now: [],
    soon: [],
    later: [],
  };
  for (const it of ITEMS) grouped[it.status].push(it);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNav />
      <main className="pt-28 pb-20 px-5">
        <div className="max-w-[1000px] mx-auto">
          <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-accent mb-3">
            Roadmap
          </div>
          <h1 className="text-[48px] sm:text-[64px] leading-[1.02] tracking-[-0.025em] font-semibold">
            What ships next, plainly.
          </h1>
          <p className="mt-6 max-w-[640px] text-[15.5px] text-muted leading-relaxed">
            No vague "coming soon" — every item is in one of four buckets, with
            a clear definition: <strong>shipped</strong> is in production now,{" "}
            <strong>now</strong> is in active development, <strong>soon</strong> is the
            next quarter, <strong>later</strong> is the year-ish horizon. We
            move items between buckets as we ship; the date this page was last
            built is the source of truth.
          </p>

          <div className="mt-14 space-y-14">
            {(["shipped", "now", "soon", "later"] as Status[]).map((status) => (
              <section key={status}>
                <div className="flex items-baseline gap-3 mb-5 text-[12px] font-mono uppercase tracking-[0.22em]">
                  <span className={STATUS_META[status].tone}>
                    {STATUS_META[status].label}
                  </span>
                  <span className="text-subtle">
                    · {grouped[status].length} item
                    {grouped[status].length === 1 ? "" : "s"}
                  </span>
                </div>
                <ul className="space-y-3">
                  {grouped[status].map((it, i) => (
                    <li
                      key={i}
                      className="grid grid-cols-[20px_1fr] gap-4 items-start border-b border-border pb-3"
                    >
                      <span
                        className={`mt-1 ${STATUS_META[status].tone} shrink-0`}
                      >
                        {STATUS_META[status].icon}
                      </span>
                      <div>
                        <div className="text-[14.5px] font-semibold text-foreground leading-snug">
                          {it.title}
                        </div>
                        <p className="text-[13.5px] text-muted leading-relaxed mt-1">
                          {it.body}
                        </p>
                        {it.link && (
                          <Link
                            href={it.link.href}
                            className="mt-1.5 inline-flex items-center gap-1 text-[12px] text-accent underline underline-offset-2"
                          >
                            {it.link.label}
                            <ArrowRight className="size-3" />
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <div className="mt-16 pt-8 border-t border-border text-[13px] text-subtle leading-relaxed">
            Something missing? Tell us at{" "}
            <a
              className="text-accent underline underline-offset-2"
              href="mailto:hello@paper-atlas.com"
            >
              hello@paper-atlas.com
            </a>
            . Roadmap requests from real labs jump the queue.
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
