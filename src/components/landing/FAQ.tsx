"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SectionHeader } from "./Features";

const Q = [
  {
    q: "Does Atlas ever auto-apply edits?",
    a: "Never. Every AI proposal is a diff card with Accept and Reject. Nothing mutates the document without your click.",
  },
  {
    q: "How do you prevent fabricated citations?",
    a: "Every reference is checked against CrossRef, OpenAlex, Semantic Scholar, and your Nia library before the agent can insert it. Claims it can't source land in a “Needs citation” bucket, not in your paper.",
  },
  {
    q: "What about my data and the key I paste in?",
    a: "Drafts stay in your browser. Keys live in localStorage and are forwarded only when you make a call. We don't proxy prose, store your library, or log messages. Pro / Lab sync is opt-in and encrypted with per-workspace keys.",
  },
  {
    q: "Does the voice profile actually work?",
    a: "Atlas extracts sentence length, hedge rate, passive ratio, vocabulary, and frequent phrasing from your samples, then injects them as hard constraints with a banned-phrase list. The bigger the sample, the tighter the match.",
  },
  {
    q: "Will Atlas submit to arXiv or OpenReview for me?",
    a: "Not yet. You can export LaTeX with NeurIPS / ACL / IEEEtran templates today, plus a BibTeX file. Direct submission ships with Pro / Lab.",
  },
  {
    q: "Can my advisor mark up my draft with me?",
    a: "Realtime co-authoring ships with the Lab tier. Today you can export your workspace as a single .atlaslab.json file and pass it to a colleague.",
  },
  {
    q: "What models can I use?",
    a: "OpenAI (GPT-4o, 4o mini, 4.1) and Anthropic (Claude Haiku 4.5, Sonnet 4.6, Opus 4.7). Mock mode is free of tokens. Switch per session in Settings.",
  },
  {
    q: "Does this work for non-ML fields?",
    a: "Yes. Ships with rubrics for NeurIPS / ICLR / ACL, Nature / Cell, JAMA, and a generic thesis preset. Every rubric is editable per project.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.2, 0.7, 0.2, 1] as [number, number, number, number] },
  },
};

export function FAQ() {
  return (
    <section id="faq" className="py-32 px-5 border-t border-border bg-surface/30">
      <div className="max-w-[800px] mx-auto">
        <SectionHeader
          eyebrow="FAQ"
          title="The questions every PhD asks first."
        />
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
          }}
          className="mt-16 divide-y divide-border border-y border-border"
        >
          {Q.map((item, i) => (
            <Item key={i} q={item.q} a={item.a} />
          ))}
        </motion.div>
        <p className="mt-8 text-center text-[12.5px] text-subtle">
          Have a question we didn&apos;t answer?{" "}
          <a
            className="text-accent underline underline-offset-2"
            href="mailto:hello@paper-atlas.com"
          >
            hello@paper-atlas.com
          </a>
        </p>
      </div>
    </section>
  );
}

function Item({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div variants={fadeUp}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full py-5 flex items-center gap-4 text-left group"
      >
        <span className="text-[15.5px] font-medium text-foreground flex-1 group-hover:text-accent transition-colors">
          {q}
        </span>
        <span
          className={`size-7 rounded-md border border-border bg-surface flex items-center justify-center shrink-0 transition-all ${
            open ? "border-accent text-accent rotate-180" : "text-muted"
          }`}
        >
          {open ? <Minus className="size-3.5" /> : <Plus className="size-3.5" />}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.2, 0.7, 0.2, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-[14px] text-muted leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
