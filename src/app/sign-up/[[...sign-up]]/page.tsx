import Link from "next/link";
import { SignUp } from "@clerk/nextjs";
import { LandingNav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { authEnabled, AFTER_SIGN_UP } from "@/lib/auth";
import { KeyRound, ShieldCheck, Sparkles, Library } from "lucide-react";

export const metadata = {
  title: "Atlas — Sign up",
};

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <LandingNav />
      <main className="flex-1 px-5 pt-28 pb-20">
        <div className="max-w-[940px] mx-auto grid lg:grid-cols-[1.1fr_1fr] gap-14 items-center">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-accent mb-3">
              Start free
            </div>
            <h1 className="text-[40px] sm:text-[52px] leading-[1.05] tracking-[-0.025em] font-semibold">
              The workspace, on every device you draft from.
            </h1>
            <p className="mt-5 text-[15px] text-muted leading-relaxed max-w-[460px]">
              Free tier ships the editor, the agent, the analyzer, the
              Provenance Ledger, and the local Lab Graph. Sign up adds sync.
            </p>
            <ul className="mt-8 space-y-3">
              {[
                {
                  icon: <ShieldCheck className="size-4" />,
                  text: "Provenance Ledger + public Verify route",
                },
                {
                  icon: <Sparkles className="size-4" />,
                  text: "AI agent with voice fingerprint + verified citations",
                },
                {
                  icon: <Library className="size-4" />,
                  text: "Lab Graph capsule export / import + Nia citation library",
                },
              ].map((row, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 text-[14px] text-foreground/90"
                >
                  <span className="size-7 rounded-md bg-accent-soft border border-[#2d3d12] flex items-center justify-center text-accent">
                    {row.icon}
                  </span>
                  {row.text}
                </li>
              ))}
            </ul>
          </div>
          <div>
            {authEnabled ? (
              <div className="flex justify-center">
                <SignUp
                  fallbackRedirectUrl={AFTER_SIGN_UP}
                  routing="path"
                  path="/sign-up"
                  signInUrl="/sign-in"
                />
              </div>
            ) : (
              <AuthDisabledNotice />
            )}
          </div>
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
          Atlas runs key-less by default. To turn on accounts and sync, drop a
          Clerk publishable + secret key into{" "}
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
