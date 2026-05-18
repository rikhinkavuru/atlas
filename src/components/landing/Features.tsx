"use client";

import { motion } from "framer-motion";
import {
  FileText,
  Sparkles,
  ShieldCheck,
  Wand2,
  Inbox,
  Library,
  Target,
  Mic,
  Check,
} from "lucide-react";

const FEATURES = [
  {
    icon: <FileText className="size-5" />,
    eyebrow: "Read",
    title: "Drop any PDF, get an editor",
    body: "Drag any PDF. We extract the text, detect sections, and open it as an editable paper — every tool works on it.",
    bullet: [
      "Multi-PDF drop, auto title + author + section detection",
      "Highlights, comments, and AI edits all land on the imported doc",
    ],
  },
  {
    icon: <Sparkles className="size-5" />,
    eyebrow: "Draft",
    title: "An AI agent that writes in your voice — and cites real sources",
    body: "Paste a paragraph of your prior writing. Atlas learns your cadence and matches it. Every citation gets verified against CrossRef, OpenAlex, Semantic Scholar, and your Nia library before it touches the page.",
    bullet: [
      "Voice fingerprint + banned-phrase list kill the “ChatGPT default” tells",
      "Edit · Ask · Plan · Cite per ⌘L, inline diff with per-chunk Accept / Reject",
      "Unsupported claims land in a “Needs citation” bucket, not in the draft",
    ],
  },
  {
    icon: <Wand2 className="size-5" />,
    eyebrow: "Critique",
    title: "Rubric-graded reviewer-2 simulator",
    body: "Pick a venue. Atlas grades your draft against its rubric, with the criteria and evidence shown for every score.",
    bullet: [
      "8 venue presets — NeurIPS, ICLR, ACL, Nature, JAMA, Cell, thesis, generic",
      "Click any critique line to jump to the passage in the editor",
    ],
  },
  {
    icon: <Inbox className="size-5" />,
    eyebrow: "Defend",
    title: "Reviewer 2, answered in one paste",
    body: "Paste reviewer text. Atlas splits it into items, drafts grounded responses in your voice, and exports the letter.",
    bullet: [
      "Draft-all sweeps every undrafted item at once",
      "Markdown letter export drops straight into OpenReview or the journal portal",
    ],
  },
];

export function Features() {
  return (
    <section id="features" className="py-32 px-5 border-t border-border">
      <div className="max-w-[1200px] mx-auto">
        <SectionHeader
          eyebrow="The workspace"
          title="One canvas. The whole arc of a paper."
          body="From a PDF on your desktop to the response letter at the journal — every step, one keystroke away."
        />
        <div className="mt-20 space-y-32">
          {FEATURES.map((f, i) => (
            <FeatureRow key={i} feature={f} reversed={i % 2 === 1} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureRow({
  feature,
  reversed,
  index,
}: {
  feature: (typeof FEATURES)[number];
  reversed: boolean;
  index: number;
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: 0.07 },
        },
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
          <span className="text-accent">0{index + 1}</span>
          <span className="h-px w-6 bg-border" />
          <span className="text-accent">{feature.eyebrow}</span>
        </motion.div>
        <motion.h3
          variants={fadeUp}
          className="text-[36px] sm:text-[40px] leading-[1.08] tracking-[-0.02em] font-semibold text-foreground mb-5"
        >
          {feature.title}
        </motion.h3>
        <motion.p
          variants={fadeUp}
          className="text-[16px] text-muted leading-relaxed mb-6"
        >
          {feature.body}
        </motion.p>
        <motion.ul variants={fadeUp} className="space-y-2 text-[14px] text-foreground">
          {feature.bullet.map((b, i) => (
            <motion.li
              key={i}
              variants={fadeUp}
              className="flex items-start gap-2.5"
            >
              <span className="size-1.5 rounded-full bg-accent mt-2 shrink-0" />
              <span>{b}</span>
            </motion.li>
          ))}
        </motion.ul>
      </div>
      <motion.div
        variants={mockFade}
        className="relative"
      >
        <FeatureMock eyebrow={feature.eyebrow} />
      </motion.div>
    </motion.div>
  );
}

const EASE = [0.2, 0.7, 0.2, 1] as [number, number, number, number];

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: EASE },
  },
};

const mockFade = {
  hidden: { opacity: 0, y: 30, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.7, ease: EASE },
  },
};

function FeatureMock({ eyebrow }: { eyebrow: string }) {
  if (eyebrow === "Read") return <MockRead />;
  if (eyebrow === "Draft") return <MockDraftWithCite />;
  if (eyebrow === "Critique") return <MockCritique />;
  if (eyebrow === "Defend") return <MockDefend />;
  return null;
}

function MockDraftWithCite() {
  return (
    <div className="grid grid-cols-1 gap-3">
      <MockDraft />
      <MockCite />
    </div>
  );
}

function MockShell({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="panel rounded-xl overflow-hidden bg-surface shadow-[0_30px_80px_-30px_rgba(0,0,0,0.45)]">
      <div className="h-7 px-3 flex items-center gap-2 border-b border-border bg-surface-2 text-[10px] font-mono uppercase tracking-[0.15em] text-subtle">
        <span className="size-1.5 rounded-full bg-accent" />
        {label}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function MockRead() {
  return (
    <MockShell label="atlas / import">
      <div className="rounded-lg border-2 border-dashed border-accent bg-accent-soft/30 py-12 flex flex-col items-center justify-center gap-2 text-center">
        <FileText className="size-8 text-accent" />
        <div className="text-foreground font-semibold text-[14px]">
          Drop a PDF anywhere
        </div>
        <div className="text-subtle text-[12px]">
          Text extracted in-browser. Sections detected.
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
        {["Vaswani · Attention", "He · ResNet", "Brown · GPT-3"].map((t) => (
          <div
            key={t}
            className="panel p-2 flex items-center gap-1.5 text-foreground"
          >
            <FileText className="size-3 text-accent shrink-0" />
            <span className="truncate">{t}</span>
          </div>
        ))}
      </div>
    </MockShell>
  );
}

function MockDraft() {
  return (
    <MockShell label="settings / voice">
      <div className="text-[10px] uppercase tracking-[0.15em] text-subtle font-mono mb-2">
        Active profile
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11.5px]">
        <li>
          <span className="text-subtle">Avg sentence</span>{" "}
          <span className="text-foreground font-mono">22.4 words</span>
        </li>
        <li>
          <span className="text-subtle">Hedge rate</span>{" "}
          <span className="text-foreground font-mono">1.8%</span>
        </li>
        <li>
          <span className="text-subtle">Passive ratio</span>{" "}
          <span className="text-foreground font-mono">0.31</span>
        </li>
        <li>
          <span className="text-subtle">Cites / 1k</span>{" "}
          <span className="text-foreground font-mono">9.4</span>
        </li>
      </ul>
      <div className="mt-3 text-[11px]">
        <span className="text-subtle">Hedges: </span>
        <span className="text-foreground">may, suggest, appears, we argue</span>
      </div>
      <div className="mt-4 p-3 rounded border border-warning/40 bg-warning/5 text-[11.5px] text-warning">
        Banned: &ldquo;in conclusion&rdquo;, &ldquo;leverage&rdquo;, &ldquo;delve into&rdquo;.
      </div>
    </MockShell>
  );
}

function MockCite() {
  return (
    <MockShell label="agent / cite mode">
      <div className="space-y-2">
        {[
          {
            source: "crossref",
            confidence: 100,
            title: "Attention Is All You Need",
            authors: "Vaswani et al.",
            year: 2017,
          },
          {
            source: "nia",
            confidence: 92,
            title: "RetroLM: long-context retrieval-aware modeling",
            authors: "Liu et al.",
            year: 2024,
          },
          {
            source: "semanticscholar",
            confidence: 68,
            title: "Survey on long-context language models",
            authors: "Chen et al.",
            year: 2025,
          },
        ].map((c, i) => (
          <div key={i} className="panel p-2.5 space-y-1">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.12em] text-subtle">
              <span className="px-1.5 py-0.5 rounded bg-accent-soft text-accent border border-[#2d3d12]">
                {c.source}
              </span>
              <span
                className={
                  c.confidence >= 70
                    ? "text-accent flex items-center gap-1"
                    : "text-info flex items-center gap-1"
                }
              >
                {c.confidence >= 70 ? (
                  <ShieldCheck className="size-2.5" />
                ) : (
                  <Library className="size-2.5" />
                )}
                {c.confidence}%
              </span>
              <span className="ml-auto">{c.year}</span>
            </div>
            <div className="text-[12px] font-medium text-foreground leading-snug">
              {c.title}
            </div>
            <div className="text-[10.5px] text-muted">{c.authors}</div>
          </div>
        ))}
      </div>
    </MockShell>
  );
}

function MockCritique() {
  return (
    <MockShell label="critic / neurips">
      <div className="space-y-2">
        {[
          { name: "Clarity", score: 0.78 },
          { name: "Soundness", score: 0.42 },
          { name: "Novelty", score: 0.71 },
          { name: "Reproducibility", score: 0.55 },
        ].map((s) => (
          <div key={s.name} className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted">{s.name}</span>
              <span
                className={`font-mono ${
                  s.score >= 0.75
                    ? "text-accent"
                    : s.score >= 0.5
                      ? "text-warning"
                      : "text-danger"
                }`}
              >
                {Math.round(s.score * 100)}
              </span>
            </div>
            <div className="h-1 rounded-full bg-surface-3 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  s.score >= 0.75
                    ? "bg-accent"
                    : s.score >= 0.5
                      ? "bg-warning"
                      : "bg-danger"
                }`}
                style={{ width: `${s.score * 100}%` }}
              />
            </div>
          </div>
        ))}
        <div className="mt-3 p-2 rounded border border-warning/40 bg-warning/5 text-[11px] text-warning">
          <Target className="size-3 inline mr-1" />
          Rubric: report seeds, hardware, and hyper-parameters.
        </div>
      </div>
    </MockShell>
  );
}

function MockDefend() {
  return (
    <MockShell label="response · R1.1">
      <div className="text-[10.5px] uppercase tracking-[0.12em] font-mono text-subtle mb-1">
        <span className="text-foreground font-semibold">#R1.1</span> · Reviewer 1
      </div>
      <blockquote className="text-[12px] text-foreground border-l-2 border-border pl-3 leading-relaxed italic mb-3">
        The motivation in Section 1 is unclear. Please explain why long-context
        reading and retrieval are complementary.
      </blockquote>
      <div className="text-[10px] uppercase tracking-[0.12em] font-mono text-subtle mb-1">
        Drafted
      </div>
      <div className="p-2.5 rounded bg-surface border border-border text-[12px] text-foreground leading-relaxed">
        We added a paragraph at the end of Section 1 (lines 78–92) contrasting
        the two approaches with evidence from Section 4.2.
      </div>
      <div className="mt-2 flex items-center gap-1 text-[10.5px]">
        <span className="text-accent flex items-center gap-1 px-1.5 py-0.5 rounded border border-[#2d3d12] bg-accent-soft">
          <Mic className="size-2.5" />
          matches voice
        </span>
        <span className="ml-auto text-accent flex items-center gap-1">
          <Check className="size-3" /> Addressed
        </span>
      </div>
    </MockShell>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, ease: EASE }}
      className="text-center max-w-[680px] mx-auto"
    >
      <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-accent mb-3">
        {eyebrow}
      </div>
      <h2 className="text-[42px] sm:text-[52px] leading-[1.05] tracking-[-0.02em] font-semibold text-foreground">
        {title}
      </h2>
      {body && (
        <p className="mt-5 text-[16px] text-muted leading-relaxed">{body}</p>
      )}
    </motion.div>
  );
}
