import { LandingNav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { VerifyClient } from "./VerifyClient";

export const metadata = {
  title: "Atlas — Verify a paper's provenance",
  description:
    "Drop an Atlas provenance ledger to see the AI-disclosure breakdown for any paper. Hash-chained, signature-checked, and shareable with any reviewer or venue.",
};

export default function VerifyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNav />
      <main className="pt-28 pb-20 px-5">
        <div className="max-w-[1000px] mx-auto">
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-accent mb-3">
            Atlas Verify
          </div>
          <h1 className="text-[44px] sm:text-[56px] leading-[1.05] tracking-[-0.025em] font-semibold">
            Check any Atlas-drafted paper&apos;s provenance.
          </h1>
          <p className="mt-5 max-w-[640px] text-[15px] text-muted leading-relaxed">
            Reviewers and venues can drop the{" "}
            <span className="font-mono text-foreground">
              .atlas-ledger.jsonld
            </span>{" "}
            file that ships with an Atlas paper. We re-walk the hash chain,
            validate every event, and print a one-page AI-disclosure report —
            no Atlas account required, no data leaves your browser unless you
            ask for the integrity-check API.
          </p>
          <VerifyClient />
        </div>
      </main>
      <Footer />
    </div>
  );
}
