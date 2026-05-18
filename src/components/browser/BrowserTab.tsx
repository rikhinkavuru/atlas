"use client";

import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Globe,
  Search,
  Loader2,
  ExternalLink,
  AlertTriangle,
  BookMarked,
  BookOpen,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAtlas } from "@/lib/store";
import { cn } from "@/lib/cn";
import type { SearchResult, Tab } from "@/types";

export function BrowserTab({ tab }: { tab: Tab }) {
  const updateTab = useAtlas((s) => s.updateTab);
  const pushMessage = useAtlas((s) => s.pushMessage);
  const toggleAgent = useAtlas((s) => s.toggleAgent);
  const [history, setHistory] = useState<string[]>(tab.url ? [tab.url] : []);
  const [historyIdx, setHistoryIdx] = useState<number>(tab.url ? 0 : -1);
  const [address, setAddress] = useState<string>(tab.url ?? tab.query ?? "");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const [frameError, setFrameError] = useState<string | null>(null);
  const [readerMode, setReaderMode] = useState(false);
  const [readerHtml, setReaderHtml] = useState<string | null>(null);
  const [readerBusy, setReaderBusy] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const probeTimer = useRef<number | null>(null);

  const currentUrl = historyIdx >= 0 ? history[historyIdx] : null;
  const isSearchMode = !currentUrl;

  function visit(url: string) {
    const normalised = normaliseUrl(url);
    setFrameError(null);
    setReaderMode(false);
    setReaderHtml(null);
    setHistory((h) => [...h.slice(0, historyIdx + 1), normalised]);
    setHistoryIdx((i) => i + 1);
    setAddress(normalised);
    setSearchResults(null);
    try {
      const parsed = new URL(normalised);
      updateTab(tab.id, {
        kind: "browser",
        title: parsed.hostname.replace(/^www\./, ""),
        url: normalised,
      });
    } catch {}
  }

  async function openReaderMode(url: string) {
    setReaderBusy(true);
    setReaderHtml(null);
    setReaderMode(true);
    try {
      const r = await fetch(`/api/reader?url=${encodeURIComponent(url)}`);
      const data = await r.json();
      setReaderHtml(data.html ?? "<p>No readable content found.</p>");
      if (data.title) {
        updateTab(tab.id, { title: data.title });
      }
    } catch (e) {
      setReaderHtml(
        `<p>Could not reach the source: ${e instanceof Error ? e.message : String(e)}</p>`,
      );
    } finally {
      setReaderBusy(false);
    }
  }

  // After 4s of an iframe failing to fire `load`, assume it's blocked and surface reader mode.
  useEffect(() => {
    if (!currentUrl || readerMode) return;
    if (probeTimer.current) window.clearTimeout(probeTimer.current);
    probeTimer.current = window.setTimeout(() => {
      // Best-effort: if we can't read iframe document (cross-origin), it's at least loaded.
      // If frame is still about:blank-ish, suggest reader mode.
      try {
        const inner = iframeRef.current?.contentDocument;
        if (!inner) return; // cross-origin success
        if (!inner.body || inner.body.children.length === 0) {
          setFrameError(
            "This site blocks embedding. Switch to reader mode for a readable preview.",
          );
        }
      } catch {
        // cross-origin throw means it loaded
      }
    }, 4000);
    return () => {
      if (probeTimer.current) window.clearTimeout(probeTimer.current);
    };
  }, [currentUrl, readerMode]);

  async function runSearch(query: string) {
    if (!query.trim()) return;
    setSearchBusy(true);
    setSearchResults(null);
    updateTab(tab.id, { kind: "search", title: query.slice(0, 40), query });
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSearchResults(data.results ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchBusy(false);
    }
  }

  function go() {
    const v = address.trim();
    if (!v) return;
    if (looksLikeUrl(v)) {
      visit(v);
    } else {
      runSearch(v);
    }
  }

  function back() {
    if (historyIdx > 0) {
      const idx = historyIdx - 1;
      setHistoryIdx(idx);
      setAddress(history[idx]);
    }
  }
  function forward() {
    if (historyIdx < history.length - 1) {
      const idx = historyIdx + 1;
      setHistoryIdx(idx);
      setAddress(history[idx]);
    }
  }
  function reload() {
    if (!iframeRef.current) return;
    iframeRef.current.src = iframeRef.current.src;
  }

  function cite() {
    if (!currentUrl) return;
    const title = tab.title || "Source";
    pushMessage({
      id: `m_${Date.now()}`,
      role: "user",
      content: `Capture this as a citation: ${title} (${currentUrl})`,
      timestamp: Date.now(),
    });
    pushMessage({
      id: `m_${Date.now() + 1}`,
      role: "assistant",
      content: `Saved reference. I'll cite it as [${title}].`,
      timestamp: Date.now() + 1,
      citations: [{ title, url: currentUrl }],
    });
    if (!useAtlas.getState().agentOpen) toggleAgent();
  }

  // Run the initial search once when a search tab mounts. The parent passes
  // `key={tab.id}` so a new tab gets a fresh component instance — that's why
  // we intentionally use an empty dep array instead of chasing `tab.query` /
  // `searchResults`, which would loop.
  useEffect(() => {
    if (tab.kind === "search" && tab.query && !searchResults && !searchBusy) {
      runSearch(tab.query);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="h-10 flex items-center gap-1.5 px-2 border-b border-border bg-surface">
        <button
          onClick={back}
          disabled={historyIdx <= 0}
          className="size-7 rounded hover:bg-surface-2 disabled:opacity-30 flex items-center justify-center text-muted"
        >
          <ArrowLeft className="size-3.5" />
        </button>
        <button
          onClick={forward}
          disabled={historyIdx >= history.length - 1}
          className="size-7 rounded hover:bg-surface-2 disabled:opacity-30 flex items-center justify-center text-muted"
        >
          <ArrowRight className="size-3.5" />
        </button>
        <button
          onClick={reload}
          disabled={!currentUrl}
          className="size-7 rounded hover:bg-surface-2 disabled:opacity-30 flex items-center justify-center text-muted"
        >
          <RotateCw className="size-3.5" />
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            go();
          }}
          className="flex-1 mx-1"
        >
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle">
              {looksLikeUrl(address) ? (
                <Globe className="size-3.5" />
              ) : (
                <Search className="size-3.5" />
              )}
            </span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Search the web or paste a URL"
              className="w-full h-7 pl-8 pr-2 rounded-md bg-background border border-border text-xs focus:outline-none focus:border-border-strong"
            />
          </div>
        </form>
        <button
          onClick={() => currentUrl && openReaderMode(currentUrl)}
          disabled={!currentUrl}
          className={cn(
            "btn h-7 text-[11px]",
            readerMode && "btn-primary",
          )}
          title="Render as readable text"
        >
          <BookOpen className="size-3.5" />
          Reader
        </button>
        <button
          onClick={cite}
          disabled={!currentUrl}
          className="btn h-7 text-[11px]"
          title="Add this source to the bibliography"
        >
          <BookMarked className="size-3.5" />
          Cite this page
        </button>
      </div>

      <div className="flex-1 min-h-0 relative">
        {isSearchMode ? (
          <SearchResultsView
            query={tab.query ?? address}
            busy={searchBusy}
            results={searchResults}
            onVisit={visit}
          />
        ) : (
          <>
            {readerMode ? (
              <ReaderView
                url={currentUrl!}
                html={readerHtml}
                busy={readerBusy}
                onExit={() => {
                  setReaderMode(false);
                  setReaderHtml(null);
                }}
              />
            ) : (
              <>
                <iframe
                  ref={iframeRef}
                  src={currentUrl ?? "about:blank"}
                  className="w-full h-full bg-white"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                  referrerPolicy="no-referrer"
                  onLoad={() => setFrameError(null)}
                  onError={() =>
                    setFrameError(
                      "This site blocks embedding. Switch to reader mode for a readable preview.",
                    )
                  }
                />
                <FrameOverlay
                  url={currentUrl!}
                  onCite={cite}
                  onReader={() => openReaderMode(currentUrl!)}
                  error={frameError}
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FrameOverlay({
  url,
  error,
  onCite,
  onReader,
}: {
  url: string;
  error: string | null;
  onCite: () => void;
  onReader: () => void;
}) {
  if (!error) return null;
  return (
    <div className="absolute inset-0 bg-background/95 flex items-center justify-center p-8">
      <div className="max-w-md panel p-5">
        <div className="flex items-center gap-2 text-warning mb-2">
          <AlertTriangle className="size-4" />
          <span className="font-medium text-sm">Site refused to embed</span>
        </div>
        <p className="text-sm text-muted mb-4">
          Many publishers block being shown inside another page. Try reader
          mode for a sanitised text-only view, or open it in a new tab.
        </p>
        <div className="flex gap-2 flex-wrap">
          <button onClick={onReader} className="btn btn-primary h-8 text-xs">
            <BookOpen className="size-3.5" />
            Reader mode
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn h-8 text-xs"
          >
            <ExternalLink className="size-3.5" />
            Open externally
          </a>
          <button onClick={onCite} className="btn h-8 text-xs">
            <BookMarked className="size-3.5" />
            Cite anyway
          </button>
        </div>
      </div>
    </div>
  );
}

function ReaderView({
  url,
  html,
  busy,
  onExit,
}: {
  url: string;
  html: string | null;
  busy: boolean;
  onExit: () => void;
}) {
  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-[760px] mx-auto px-8 py-10">
        <div className="flex items-center gap-2 mb-6 text-[11px] font-mono uppercase tracking-[0.15em] text-subtle">
          <BookOpen className="size-3 text-accent" />
          Reader mode
          <span className="ml-auto truncate max-w-[420px]">{url}</span>
          <button
            onClick={onExit}
            className="text-muted hover:text-foreground"
          >
            ← back to embed
          </button>
        </div>
        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" />
            Fetching and sanitising…
          </div>
        )}
        {!busy && html && (
          <article
            className="prose-reader"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </div>
  );
}

function SearchResultsView({
  query,
  busy,
  results,
  onVisit,
}: {
  query: string;
  busy: boolean;
  results: SearchResult[] | null;
  onVisit: (url: string) => void;
}) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-10">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">
          {query ? `Searching · ${query}` : "Search the web"}
        </h1>
        <p className="text-sm text-subtle mb-6">
          Results are surfaced from arXiv, Semantic Scholar, Wikipedia, and DuckDuckGo so you can validate every claim in your draft.
        </p>
        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" />
            Looking up sources…
          </div>
        )}
        {!busy && results && results.length === 0 && (
          <p className="text-sm text-subtle">
            No results yet. Try a different query, or paste a URL into the
            address bar above.
          </p>
        )}
        {!busy && results && results.length > 0 && (
          <ul className="space-y-3">
            {results.map((r, i) => (
              <li
                key={i}
                className="panel p-4 hover:border-border-strong transition-colors"
              >
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] font-mono text-subtle mb-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-accent-soft text-accent">
                    {r.source}
                  </span>
                  <span className="truncate">{prettyUrl(r.url)}</span>
                </div>
                <button
                  onClick={() => onVisit(r.url)}
                  className="text-left text-[15px] font-medium text-foreground hover:text-accent transition-colors leading-snug"
                >
                  {r.title}
                </button>
                <p className="text-[13px] text-muted leading-relaxed mt-1">
                  {r.snippet}
                </p>
                <div className="mt-2 flex gap-1.5">
                  <button
                    onClick={() => onVisit(r.url)}
                    className="btn btn-ghost h-6 text-[11px]"
                  >
                    Open in tab
                  </button>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost h-6 text-[11px]"
                  >
                    <ExternalLink className="size-3" /> External
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function normaliseUrl(input: string) {
  const v = input.trim();
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  if (v.startsWith("//")) return "https:" + v;
  return "https://" + v;
}

function looksLikeUrl(v: string) {
  const t = v.trim();
  if (t.startsWith("http")) return true;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(t)) return true;
  return false;
}

function prettyUrl(u: string) {
  try {
    const p = new URL(u);
    return p.hostname.replace(/^www\./, "") + p.pathname;
  } catch {
    return u;
  }
}
