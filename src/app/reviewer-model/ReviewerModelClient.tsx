"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ShieldCheck,
  Sparkles,
  Loader2,
  RefreshCw,
  ExternalLink,
  Star,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ComparisonHarness } from "@/components/reviewer-model/ComparisonHarness";
import { CalibrationCard } from "@/components/reviewer-model/CalibrationCard";
import { OPENREVIEW_VENUES } from "@/lib/openreview-venues";

const KEY = "atlas:reviewer-model-optin";

export function ReviewerModelClient() {
  const [optedIn, setOptedIn] = useState<boolean | null>(null);
  const [decidedAt, setDecidedAt] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw === "yes") setOptedIn(true);
      else if (raw === "no") setOptedIn(false);
      const ts = window.localStorage.getItem(`${KEY}:at`);
      if (ts) setDecidedAt(parseInt(ts, 10));
    } catch {}
  }, []);

  function persist(next: boolean) {
    setOptedIn(next);
    const now = Date.now();
    setDecidedAt(now);
    try {
      window.localStorage.setItem(KEY, next ? "yes" : "no");
      window.localStorage.setItem(`${KEY}:at`, String(now));
    } catch {}
  }

  return (
    <>
      <section className="mt-16 pt-8 border-t border-border">
        <h2 className="text-[26px] font-semibold tracking-tight text-foreground mb-5">
          Contribute to the next training run
        </h2>
        <p className="text-[14.5px] text-muted leading-relaxed mb-3">
          When you opt in, Atlas attaches an anonymised tuple to each paper
          you finalise: <code className="font-mono text-foreground">(draft, accepted-suggestions, rejected-suggestions, venue, decision-if-known)</code>. No
          author names, no affiliations, no identifying metadata. You can
          revoke per-paper or globally at any time, and the next training run
          drops your data. Until the first training run, nothing leaves your
          browser.
        </p>
        <p className="text-[13.5px] text-muted leading-relaxed mb-5">
          The buttons below set your <span className="text-foreground">global default</span> for new papers. To
          override per-paper, open the workspace and pick{" "}
          <span className="font-mono text-foreground">File → Corpus opt-in…</span>{" "}
          (or run <span className="kbd">⌘K</span>{" "}
          <span className="text-foreground">Reviewer-Model corpus opt-in</span>)
          — the per-paper choice always wins.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <button
            onClick={() => persist(true)}
            className={cn(
              "panel p-5 text-left rounded-xl transition-colors",
              optedIn === true
                ? "border-accent bg-accent-soft/40"
                : "hover:border-border-strong",
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="size-7 rounded-md bg-accent-soft border border-[#2d3d12] flex items-center justify-center text-accent">
                <ShieldCheck className="size-3.5" />
              </span>
              <span className="text-[14px] font-semibold text-foreground">
                Opt in
              </span>
              {optedIn === true && (
                <Check className="size-4 text-accent ml-auto" />
              )}
            </div>
            <p className="text-[12.5px] text-muted leading-relaxed">
              Atlas will anonymise and contribute your finalised papers to the
              first training corpus when collection opens. The model gets
              sharper for everyone — including you on your next paper.
            </p>
          </button>
          <button
            onClick={() => persist(false)}
            className={cn(
              "panel p-5 text-left rounded-xl transition-colors",
              optedIn === false
                ? "border-foreground/40 bg-surface-2/60"
                : "hover:border-border-strong",
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="size-7 rounded-md bg-surface-2 border border-border flex items-center justify-center text-muted">
                <Sparkles className="size-3.5" />
              </span>
              <span className="text-[14px] font-semibold text-foreground">
                Stay out
              </span>
              {optedIn === false && (
                <Check className="size-4 text-foreground ml-auto" />
              )}
            </div>
            <p className="text-[12.5px] text-muted leading-relaxed">
              Atlas works fine without your signal. Opt-in is genuinely
              optional and we don&apos;t penalise you for staying out.
            </p>
          </button>
        </div>
        <div className="mt-4 flex items-center gap-3 text-[11.5px] text-subtle">
          {optedIn === null && <span>Decide later. Your default is stay-out.</span>}
          {optedIn === true && (
            <span>
              Saved {decidedAt ? new Date(decidedAt).toLocaleString() : ""}.
              Revoke any time — your record is wiped from this browser and
              from the next training run.
            </span>
          )}
          {optedIn === false && (
            <span>
              Saved {decidedAt ? new Date(decidedAt).toLocaleString() : ""}.
              Atlas will not include your data when collection opens.
            </span>
          )}
        </div>
      </section>

      <CorpusSample />

      <CalibrationCard />

      <ComparisonHarness />

      <section className="mt-16 pt-8 border-t border-border">
        <h2 className="text-[26px] font-semibold tracking-tight text-foreground mb-5">
          Why this becomes the moat
        </h2>
        <ul className="space-y-3 text-[14px] text-muted leading-relaxed">
          {[
            "General-purpose LLM vendors ship a single model for everyone; they do not — and structurally cannot — collect per-paper accept/reject signal paired with reviewer comments at the per-user level.",
            "The OpenReview, ACL Anthology, and arXiv corpora are public, but stitching them into clean (paper, review, decision) tuples at scale takes months of pipeline work that no wrapper team has done.",
            "Once Atlas users opt-in, every finalised paper adds a (draft, suggestions, outcome) tuple that no other vendor sees. That is the flywheel a wrapper can't replicate by reading our marketing.",
            "Until the model ships, the workspace already gives you the heuristic forecast and the verifiable ledger — both are useful on their own, both stay useful after the model swap.",
          ].map((line, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="size-1.5 rounded-full bg-accent mt-2 shrink-0" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex items-center gap-3">
          <Link
            href="/app"
            className="btn btn-primary h-10 text-[13px] px-5"
          >
            Open the workspace
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/docs#changelog"
            className="btn h-10 text-[13px] px-5 text-muted"
          >
            Read the changelog
          </Link>
        </div>
      </section>
    </>
  );
}

interface Sample {
  forumId: string;
  title: string;
  authors: string[];
  abstractSnippet: string;
  venue: string;
  decision?: string;
  reviewCount: number;
  averageRating?: number;
  ratingScale?: string;
  forumUrl: string;
}

function CorpusSample() {
  const [samples, setSamples] = useState<Sample[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [venue, setVenue] = useState<string>(OPENREVIEW_VENUES[0]);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);

  async function fetchSamples() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(
        `/api/openreview/sample?venue=${encodeURIComponent(venue)}&limit=4`,
      );
      const data = (await r.json()) as {
        ok: boolean;
        samples?: Sample[];
        error?: string;
        message?: string;
        fetchedAt?: number;
      };
      if (!data.ok) {
        setError(
          data.error === "openreview_status"
            ? `OpenReview returned an error. The public API can rate-limit — try again in a moment.`
            : data.message ?? "Could not reach OpenReview.",
        );
        setSamples([]);
      } else {
        setSamples(data.samples ?? []);
        setFetchedAt(data.fetchedAt ?? Date.now());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSamples([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-16 pt-8 border-t border-border">
      <div className="flex items-baseline gap-3 mb-3">
        <h2 className="text-[26px] font-semibold tracking-tight text-foreground">
          See the corpus, live
        </h2>
        <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-accent">
          via public API
        </span>
      </div>
      <p className="text-[14.5px] text-muted leading-relaxed mb-5">
        Atlas calls the OpenReview public API live in your browser and shows
        the structural shape of a (paper, reviews) tuple — the kind of row
        the Reviewer Model trains on. We display only public metadata; full
        reviewer text stays on OpenReview where it belongs.
      </p>
      <div className="flex items-center gap-2 mb-4">
        <select
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          disabled={busy}
          className="input max-w-[160px]"
        >
          {OPENREVIEW_VENUES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <button
          onClick={fetchSamples}
          disabled={busy}
          className="btn btn-primary h-9 text-[12.5px]"
        >
          {busy ? (
            <>
              <Loader2 className="size-3.5 animate-spin" /> Fetching
            </>
          ) : samples ? (
            <>
              <RefreshCw className="size-3.5" /> Refresh sample
            </>
          ) : (
            <>
              <Sparkles className="size-3.5" /> Fetch live sample
            </>
          )}
        </button>
        {fetchedAt && (
          <span className="text-[11px] font-mono text-subtle">
            fetched {new Date(fetchedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      {error && (
        <div className="text-[11.5px] text-warning bg-warning/5 border border-warning/40 rounded p-2 mb-4">
          {error}
        </div>
      )}

      {samples && samples.length === 0 && !busy && !error && (
        <div className="text-[12px] text-subtle border border-dashed border-border rounded p-3">
          No samples returned. OpenReview can rate-limit anonymous probes; try
          again, or pick a different venue.
        </div>
      )}

      {samples && samples.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-3">
          {samples.map((s) => (
            <article
              key={s.forumId}
              className="panel p-4 rounded-lg flex flex-col"
            >
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.15em] text-subtle mb-1.5">
                <span className="text-foreground">{s.venue}</span>
                <span>·</span>
                <span>{s.reviewCount} reviews</span>
                {typeof s.averageRating === "number" && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1 text-accent">
                      <Star className="size-2.5" />
                      {s.averageRating.toFixed(1)}
                      {s.ratingScale ? ` / ${s.ratingScale}` : ""}
                    </span>
                  </>
                )}
                {s.decision && (
                  <span className="ml-auto px-1.5 py-0.5 rounded-full border border-border bg-surface-2 text-foreground text-[9.5px]">
                    {s.decision}
                  </span>
                )}
              </div>
              <h3 className="text-[14px] font-semibold tracking-tight text-foreground mb-1.5 leading-snug">
                {s.title}
              </h3>
              {s.authors.length > 0 && (
                <div className="text-[11.5px] text-muted mb-2">
                  {s.authors.slice(0, 4).join(", ")}
                  {s.authors.length > 4 ? " et al." : ""}
                </div>
              )}
              {s.abstractSnippet && (
                <p className="text-[12.5px] text-muted leading-relaxed flex-1">
                  {s.abstractSnippet}
                </p>
              )}
              <a
                href={s.forumUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] text-accent hover:underline underline-offset-2"
              >
                <ExternalLink className="size-3" />
                Open the full reviews on OpenReview
              </a>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
