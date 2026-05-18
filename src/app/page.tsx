import { LandingNav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { Moats } from "@/components/landing/Moats";
import { Comparison } from "@/components/landing/Comparison";
import { Pricing } from "@/components/landing/Pricing";
import { FAQ } from "@/components/landing/FAQ";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";
import { ScrollProgress } from "@/components/landing/ScrollProgress";
import { Marquee } from "@/components/landing/Marquee";

export const metadata = {
  title: "Atlas — Cursor for research papers",
  description:
    "One keyboard-first workspace to read PDFs, draft with a sourced AI agent that won't fabricate, run venue-specific reviewer critiques, and respond to Reviewer 2.",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden overflow-y-auto">
      <ScrollProgress />
      <LandingNav />
      <main>
        <Hero />
        <Marquee />
        <Features />
        <Moats />
        <Comparison />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
