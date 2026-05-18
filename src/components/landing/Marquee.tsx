"use client";

import { motion } from "framer-motion";
import {
  Sparkles,
  Search,
  FileText,
  Inbox,
  ShieldCheck,
  Library,
  BookOpen,
  Database,
  Type,
  PenLine,
  Globe,
} from "lucide-react";

interface Brand {
  name: string;
  icon: React.ReactNode;
  /** Hue applied on hover. Approximate brand tones — picked for legibility, not exactness. */
  hover: string;
}

const ITEMS: Brand[] = [
  { name: "OpenAI", icon: <Sparkles className="size-4" />, hover: "#10A37F" },
  { name: "Anthropic", icon: <Sparkles className="size-4" />, hover: "#CC785C" },
  { name: "CrossRef", icon: <ShieldCheck className="size-4" />, hover: "#F38020" },
  { name: "OpenAlex", icon: <Database className="size-4" />, hover: "#A41E11" },
  { name: "Semantic Scholar", icon: <BookOpen className="size-4" />, hover: "#1857B6" },
  { name: "arXiv", icon: <FileText className="size-4" />, hover: "#B31B1B" },
  { name: "OpenReview", icon: <Inbox className="size-4" />, hover: "#8B1A1A" },
  { name: "Nia", icon: <Library className="size-4" />, hover: "#7C3AED" },
  { name: "Wikipedia", icon: <Globe className="size-4" />, hover: "#3366CC" },
  { name: "DuckDuckGo", icon: <Search className="size-4" />, hover: "#DE5833" },
  { name: "Tiptap", icon: <PenLine className="size-4" />, hover: "#9333EA" },
  { name: "ProseMirror", icon: <Type className="size-4" />, hover: "#1FAA9F" },
];

export function Marquee() {
  return (
    <section className="border-y border-border bg-background py-14 overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center text-[10px] font-mono uppercase tracking-[0.28em] text-subtle mb-10"
      >
        Pulls from · cites against · interoperates with
      </motion.div>
      <div className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-32 z-10"
          style={{
            background: "linear-gradient(to right, var(--bg), transparent)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-32 z-10"
          style={{
            background: "linear-gradient(to left, var(--bg), transparent)",
          }}
        />
        <motion.div
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 48, repeat: Infinity, ease: "linear" }}
          className="flex items-center gap-14 whitespace-nowrap w-fit"
        >
          {[...ITEMS, ...ITEMS].map((it, i) => (
            <div
              key={i}
              style={{ "--brand": it.hover } as React.CSSProperties}
              className="group flex items-center gap-2.5 text-muted hover:text-[color:var(--brand)] transition-colors duration-200 cursor-default"
            >
              <span className="opacity-50 group-hover:opacity-100 transition-opacity">
                {it.icon}
              </span>
              <span className="text-[20px] font-medium tracking-tight">
                {it.name}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
