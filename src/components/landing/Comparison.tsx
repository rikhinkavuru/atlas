"use client";

import { motion } from "framer-motion";
import { Check, Minus, X } from "lucide-react";
import { SectionHeader } from "./Features";

type Cell = "yes" | "partial" | "no";

interface Row {
  feature: string;
  detail?: string;
  atlas: Cell;
  jenni: Cell;
  paperpal: Cell;
  overleaf: Cell;
  scispace: Cell;
}

// Six rows, not ten — the differentiators that actually matter to a
// researcher in their first session. Anything not on this list is in /docs.
const ROWS: Row[] = [
  {
    feature: "Verified citations before insertion",
    detail:
      "DOI resolved against CrossRef / OpenAlex / Semantic Scholar in the same turn",
    atlas: "yes",
    jenni: "no",
    paperpal: "no",
    overleaf: "no",
    scispace: "no",
  },
  {
    feature: "Per-step accept / reject diff",
    detail: "Never silently rewrites your paragraphs",
    atlas: "yes",
    jenni: "no",
    paperpal: "partial",
    overleaf: "yes",
    scispace: "no",
  },
  {
    feature: "Voice-matched rewrites",
    detail: "Style fingerprint extracted from your prior papers",
    atlas: "yes",
    jenni: "partial",
    paperpal: "no",
    overleaf: "no",
    scispace: "no",
  },
  {
    feature: "Rubric-graded peer review per venue",
    detail: "NeurIPS, ACL, Nature, JAMA, Cell rubrics shipped",
    atlas: "yes",
    jenni: "no",
    paperpal: "partial",
    overleaf: "no",
    scispace: "no",
  },
  {
    feature: "Response-to-Reviewers studio",
    detail: "Paste reviewer dump → structured response letter",
    atlas: "yes",
    jenni: "no",
    paperpal: "no",
    overleaf: "no",
    scispace: "no",
  },
  {
    feature: "Bring your own keys · local-first",
    detail: "OpenAI / Anthropic keys stay in your browser — no forced cloud",
    atlas: "yes",
    jenni: "no",
    paperpal: "no",
    overleaf: "no",
    scispace: "no",
  },
];

export function Comparison() {
  return (
    <section
      id="how"
      className="py-32 px-5 border-t border-border bg-surface/30"
    >
      <div className="max-w-[1200px] mx-auto">
        <SectionHeader
          eyebrow="How it's different"
          title="The features the rest keeps promising"
          body="Benchmarked against the loudest complaints about Jenni, Paperpal, Overleaf, and SciSpace. The gaps are concrete; we closed them."
        />
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={{
            hidden: {},
            visible: {
              transition: { staggerChildren: 0.04, delayChildren: 0.1 },
            },
          }}
          className="mt-16 overflow-x-auto"
        >
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <motion.tr
                variants={fadeUp}
                className="border-b border-border-strong"
              >
                <th className="text-left px-3 py-3 text-subtle font-mono text-[10px] uppercase tracking-[0.15em] font-medium">
                  Capability
                </th>
                <Th name="Atlas" highlight />
                <Th name="Jenni" />
                <Th name="Paperpal" />
                <Th name="Overleaf" />
                <Th name="SciSpace" />
              </motion.tr>
            </thead>
            <tbody>
              {ROWS.map((row, i) => (
                <motion.tr
                  key={i}
                  variants={fadeUp}
                  className="border-b border-border hover:bg-surface-2/40 transition-colors"
                >
                  <td className="px-3 py-3.5">
                    <div className="text-foreground font-medium">
                      {row.feature}
                    </div>
                    {row.detail && (
                      <div className="text-subtle text-[11.5px] mt-0.5">
                        {row.detail}
                      </div>
                    )}
                  </td>
                  <CellMark value={row.atlas} highlight />
                  <CellMark value={row.jenni} />
                  <CellMark value={row.paperpal} />
                  <CellMark value={row.overleaf} />
                  <CellMark value={row.scispace} />
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-6 text-[11px] text-subtle text-center max-w-[640px] mx-auto"
        >
          Six head-to-heads, not a fifty-row marketing trap. Full feature matrix
          lives in{" "}
          <a
            href="/docs"
            className="text-muted hover:text-foreground underline underline-offset-2"
          >
            /docs
          </a>
          . Based on each product&apos;s public feature pages and recurring
          patterns in user reviews. Open a PR if we got something wrong.
        </motion.p>
      </div>
    </section>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.2, 0.7, 0.2, 1] as [number, number, number, number] },
  },
};

function Th({ name, highlight }: { name: string; highlight?: boolean }) {
  return (
    <th
      className={`text-center px-3 py-3 text-[12px] ${
        highlight ? "text-accent font-semibold" : "text-subtle font-medium"
      }`}
    >
      {name}
    </th>
  );
}

function CellMark({
  value,
  highlight,
}: {
  value: Cell;
  highlight?: boolean;
}) {
  return (
    <td className="text-center px-3 py-3.5">
      <span
        className={`inline-flex size-7 rounded-md items-center justify-center border transition-all ${
          value === "yes"
            ? highlight
              ? "border-accent bg-accent-soft text-accent"
              : "border-border bg-surface text-muted"
            : value === "partial"
              ? "border-border bg-surface text-warning"
              : "border-border bg-background text-subtle"
        }`}
      >
        {value === "yes" ? (
          <Check className="size-4" />
        ) : value === "partial" ? (
          <Minus className="size-4" />
        ) : (
          <X className="size-4" />
        )}
      </span>
    </td>
  );
}
