import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { LandingNav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { authEnabled, AFTER_SIGN_IN } from "@/lib/auth";
import { KeyRound } from "lucide-react";

export const metadata = {
  title: "Atlas — Sign in",
};

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <LandingNav />
      <main className="flex-1 px-5 pt-28 pb-20 flex items-center justify-center">
        <div className="w-full max-w-[440px]">
          <div className="text-center mb-8">
            <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-accent mb-3">
              Atlas account
            </div>
            <h1 className="text-[36px] sm:text-[44px] leading-[1.05] tracking-[-0.025em] font-semibold">
              Welcome back.
            </h1>
            <p className="mt-4 text-[14px] text-muted leading-relaxed">
              Sign in to sync your workspace, voice profile, and provenance
              ledgers across devices.
            </p>
          </div>
          {authEnabled ? (
            <div className="flex justify-center">
              <SignIn
                fallbackRedirectUrl={AFTER_SIGN_IN}
                routing="path"
                path="/sign-in"
                signUpUrl="/sign-up"
              />
            </div>
          ) : (
            <AuthDisabledNotice />
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function AuthDisabledNotice() {
  return (
    <div className="panel rounded-xl p-6 space-y-4">
      <div className="size-10 rounded-md bg-accent-soft border border-[#2d3d12] flex items-center justify-center text-accent">
        <KeyRound className="size-5" />
      </div>
      <div>
        <h2 className="text-[18px] font-semibold tracking-tight">
          Auth keys not configured
        </h2>
        <p className="mt-2 text-[13px] text-muted leading-relaxed">
          Atlas runs key-less by default — the workspace, provenance ledger,
          and lab graph all live in your browser. To turn on accounts and
          cross-device sync, drop a Clerk publishable + secret key into{" "}
          <code className="font-mono text-foreground">.env.local</code> and
          restart the dev server.
        </p>
      </div>
      <pre className="text-[11px] font-mono bg-background border border-border rounded-md p-3 overflow-x-auto text-foreground/85 leading-relaxed">
{`# .env.local
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_…
CLERK_SECRET_KEY=sk_test_…`}
      </pre>
      <Link
        href="/app"
        className="btn btn-primary h-9 text-[12.5px] w-full justify-center"
      >
        Continue to the local workspace
      </Link>
    </div>
  );
}
