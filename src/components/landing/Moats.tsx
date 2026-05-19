"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  Sparkles,
  Network,
  ArrowRight,
  User,
  Library,
  Inbox,
  Target,
  FileSignature,
} from "lucide-react";
import { SectionHeader } from "./Features";

const EASE = [0.2, 0.7, 0.2, 1] as [number, number, number, number];

const MOATS = [
  {
    eyebrow: "Moat · 01 — shipped",
    icon: <FileSignature className="size-5" />,
    title: "The Authorship Ledger",
    body: "A signed, reviewer-verifiable disclosure of how much of your manuscript was written by you vs. AI. Built on the provenance chain; ready-made venue text for NeurIPS, Nature, ACL, ICML.",
    bullets: [
      "Per-paper breakdown — human / AI-sourced / AI-unsourced / imported",
      "ECDSA-P256 signed with your workspace key — Atlas can't forge it",
      "Pre-baked disclosure text for the venues that require it",
    ],
    link: { href: "/authorship", label: "See how it works" },
    Visual: AuthorshipVisual,
  },
  {
    eyebrow: "Moat · 02",
    icon: <ShieldCheck className="size-5" />,
    title: "The Provenance Ledger",
    body: "Every AI-touched character carries a verifiable chain back to its source. Drop the ledger into our public verifier and get a one-page AI-disclosure report.",
    bullets: [
      "Per-event SHA-256 chain; tampering breaks at the offending index",
      "Unsourced claims bucketed before they reach the page",
      "Open JSON-LD schema — any tool can read or write compatible ledgers",
    ],
    link: { href: "/verify", label: "Try the verifier" },
    Visual: ProvenanceVisual,
  },
  {
    eyebrow: "Moat · 03 — free, local-first",
    icon: <Network className="size-5" />,
    title: "The Lab Graph",
    body: "Your lab's writing memory — voice, library, rules, members — bundled into a portable capsule. Free, local-first. The Lab tier only adds realtime sync on top.",
    bullets: [
      "Members + per-member voice fingerprint snapshots",
      "Rules across voice / citation / structure / submission",
      "One-click capsule export + import for new PhDs joining",
    ],
    link: { href: "/app", label: "Open Settings → Lab graph" },
    Visual: LabGraphVisual,
  },
];

export function Moats() {
  return (
    <section
      id="moats"
      className="py-32 px-5 border-t border-border relative overflow-hidden"
    >
      <div
        className="absolute inset-0 -z-10 opacity-40 blur-3xl pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at top, color-mix(in srgb, var(--accent) 14%, transparent), transparent 65%)",
        }}
      />
      <div className="max-w-[1200px] mx-auto">
        <SectionHeader
          eyebrow="What makes Atlas unreplicable"
          title="Three moats. Each one names the artifact."
          body="Three signed records — what the AI did, who wrote what, how your lab works — that competitors can't ship without rebuilding the editor underneath. All three are shipped today, all three are verifiable."
        />
        <div className="mt-24 space-y-32">
          {MOATS.map((m, i) => (
            <MoatRow key={m.title} moat={m} reversed={i % 2 === 1} />
          ))}
        </div>

      </div>
    </section>
  );
}

function MoatRow({
  moat,
  reversed,
}: {
  moat: (typeof MOATS)[number];
  reversed: boolean;
}) {
  const Visual = moat.Visual;
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
      }}
      className={`grid lg:grid-cols-2 gap-12 lg:gap-20 items-center ${
        reversed ? "lg:[&>div:first-child]:order-2" : ""
      }`}
    >
      <div>
        <motion.div
          variants={fadeUp}
          className="text-[11px] font-mono uppercase tracking-[0.22em] text-subtle mb-5 flex items-center gap-2.5"
        >
          <span className="text-accent">{moat.eyebrow}</span>
        </motion.div>
        <motion.h3
          variants={fadeUp}
          className="text-[36px] sm:text-[40px] leading-[1.08] tracking-[-0.02em] font-semibold text-foreground mb-5"
        >
          {moat.title}
        </motion.h3>
        <motion.p
          variants={fadeUp}
          className="text-[16px] text-muted leading-relaxed mb-6"
        >
          {moat.body}
        </motion.p>
        <motion.ul
          variants={fadeUp}
          className="space-y-2 text-[14px] text-foreground mb-7"
        >
          {moat.bullets.map((b) => (
            <motion.li
              key={b}
              variants={fadeUp}
              className="flex items-start gap-2.5"
            >
              <span className="size-1.5 rounded-full bg-accent mt-2 shrink-0" />
              <span>{b}</span>
            </motion.li>
          ))}
        </motion.ul>
        <motion.div variants={fadeUp}>
          <Link
            href={moat.link.href}
            className="btn h-9 text-[13px] text-muted hover:text-foreground"
          >
            {moat.link.label}
            <ArrowRight className="size-3.5" />
          </Link>
        </motion.div>
      </div>
      <motion.div variants={visualVariant}>
        <Visual />
      </motion.div>
    </motion.div>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: EASE },
  },
};

const visualVariant = {
  hidden: { opacity: 0, y: 30, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.7, ease: EASE },
  },
};

function AuthorshipVisual() {
  const rows = [
    { label: "Human author", value: 62.4, tone: "accent" as const },
    { label: "AI · sourced", value: 18.1, tone: "info" as const },
    { label: "AI · unsourced", value: 11.3, tone: "warning" as const },
    { label: "Imported", value: 8.2, tone: "subtle" as const },
  ];
  return (
    <div className="panel rounded-xl overflow-hidden shadow-[0_30px_80px_-30px_rgba(0,0,0,0.4)]">
      <div className="h-7 px-3 flex items-center gap-2 border-b border-border bg-surface-2 text-[10px] font-mono uppercase tracking-[0.15em] text-subtle">
        <span className="size-1.5 rounded-full bg-accent" />
        atlas authorship attestation · neurips disclosure
      </div>
      <div className="p-5 space-y-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.15em] text-subtle font-mono mb-2">
            Breakdown · 18,420 chars
          </div>
          <div className="h-1.5 rounded-full overflow-hidden bg-surface-2 flex mb-3">
            {rows.map((r) => (
              <span
                key={r.label}
                className={
                  r.tone === "accent"
                    ? "bg-accent"
                    : r.tone === "info"
                      ? "bg-info"
                      : r.tone === "warning"
                        ? "bg-warning"
                        : "bg-subtle"
                }
                style={{ width: `${r.value}%` }}
              />
            ))}
          </div>
          <ul className="space-y-1.5">
            {rows.map((r, i) => (
              <motion.li
                key={r.label}
                initial={{ opacity: 0, x: -6 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.05 * i, duration: 0.35 }}
                className="flex items-center gap-2 text-[11.5px]"
              >
                <span
                  className={
                    r.tone === "accent"
                      ? "size-1.5 rounded-full bg-accent"
                      : r.tone === "info"
                        ? "size-1.5 rounded-full bg-info"
                        : r.tone === "warning"
                          ? "size-1.5 rounded-full bg-warning"
                          : "size-1.5 rounded-full bg-subtle"
                  }
                />
                <span className="text-foreground flex-1">{r.label}</span>
                <span className="text-subtle font-mono tabular-nums">
                  {r.value.toFixed(1)}%
                </span>
              </motion.li>
            ))}
          </ul>
        </div>
        <div className="pt-3 border-t border-border space-y-1.5 text-[10.5px] font-mono text-subtle">
          <div className="flex justify-between gap-3">
            <span>signature</span>
            <span className="text-accent">valid · key fp 3b81…</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>ledger root</span>
            <span className="text-foreground truncate">e0c742aa…fb</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>orcid</span>
            <span className="text-foreground">0000-0002-1825-0097</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProvenanceVisual() {
  const events = [
    {
      kind: "ai-edit",
      label: "Atlas Agent · openai",
      ok: true,
      hash: "a3f1…",
    },
    {
      kind: "ai-cite",
      label: "Citation library",
      ok: true,
      hash: "b29c…",
    },
    {
      kind: "import",
      label: "PDF · Vaswani 2017",
      ok: true,
      hash: "c811…",
    },
    {
      kind: "ai-edit",
      label: "Atlas Agent · anthropic",
      ok: true,
      hash: "d04e…",
    },
  ];
  return (
    <div className="panel rounded-xl overflow-hidden shadow-[0_30px_80px_-30px_rgba(0,0,0,0.4)]">
      <div className="h-7 px-3 flex items-center gap-2 border-b border-border bg-surface-2 text-[10px] font-mono uppercase tracking-[0.15em] text-subtle">
        <span className="size-1.5 rounded-full bg-accent" />
        atlas verify · provenance.jsonld
      </div>
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="size-7 rounded-md bg-accent-soft border border-[#2d3d12] flex items-center justify-center text-accent">
            <ShieldCheck className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="text-[12px] font-semibold text-foreground">
              chain intact · 4 events
            </div>
            <div className="text-[10px] font-mono text-subtle truncate">
              root · e6a2f7b9c1d0…
            </div>
          </div>
          <div className="ml-auto text-[10px] font-mono uppercase tracking-[0.15em] text-accent">
            valid
          </div>
        </div>
        <div className="h-3 rounded-full bg-surface-3 overflow-hidden flex">
          <motion.span
            initial={{ width: 0 }}
            whileInView={{ width: "44%" }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: EASE }}
            className="bg-foreground"
          />
          <motion.span
            initial={{ width: 0 }}
            whileInView={{ width: "32%" }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
            className="bg-accent"
          />
          <motion.span
            initial={{ width: 0 }}
            whileInView={{ width: "16%" }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
            className="bg-info"
          />
          <motion.span
            initial={{ width: 0 }}
            whileInView={{ width: "8%" }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.3, ease: EASE }}
            className="bg-warning"
          />
        </div>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10.5px]">
          <Legend color="bg-foreground" label="Author" value="44%" />
          <Legend color="bg-accent" label="AI · sourced" value="32%" />
          <Legend color="bg-info" label="AI · unsourced" value="16%" />
          <Legend color="bg-warning" label="Imported" value="8%" />
        </ul>
        <div className="pt-2 border-t border-border space-y-1.5">
          {events.map((e, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 + i * 0.08, duration: 0.4 }}
              className="flex items-center gap-2 text-[10.5px]"
            >
              <span className="size-4 rounded bg-accent-soft border border-[#2d3d12] text-accent flex items-center justify-center">
                <Sparkles className="size-2.5" />
              </span>
              <span className="text-foreground font-mono uppercase tracking-[0.1em] text-[9.5px]">
                {e.kind}
              </span>
              <span className="text-muted">{e.label}</span>
              <span className="ml-auto font-mono text-subtle">{e.hash}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LabGraphVisual() {
  return (
    <div className="panel rounded-xl overflow-hidden shadow-[0_30px_80px_-30px_rgba(0,0,0,0.4)]">
      <div className="h-7 px-3 flex items-center gap-2 border-b border-border bg-surface-2 text-[10px] font-mono uppercase tracking-[0.15em] text-subtle">
        <span className="size-1.5 rounded-full bg-accent" />
        smith lab · workspace
      </div>
      <div className="p-5 space-y-4">
        <div className="text-[10px] uppercase tracking-[0.15em] text-subtle font-mono">
          People
        </div>
        <ul className="grid grid-cols-3 gap-2">
          {[
            { name: "Smith", role: "PI", color: "bg-accent" },
            { name: "Chen", role: "PhD · 4y", color: "bg-info" },
            { name: "Doe", role: "Postdoc", color: "bg-warning" },
            { name: "Liu", role: "PhD · 2y", color: "bg-foreground/60" },
            { name: "Patel", role: "PhD · 1y", color: "bg-foreground/60" },
            { name: "+ you", role: "PhD · new", color: "bg-accent" },
          ].map((p) => (
            <li
              key={p.name}
              className="border border-border rounded p-2 flex items-center gap-2"
            >
              <span className={`size-2 rounded-full ${p.color}`} />
              <span className="text-[11.5px] text-foreground font-medium">
                {p.name}
              </span>
              <span className="ml-auto text-[9.5px] font-mono text-subtle">
                {p.role}
              </span>
            </li>
          ))}
        </ul>
        <div className="text-[10px] uppercase tracking-[0.15em] text-subtle font-mono pt-2 border-t border-border">
          Shared infrastructure
        </div>
        <ul className="space-y-1.5 text-[11.5px]">
          {[
            { icon: <User className="size-3 text-accent" />, label: "Advisor voice profile", value: "v 4.2 · 14 papers" },
            { icon: <Library className="size-3 text-accent" />, label: "Lab citation library", value: "2,840 sources" },
            { icon: <Target className="size-3 text-accent" />, label: "Group style rules", value: "37 rules" },
            { icon: <Inbox className="size-3 text-accent" />, label: "Reviewer pattern memory", value: "126 responses" },
          ].map((row) => (
            <li
              key={row.label}
              className="flex items-center gap-2 py-1.5 border-b border-border last:border-0"
            >
              {row.icon}
              <span className="text-foreground">{row.label}</span>
              <span className="ml-auto font-mono text-subtle">{row.value}</span>
            </li>
          ))}
        </ul>
        <div className="text-[10.5px] text-accent flex items-center gap-1 pt-1">
          <ShieldCheck className="size-3" />
          New member imports the lab capsule and inherits every row above.
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="border border-border rounded-lg py-2 px-1">
      <div className="text-[9.5px] uppercase tracking-[0.15em] text-subtle font-mono">
        {label}
      </div>
      <div
        className={`text-[18px] font-semibold tracking-tight ${
          accent ? "text-accent" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Legend({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <li className="flex items-center gap-1.5">
      <span className={`size-2 rounded-sm ${color}`} />
      <span className="text-muted">{label}</span>
      <span className="ml-auto font-mono text-foreground">{value}</span>
    </li>
  );
}
