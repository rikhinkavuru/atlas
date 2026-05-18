import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { LandingNav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { getStore } from "@/lib/ledger-store";
import { summariseLedger } from "@/lib/provenance";
import { PublicLedgerView } from "./PublicLedgerView";
import type { Metadata } from "next";

export const runtime = "nodejs";
// Don't pre-render — each shareKey is dynamic and the store lives server-side.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ shareKey: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { shareKey } = await params;
  const rec = await getStore().get(shareKey);
  if (!rec) {
    return {
      title: "Atlas — published ledger not found",
    };
  }
  return {
    title: `${rec.paperTitle} · Provenance ledger · Atlas`,
    description: `Hash-chained provenance ledger for "${rec.paperTitle}" — every AI edit is signed and reviewer-verifiable.`,
  };
}

export default async function PublishedLedgerPage({ params }: PageProps) {
  const { shareKey } = await params;
  const rec = await getStore().get(shareKey);
  if (!rec) notFound();

  // Re-walk the chain server-side so the page itself is a verification:
  // a reviewer reading this page already knows the chain is consistent
  // (or sees the warning banner if the signature is invalid / broken).
  const summary = await summariseLedger(rec.ledger);

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "atlas.app";
  const canonical = `${proto}://${host}/p/${shareKey}`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNav />
      <main className="pt-28 pb-20 px-5">
        <div className="max-w-[1000px] mx-auto">
          <div className="flex items-center gap-3 mb-3 text-[11px] font-mono uppercase tracking-[0.18em]">
            <span className="text-accent flex items-center gap-1.5">
              <ShieldCheck className="size-3" />
              Atlas Public Ledger
            </span>
            <span className="h-px w-6 bg-border" />
            <span className="text-subtle truncate max-w-[280px]">
              shareKey {shareKey}
            </span>
          </div>
          <h1 className="text-[36px] sm:text-[48px] leading-[1.05] tracking-[-0.025em] font-semibold">
            {rec.paperTitle}
          </h1>
          <p className="mt-4 max-w-[680px] text-[14.5px] text-muted leading-relaxed">
            This page is the canonical, reviewer-verifiable record of every AI
            edit applied to this paper. The provenance chain was re-walked
            server-side on load — every event hash was validated against its
            predecessor, and the signature was checked against the author&apos;s
            embedded public key. Anyone with this URL sees the same record.
          </p>

          <PublicLedgerView
            record={rec}
            summary={summary}
            canonical={canonical}
          />

          <div className="mt-12 border-t border-border pt-6 flex items-center gap-3 flex-wrap text-[12.5px] text-muted">
            <span>Verify this ledger independently:</span>
            <Link
              href="/verify"
              className="btn btn-ghost h-8 text-[12px] text-accent"
            >
              Open /verify
              <ArrowRight className="size-3.5" />
            </Link>
            <span className="text-subtle text-[11.5px]">
              · drop the JSON payload to re-run the same checks locally
            </span>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
