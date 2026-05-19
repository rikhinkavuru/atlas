"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Check, ArrowRight } from "lucide-react";
import { SectionHeader } from "./Features";
import { cn } from "@/lib/cn";

/**
 * Feature item shapes:
 *   string                                 → shipped and gated to this tier
 *   { text, status: "shipped-free" }       → present today, technically free —
 *                                            we keep it in the higher tier's
 *                                            "everything in lower + ..." line.
 *   { text, status: "roadmap" }            → planned, not shipped. Labeled as
 *                                            "Coming soon" in the UI.
 *   { text, status: "beta" }               → shipped behind an env-var flag,
 *                                            not yet enforced by tier.
 */
type FeatureItem = string | { text: string; status: "roadmap" | "beta" };

const TIERS: {
  name: string;
  blurb: string;
  price: string;
  period: string;
  cta: string;
  href: string;
  highlighted: boolean;
  features: FeatureItem[];
}[] = [
  {
    name: "Free",
    blurb:
      "Single-author. Local-first. Everything that runs in your browser.",
    price: "$0",
    period: "forever",
    cta: "Start free",
    href: "/app",
    highlighted: false,
    features: [
      "Full editor + agent + Paper Critic + Reviewer-2 simulator",
      "Bring your own OpenAI / Anthropic key — or run Ollama locally for $0",
      "Venue rubrics (NeurIPS / ICLR / ACL / Nature / JAMA / Cell) + calibration vs live OpenReview",
      "Provenance Ledger + signed events + /verify viewer",
      "Lab Capsule export / import (members, rules, voice, library)",
      "PDF import, LaTeX export, math equations, figures, cross-references",
      "Bibliography in APA / Chicago / MLA / Vancouver / IEEE",
      "Drafts never leave your browser",
    ],
  },
  {
    name: "Pro",
    blurb:
      "Public ledger URLs, server-resolved citations, and cross-device sync.",
    price: "$20",
    period: "/ month",
    cta: "Start 14-day trial",
    href: "/app?upgrade=pro",
    highlighted: true,
    features: [
      "Everything in Free",
      "Public ledger URLs (/p/<shareKey>) with durable Vercel Blob storage",
      "Hosted citation verification — CrossRef + OpenAlex + Semantic Scholar + arXiv",
      "OpenReview corpus probe for venue calibration",
      "Atlas pays the API bill — BYOK still works",
      { text: "Workspace + Lab Capsule sync across devices", status: "roadmap" },
      { text: "Priority queue for response-to-reviewers drafting", status: "roadmap" },
    ],
  },
  {
    name: "Lab",
    blurb: "Real-time multi-author editing with a shared Lab Graph.",
    price: "$60",
    period: "/ seat / month",
    cta: "Start lab trial",
    href: "/app?upgrade=lab",
    highlighted: false,
    features: [
      "Everything in Pro",
      { text: "Real-time co-authoring (Yjs + Liveblocks) with live presence", status: "beta" },
      "Multi-author Track Changes log, color-coded per peer",
      { text: "Shared Lab Graph propagates voice + library + rules live", status: "roadmap" },
      { text: "Custom venue rubrics per lab", status: "roadmap" },
      { text: "Centralised billing + SSO", status: "roadmap" },
      { text: "Up to 5 seats with seat-level enforcement", status: "roadmap" },
    ],
  },
  {
    name: "Enterprise",
    blurb: "Universities, journals, and venues running Atlas at scale.",
    price: "Talk",
    period: "to us",
    cta: "Contact sales",
    href: "mailto:lab@paper-atlas.com",
    highlighted: false,
    features: [
      "Everything in Lab",
      { text: "Self-hosted ledger storage (Postgres / S3-compatible)", status: "roadmap" },
      { text: "SSO via SAML / OIDC; SCIM provisioning", status: "roadmap" },
      { text: "Audit logs + retention controls", status: "roadmap" },
      { text: "Custom rubric tuning + per-venue calibration reports", status: "roadmap" },
      "Priority issue routing + named onboarding",
    ],
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.2, 0.7, 0.2, 1] as [number, number, number, number] },
  },
};

export function Pricing() {
  return (
    <section id="pricing" className="py-32 px-5 border-t border-border">
      <div className="max-w-[1200px] mx-auto">
        <SectionHeader
          eyebrow="Pricing"
          title="Free for one researcher. Fair for a lab."
          body="Everything that runs in your browser is free, forever — including the agent, Paper Critic, Reviewer-2 simulator, and provenance ledger. Pair it with Ollama for $0/token. Pro adds public ledger URLs + managed citation verification. Lab adds realtime multi-user."
        />
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
          }}
          className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-4"
        >
          {TIERS.map((t) => (
            <motion.div
              key={t.name}
              variants={fadeUp}
              whileHover={{ y: -3 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              className={cn(
                "panel p-7 flex flex-col rounded-2xl transition-colors",
                t.highlighted &&
                  "border-accent/60 shadow-[0_0_80px_-30px_color-mix(in_srgb,var(--accent)_45%,transparent)]",
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[18px] font-semibold tracking-tight">
                  {t.name}
                </h3>
                {t.highlighted && (
                  <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-accent">
                    Most popular
                  </span>
                )}
              </div>
              <p className="text-[12.5px] text-subtle">{t.blurb}</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-[42px] font-semibold tracking-tight text-foreground">
                  {t.price}
                </span>
                <span className="text-[12.5px] text-subtle">{t.period}</span>
              </div>
              <Link
                href={t.href}
                className={cn(
                  "mt-6 btn h-10 text-[13px] justify-center",
                  t.highlighted && "btn-primary",
                )}
              >
                {t.cta}
                <ArrowRight className="size-3.5" />
              </Link>
              <ul className="mt-6 space-y-2 text-[13px]">
                {t.features.map((f, i) => {
                  const isObj = typeof f === "object";
                  const text = isObj ? f.text : f;
                  const status = isObj ? f.status : null;
                  return (
                    <li key={i} className="flex items-start gap-2">
                      <Check
                        className={cn(
                          "size-4 mt-0.5 shrink-0",
                          status === "roadmap"
                            ? "text-subtle/60"
                            : status === "beta"
                              ? "text-warning"
                              : "text-accent",
                        )}
                      />
                      <span
                        className={cn(
                          "flex-1",
                          status === "roadmap"
                            ? "text-foreground/60"
                            : "text-foreground/85",
                        )}
                      >
                        {text}
                        {status === "roadmap" && (
                          <span className="ml-1.5 inline-flex items-center px-1 py-px rounded-full text-[9px] font-mono uppercase tracking-[0.12em] border border-border bg-surface-2 text-subtle align-middle">
                            roadmap
                          </span>
                        )}
                        {status === "beta" && (
                          <span className="ml-1.5 inline-flex items-center px-1 py-px rounded-full text-[9px] font-mono uppercase tracking-[0.12em] border border-warning/40 bg-warning/5 text-warning align-middle">
                            beta · needs env vars
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          ))}
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="text-center text-[11px] text-subtle mt-10"
        >
          Students get 50% off Pro with a .edu email. Open-source maintainers
          and underrepresented researchers, write to{" "}
          <a
            className="text-accent underline underline-offset-2"
            href="mailto:hello@paper-atlas.com"
          >
            hello@paper-atlas.com
          </a>
          .
        </motion.p>
      </div>
    </section>
  );
}
