"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Check, ArrowRight } from "lucide-react";
import { SectionHeader } from "./Features";
import { cn } from "@/lib/cn";

const TIERS = [
  {
    name: "Free",
    blurb: "For one paper, on one laptop.",
    price: "$0",
    period: "forever",
    cta: "Start free",
    href: "/app",
    highlighted: false,
    features: [
      "Full editor + agent + analyzer",
      "Bring your own OpenAI / Anthropic key",
      "PDF import, LaTeX export, voice profile",
      "Provenance Ledger + public Verify route",
      "Lab Graph (local members, rules, capsule export/import)",
      "Local-first — drafts never leave your browser",
    ],
  },
  {
    name: "Pro",
    blurb: "For the PhD running multiple drafts and submissions.",
    price: "$19",
    period: "/ month",
    cta: "Start 14-day trial",
    href: "/app?upgrade=pro",
    highlighted: true,
    features: [
      "Everything in Free",
      "Managed AI — no key required, fair-use unlimited",
      "Sync your workspace + Lab capsule across devices",
      "Nia citation library included (1,000 sources)",
      "Priority response-to-reviewers drafting",
      "Workspace history & version diffs",
    ],
  },
  {
    name: "Lab",
    blurb: "Adds multi-user realtime on top of the same Lab Graph.",
    price: "$59",
    period: "/ seat / month",
    cta: "Talk to us",
    href: "mailto:lab@paper-atlas.com",
    highlighted: false,
    features: [
      "Everything in Pro",
      "Realtime co-authoring with suggestion mode",
      "Live Lab Graph sync across the whole group",
      "Centralised billing & SSO",
      "Custom venue rubrics per group",
      "Dedicated onboarding session",
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
          body="Everything that runs in your browser is free, forever. Pro adds managed AI + sync. Lab adds realtime multi-user."
        />
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
          }}
          className="mt-16 grid gap-5 md:grid-cols-3"
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
                {t.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="size-4 text-accent mt-0.5 shrink-0" />
                    <span className="text-foreground/85">{f}</span>
                  </li>
                ))}
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
