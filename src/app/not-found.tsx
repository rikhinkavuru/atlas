import Link from "next/link";
import { LandingNav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { BackButton } from "./not-found-client";
import { Home, Search } from "lucide-react";

export const metadata = {
  title: "Atlas — Not found",
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <LandingNav />
      <main className="flex-1 px-5 pt-28 pb-20 flex items-center justify-center">
        <div className="max-w-[640px] w-full text-center">
          <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-accent mb-4">
            404 · paper not found
          </div>
          <h1 className="text-[60px] sm:text-[80px] leading-[1.02] tracking-[-0.025em] font-semibold">
            Citation needed.
          </h1>
          <p className="mt-6 text-[15px] text-muted leading-relaxed max-w-[480px] mx-auto">
            This page isn&apos;t in the corpus. Either it was moved, removed,
            or — like a lot of AI-emitted claims — never existed in the first
            place. Head back somewhere real:
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            <Link href="/" className="btn btn-primary h-10 text-[13px] px-5">
              <Home className="size-4" />
              Landing
            </Link>
            <Link href="/app" className="btn h-10 text-[13px] px-5 text-muted">
              Open workspace
            </Link>
            <Link
              href="/docs"
              className="btn btn-ghost h-10 text-[13px] px-5 text-muted"
            >
              <Search className="size-4" />
              Docs
            </Link>
          </div>
          <BackButton />
        </div>
      </main>
      <Footer />
    </div>
  );
}
