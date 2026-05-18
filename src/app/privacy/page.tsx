import { LandingNav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";

export const metadata = {
  title: "Atlas — Privacy",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNav />
      <main className="pt-28 pb-20 px-5">
        <div className="max-w-[760px] mx-auto">
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-accent mb-3">
            Privacy
          </div>
          <h1 className="text-[44px] sm:text-[56px] leading-[1.05] tracking-[-0.025em] font-semibold">
            Your drafts belong to you.
          </h1>
          <p className="mt-5 text-[15px] text-muted leading-relaxed">
            Last updated 2026-05-17. This page describes what data Atlas
            processes and what it never touches. We wrote it in plain
            language. The legal version lives at the bottom.
          </p>

          <Block title="What stays in your browser">
            Every draft, every comment, every voice profile, and every API key
            you paste lives in <code className="font-mono">localStorage</code>{" "}
            on your device. The workspace is a static page plus stateless API
            routes — there is no Atlas-side database that holds your prose by
            default.
          </Block>

          <Block title="What we forward, and where">
            When you call the agent or the critic, Atlas forwards your prompt,
            your selection, and the truncated draft text to the model provider
            you chose (OpenAI or Anthropic), authenticated with the key you
            pasted. We do not store the request or the response on our
            servers. When you use the citation library, indexing and search
            calls go directly to Nia&apos;s API with your Nia key.
          </Block>

          <Block title="Optional cloud sync (Pro / Lab)">
            If you turn on cloud sync on a paid tier, your workspace bundle
            (papers, settings, voice, library config) is encrypted on your
            device with a workspace key and uploaded to our storage. We
            cannot read it server-side. Delete the workspace from Settings →
            Workspace and the encrypted blob is removed inside 24 hours.
          </Block>

          <Block title="What we never do">
            We don&apos;t train any model on your text. We don&apos;t sell or
            share your data with any third party. We don&apos;t run analytics
            that read your prose. We don&apos;t shadow-store your API keys.
          </Block>

          <Block title="Cookies and analytics">
            The marketing pages set one analytics cookie (privacy-friendly,
            no cross-site tracking). The app sets none. You can browse{" "}
            <code className="font-mono">/app</code> with cookies disabled.
          </Block>

          <Block title="Children and special data">
            Atlas is not directed at children under 13. We strongly recommend
            against pasting PHI / identifiable patient data into any LLM —
            ours or anyone else&apos;s — until you have your IRB&apos;s clear
            sign-off.
          </Block>

          <Block title="Contact" id="terms">
            Questions about this policy or requests to delete your data go
            to <a className="text-accent underline" href="mailto:privacy@paper-atlas.com">privacy@paper-atlas.com</a>. We
            respond inside 5 business days.
          </Block>

          <Block title="Terms in two sentences">
            Don&apos;t use Atlas to do anything illegal or harmful. We
            don&apos;t promise the AI is right; verify its work before
            submitting.
          </Block>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Block({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="mt-12 pt-6 border-t border-border text-[14.5px] text-muted leading-relaxed"
    >
      <h2 className="text-[20px] font-semibold tracking-tight text-foreground mb-2.5">
        {title}
      </h2>
      <p>{children}</p>
    </section>
  );
}
