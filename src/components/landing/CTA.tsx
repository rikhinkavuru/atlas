"use client";

import Link from "next/link";
import { ArrowRight, Command } from "lucide-react";

export function CTA() {
  return (
    <section className="py-32 px-5 border-t border-border relative overflow-hidden">
      <div
        className="absolute inset-0 -z-10 opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(ellipse at center, color-mix(in srgb, var(--accent) 20%, transparent), transparent 60%)",
        }}
      />
      <div className="max-w-[900px] mx-auto text-center">
        <h2 className="text-[56px] sm:text-[72px] leading-[1.02] tracking-[-0.03em] font-semibold text-foreground">
          Start your next paper{" "}
          <span className="italic font-serif text-accent">
            in Atlas
          </span>
          .
        </h2>
        <p className="mt-6 text-[18px] text-muted max-w-[520px] mx-auto leading-relaxed">
          Free forever. No card. Open the workspace and start drafting.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <Link
            href="/app"
            className="btn btn-primary h-12 text-[14px] px-6"
          >
            Open the workspace
            <ArrowRight className="size-4" />
          </Link>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[12px] text-subtle font-mono">
            <Command className="size-3.5" />K once you&apos;re in
          </span>
        </div>
      </div>
    </section>
  );
}
