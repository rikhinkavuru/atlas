"use client";

import { motion } from "framer-motion";
import {
  FileText,
  Inbox,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Wand2,
  Check,
  Search,
  Globe,
  Library,
} from "lucide-react";

export function MockApp() {
  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-[0_30px_80px_-30px_rgba(0,0,0,0.5)]">
      {/* Browser-style chrome */}
      <div className="h-9 flex items-center gap-2 px-4 border-b border-border bg-surface-2">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-[#ef4444]/50" />
          <span className="size-2.5 rounded-full bg-[#f59e0b]/50" />
          <span className="size-2.5 rounded-full bg-[#84cc16]/50" />
        </div>
        <div className="ml-4 px-3 h-5 rounded bg-background text-[10px] font-mono text-subtle flex items-center gap-1.5">
          <span className="size-1 rounded-full bg-accent" />
          atlas.app · workspace
        </div>
        <div className="ml-auto text-[10px] font-mono text-subtle">
          ⌘K
        </div>
      </div>

      {/* Tabs */}
      <div className="h-9 flex items-stretch border-b border-border bg-background pl-2 gap-0.5">
        <div className="h-full flex items-center gap-2 px-3 text-[11.5px] text-foreground bg-surface relative">
          <FileText className="size-3.5 text-accent" />
          <span>AtlasRAG — draft</span>
          <span className="absolute left-0 right-0 top-0 h-px bg-accent" />
        </div>
        <div className="h-full flex items-center gap-2 px-3 text-[11.5px] text-muted">
          <Inbox className="size-3.5" />
          R&amp;R · NeurIPS 2026
        </div>
        <div className="h-full flex items-center gap-2 px-3 text-[11.5px] text-muted">
          <Globe className="size-3.5" />
          arxiv.org/abs/2310.06825
        </div>
      </div>

      <div className="grid grid-cols-[180px_1fr_300px] h-[460px]">
        {/* Sidebar */}
        <div className="border-r border-border bg-surface text-[11px]">
          <div className="h-7 px-2 flex items-center gap-0.5 border-b border-border">
            <div className="flex-1 h-5 rounded bg-surface-2 text-center leading-5 text-foreground">
              Outline
            </div>
            <div className="flex-1 h-5 leading-5 text-center text-muted">
              Notes
            </div>
          </div>
          <ul className="p-2 space-y-0.5">
            {[
              { l: 1, t: "AtlasRAG" },
              { l: 2, t: "Abstract" },
              { l: 2, t: "1. Introduction" },
              { l: 2, t: "2. Related Work" },
              { l: 2, t: "3. Method" },
              { l: 3, t: "3.1 Hierarchical Chunking" },
              { l: 3, t: "3.2 Re-Ranking" },
              { l: 2, t: "4. Experiments" },
              { l: 2, t: "5. Limitations" },
            ].map((h, i) => (
              <li
                key={i}
                className={
                  h.l === 1
                    ? "px-2 py-1 rounded text-foreground font-medium"
                    : h.l === 3
                      ? "px-2 py-1 rounded pl-5 text-subtle"
                      : "px-2 py-1 rounded pl-3 text-muted"
                }
              >
                {h.t}
              </li>
            ))}
          </ul>
        </div>

        {/* Editor center */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 px-12 py-7 overflow-hidden font-serif text-[14px] text-foreground/90 leading-relaxed">
            <h2 className="text-[22px] font-sans font-semibold tracking-tight mb-2">
              3.3 Long-Context Reader
            </h2>
            <p className="mb-3">
              We pass the top-k passages plus their adjacent context windows
              into a 1M-token reader. The reader is prompted to emit answers as
              a JSON list of <span className="font-mono text-[12px]">(claim, citation)</span> pairs,
              where each citation must resolve to a sentence in the retrieved
              evidence.
            </p>
            <p>
              We{" "}
              <span className="bg-accent/30 text-foreground rounded px-0.5 relative">
                reject answers whose citations cannot be string-matched back
                into the context
                <motion.span
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="absolute left-1/2 -translate-x-1/2 -bottom-9 flex items-center gap-1 px-2 h-7 rounded-md panel shadow-2xl text-[10px] font-mono text-muted whitespace-nowrap"
                >
                  <Sparkles className="size-3 text-accent" />
                  Ask Atlas · ⌘L
                </motion.span>
              </span>
              , which is a cheap but surprisingly effective hallucination
              check.
            </p>
          </div>
        </div>

        {/* Agent panel */}
        <div className="border-l border-border bg-surface flex flex-col">
          <div className="h-8 px-2.5 flex items-center gap-1.5 border-b border-border">
            <Sparkles className="size-3 text-accent" />
            <span className="text-[11px] font-semibold">Atlas Agent</span>
            <span className="ml-auto text-[9px] font-mono text-subtle uppercase tracking-[0.15em]">
              thinking…
            </span>
          </div>
          <div className="flex-1 overflow-hidden p-2.5 space-y-2 text-[11px]">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex justify-end"
            >
              <div className="max-w-[88%] bg-surface-2 border border-border rounded-lg rounded-tr-sm px-2.5 py-1.5 text-foreground">
                Tighten this — make it sound less like marketing
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="space-y-1.5"
            >
              <div className="rounded-md border border-accent overflow-hidden">
                <div className="flex items-center justify-between px-2 py-1 border-b border-border bg-surface-2 text-[9px] font-mono uppercase tracking-[0.15em] text-subtle">
                  <span className="flex items-center gap-1">
                    <Wand2 className="size-2.5" />
                    Proposed edit
                  </span>
                  <span className="flex items-center gap-1 text-accent">
                    <Check className="size-2.5" />
                    Ready
                  </span>
                </div>
                <div className="p-2 space-y-1">
                  <div className="text-[9px] font-mono uppercase tracking-[0.12em] text-subtle">
                    After
                  </div>
                  <div className="px-1.5 py-1 rounded bg-accent-soft border border-[#2d3d12] text-[11px] text-foreground leading-snug">
                    We reject any answer whose citations cannot be matched to a
                    retrieved sentence — a cheap, effective hallucination
                    filter.
                  </div>
                  <div className="text-[9px] font-mono uppercase tracking-[0.12em] text-subtle pt-0.5">
                    Supported by · 2
                  </div>
                  <div className="border-l-2 border-accent/40 pl-1.5 text-[9.5px] text-muted italic">
                    <ShieldCheck className="size-2 inline text-accent mr-1" />
                    &ldquo;reject answers whose citations cannot be
                    string-matched back into the context&rdquo;
                  </div>
                  <div className="border-l-2 border-accent/40 pl-1.5 text-[9.5px] text-muted italic">
                    <ShieldCheck className="size-2 inline text-accent mr-1" />
                    Vaswani 2017 · attention scaling
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                <div className="h-6 px-2 rounded text-[10px] border border-border text-muted flex items-center">
                  Reject
                </div>
                <div className="h-6 px-2 rounded text-[10px] bg-accent text-accent-fg flex items-center gap-1">
                  <Check className="size-2.5" />
                  Accept
                </div>
              </div>
            </motion.div>
          </div>
          <div className="border-t border-border p-2 text-[10px] text-subtle flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Library className="size-2.5" />
              7 indexed sources
            </span>
            <span className="font-mono">openai · gpt-4o · neurips</span>
          </div>
        </div>
      </div>

      {/* Statusbar */}
      <div className="h-6 border-t border-border bg-surface px-3 flex items-center text-[10px] text-subtle font-mono gap-4">
        <span>AtlasRAG.tex</span>
        <span>4,128 words</span>
        <span className="text-accent">saved 2s ago</span>
        <span className="ml-auto">⌘. focus</span>
        <span>NeurIPS</span>
      </div>
    </div>
  );
}
