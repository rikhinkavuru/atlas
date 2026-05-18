"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState } from "react";
import { ArrowRight, Play } from "lucide-react";
import { InteractiveDemo } from "./InteractiveDemo";
import { TourModal } from "./TourModal";

export function Hero() {
  const [tourOpen, setTourOpen] = useState(false);
  const heroRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const mockY = useTransform(scrollYProgress, [0, 1], [0, -90]);
  const mockScale = useTransform(scrollYProgress, [0, 1], [1, 0.96]);
  const mockOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0.4]);

  return (
    <section ref={heroRef} className="relative pt-32 pb-24 px-5 overflow-hidden">
      <BgGlow />
      <div className="relative max-w-[1200px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
          className="max-w-[860px] mx-auto text-center"
        >
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
            className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] text-muted mb-9"
          >
            <span className="size-1 rounded-full bg-accent animate-pulse-soft" />
            <span>Every AI edit signed · sourced · on the record</span>
          </motion.div>

          <h1 className="text-[56px] sm:text-[80px] leading-[1.02] font-semibold tracking-[-0.03em] text-foreground">
            <motion.span
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
              className="inline-block"
            >
              Cursor for{" "}
            </motion.span>
            <motion.span
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
              className="italic font-serif text-accent inline-block tracking-[-0.005em] pr-2"
            >
              research papers
            </motion.span>
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55 }}
              className="inline-block"
            >
              .
            </motion.span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
            className="mt-7 text-[18px] leading-relaxed text-muted max-w-[560px] mx-auto"
          >
            An AI co-author that drafts, edits, plans, and cites — with a
            signed provenance ledger your reviewers can verify.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
            className="mt-10 flex flex-col items-center gap-3"
          >
            <Link
              href="/app"
              className="btn btn-primary btn-lg group"
            >
              Open the workspace
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <button
              onClick={() => setTourOpen(true)}
              className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-foreground transition-colors group"
            >
              <Play className="size-3.5 text-accent" />
              <span>Watch the 60-second tour</span>
              <span className="text-subtle">·</span>
              <span className="text-subtle">no account needed</span>
            </button>
          </motion.div>
        </motion.div>

        <motion.div
          id="demo"
          style={{
            y: mockY,
            scale: mockScale,
            opacity: mockOpacity,
          }}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
          className="mt-24 max-w-[1100px] mx-auto"
        >
          <div className="relative">
            <div className="absolute -inset-x-12 -inset-y-6 bg-accent/5 blur-3xl rounded-[40px] -z-10" />
            <InteractiveDemo />
          </div>
        </motion.div>
      </div>
      <TourModal open={tourOpen} onClose={() => setTourOpen(false)} />
    </section>
  );
}

function BgGlow() {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.4 }}
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] -z-10 blur-3xl"
        style={{
          background:
            "radial-gradient(ellipse at center, color-mix(in srgb, var(--accent) 18%, transparent), transparent 70%)",
        }}
      />
      <div
        className="absolute top-0 left-0 right-0 h-[800px] -z-20 opacity-25"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, transparent, var(--bg) 60%), repeating-linear-gradient(0deg, var(--border) 0 1px, transparent 1px 80px), repeating-linear-gradient(90deg, var(--border) 0 1px, transparent 1px 80px)",
        }}
      />
    </>
  );
}
