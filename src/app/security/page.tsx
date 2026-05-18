import { LandingNav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { ShieldCheck, Lock, FileKey, Server, Eye, BugPlay } from "lucide-react";

export const metadata = {
  title: "Atlas — Security",
};

const ITEMS = [
  {
    icon: <Lock className="size-5" />,
    title: "Local-first by default",
    body: "Drafts, comments, voice profiles, and API keys live in your browser's storage. The app ships as a static bundle plus stateless API routes — there is no Atlas-side database for your prose unless you opt in to cloud sync.",
  },
  {
    icon: <FileKey className="size-5" />,
    title: "Encrypted at rest (Pro / Lab)",
    body: "Cloud-synced workspaces are AES-256-GCM encrypted on your device with a per-workspace key before they leave the browser. We cannot read them server-side, even with database access.",
  },
  {
    icon: <Eye className="size-5" />,
    title: "Zero training, zero logging of prose",
    body: "We do not train any model on your text. We do not log API request bodies. Provider keys you paste are forwarded as request headers and never written to disk on our side.",
  },
  {
    icon: <Server className="size-5" />,
    title: "Infrastructure",
    body: "Hosting on Vercel + Cloudflare. Region-pinned data residency on Lab. Quarterly third-party penetration test. SOC 2 Type I in progress; Type II expected Q4 2026.",
  },
  {
    icon: <BugPlay className="size-5" />,
    title: "Vulnerability disclosure",
    body: "Found something? Email security@paper-atlas.com with PoC steps. We respond inside 48 hours and credit reporters in our security log unless they ask for anonymity. Cash bounties for verified high-impact reports.",
  },
  {
    icon: <ShieldCheck className="size-5" />,
    title: "Account hygiene",
    body: "Magic-link sign-in only (no passwords to leak). Sessions expire on idle. Workspaces can be wiped from any device. There is no admin override that can decrypt cloud-synced workspaces.",
  },
];

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNav />
      <main className="pt-28 pb-20 px-5">
        <div className="max-w-[1000px] mx-auto">
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-accent mb-3">
            Security
          </div>
          <h1 className="text-[44px] sm:text-[56px] leading-[1.05] tracking-[-0.025em] font-semibold">
            Built so we can&apos;t read your paper.
          </h1>
          <p className="mt-5 max-w-[640px] text-[15px] text-muted leading-relaxed">
            Researchers care about IP. We designed Atlas so the cheapest path
            for us to honour that promise is to make it architecturally
            impossible to violate.
          </p>
          <div className="mt-14 grid sm:grid-cols-2 gap-4">
            {ITEMS.map((it) => (
              <div key={it.title} className="panel p-5">
                <div className="flex items-center gap-2.5 mb-2">
                  <span className="size-9 rounded-md bg-accent-soft border border-[#2d3d12] flex items-center justify-center text-accent">
                    {it.icon}
                  </span>
                  <span className="text-[15px] font-medium text-foreground">
                    {it.title}
                  </span>
                </div>
                <p className="text-[13px] text-muted leading-relaxed">
                  {it.body}
                </p>
              </div>
            ))}
          </div>
          <p className="text-center text-[12px] text-subtle mt-10">
            Security questions →{" "}
            <a
              className="text-accent underline underline-offset-2"
              href="mailto:security@paper-atlas.com"
            >
              security@paper-atlas.com
            </a>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
