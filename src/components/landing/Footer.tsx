"use client";

import Link from "next/link";
import { Mail } from "lucide-react";
import { Logo } from "../common/Logo";
import { GithubIcon, XIcon } from "../common/SocialIcons";
import { ATLAS_VERSION } from "@/lib/version";

const COLS = [
  {
    title: "Product",
    links: [
      { label: "Workspace", href: "/app" },
      { label: "Pricing", href: "/pricing" },
      { label: "Docs", href: "/docs" },
      { label: "Changelog", href: "/changelog" },
      { label: "Roadmap", href: "/roadmap" },
    ],
  },
  {
    title: "Moats",
    links: [
      { label: "Authorship Ledger", href: "/authorship" },
      { label: "Verify a paper", href: "/verify" },
      { label: "Reviewer-2 + rubrics", href: "/reviewer-model" },
      { label: "Provenance schema", href: "/docs#provenance" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Manifesto", href: "/#moats" },
      { label: "Privacy", href: "/privacy" },
      { label: "Security", href: "/security" },
      { label: "Terms", href: "/privacy#terms" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "FAQ", href: "/#faq" },
      { label: "Keyboard shortcuts", href: "/docs#shortcuts" },
      { label: "Voice profile guide", href: "/docs#voice" },
      { label: "Rubric library", href: "/docs#rubrics" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border px-5 pt-16 pb-10">
      <div className="max-w-[1200px] mx-auto">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-[300px] text-[13px] text-muted leading-relaxed">
              The research workspace built like Cursor. Read, draft, review,
              respond — without fabricated citations or generic AI voice.
            </p>
            <div className="mt-5 flex items-center gap-2 text-muted">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="size-8 rounded-md border border-border bg-surface flex items-center justify-center hover:text-foreground"
              >
                <GithubIcon className="size-4" />
              </a>
              <a
                href="https://x.com"
                target="_blank"
                rel="noopener noreferrer"
                className="size-8 rounded-md border border-border bg-surface flex items-center justify-center hover:text-foreground"
              >
                <XIcon className="size-4" />
              </a>
              <a
                href="mailto:hello@paper-atlas.com"
                className="size-8 rounded-md border border-border bg-surface flex items-center justify-center hover:text-foreground"
              >
                <Mail className="size-4" />
              </a>
            </div>
          </div>
          {COLS.map((c) => (
            <div key={c.title}>
              <div className="text-[10px] uppercase tracking-[0.18em] font-mono text-subtle mb-3">
                {c.title}
              </div>
              <ul className="space-y-2">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-[13px] text-muted hover:text-foreground transition-colors"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 pt-6 border-t border-border flex flex-wrap items-center gap-3 text-[11px] text-subtle">
          <span>© 2026 Atlas Research, Inc.</span>
          <span className="ml-auto font-mono">
            Built keyboard-first · {ATLAS_VERSION}
          </span>
        </div>
      </div>
    </footer>
  );
}
