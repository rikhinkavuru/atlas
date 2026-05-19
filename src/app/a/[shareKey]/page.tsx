import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ShieldCheck } from "lucide-react";
import { LandingNav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { getAttestationStore } from "@/lib/authorship-store";
import { verifyAuthorshipAttestation } from "@/lib/authorship";
import { PublicAttestationView } from "./PublicAttestationView";
import type { Metadata } from "next";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ shareKey: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { shareKey } = await params;
  const rec = await getAttestationStore().get(shareKey);
  if (!rec) {
    return { title: "Atlas — published attestation not found" };
  }
  return {
    title: `${rec.attestation.paperTitle} · Authorship attestation · Atlas`,
    description: `Signed AI-disclosure attestation for "${rec.attestation.paperTitle}" — by ${rec.attestation.author.name}.`,
  };
}

export default async function PublishedAttestationPage({ params }: PageProps) {
  const { shareKey } = await params;
  const rec = await getAttestationStore().get(shareKey);
  if (!rec) notFound();

  // Verify server-side so the page itself is the verification — the reader
  // sees the result without trusting client-side JS.
  const signature = await verifyAuthorshipAttestation(rec.attestation);

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "atlas.app";
  const canonical = `${proto}://${host}/a/${shareKey}`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNav />
      <main className="pt-28 pb-20 px-5">
        <div className="max-w-[1000px] mx-auto">
          <div className="flex items-center gap-3 mb-3 text-[11px] font-mono uppercase tracking-[0.18em]">
            <span className="text-accent flex items-center gap-1.5">
              <ShieldCheck className="size-3" />
              Atlas Authorship Attestation
            </span>
            <span className="h-px w-6 bg-border" />
            <span className="text-subtle truncate max-w-[280px]">
              shareKey {shareKey}
            </span>
          </div>
          <h1 className="text-[36px] sm:text-[48px] leading-[1.05] tracking-[-0.025em] font-semibold">
            {rec.attestation.paperTitle}
          </h1>
          <p className="mt-4 max-w-[680px] text-[14.5px] text-muted leading-relaxed">
            This page is the canonical record of {rec.attestation.author.name}
            &apos;s AI-use disclosure for the above manuscript. The attestation
            payload was re-hashed and the workspace signature re-checked
            server-side on load. Anyone with this URL sees the same numbers,
            the same disclosure text, and the same signature verification
            result.
          </p>

          <PublicAttestationView
            record={rec}
            signature={signature}
            canonical={canonical}
          />
        </div>
      </main>
      <Footer />
    </div>
  );
}
