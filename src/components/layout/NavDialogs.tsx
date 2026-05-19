"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, FileText, BookPlus, ChevronDown } from "lucide-react";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { useAtlas, activePaper } from "@/lib/store";
import type { CitationCandidate } from "@/types";
import { listVenueTemplates, htmlToLaTeX } from "@/lib/latex";
import type { LatexExportProvenance } from "@/lib/latex";
import { cn } from "@/lib/cn";

// Replaces three legacy `window.prompt` calls in NavMenu with in-app dialogs:
//   atlas:open-find             → inline find bar (top of editor)
//   atlas:open-insert-citation  → key+URL modal that inserts at cursor
//   atlas:open-export-latex     → template+authors modal then downloads .tex
//
// Each surface listens for its event so the menu items can stay declarative
// and the dialogs stay close to one another in this file.

type Dialog = "find" | "citation" | "latex" | null;

export function NavDialogs() {
  const [dialog, setDialog] = useState<Dialog>(null);

  useEffect(() => {
    const onFind = () => setDialog("find");
    const onCite = () => setDialog("citation");
    const onLatex = () => setDialog("latex");
    window.addEventListener("atlas:open-find", onFind);
    window.addEventListener("atlas:open-insert-citation", onCite);
    window.addEventListener("atlas:open-export-latex", onLatex);
    return () => {
      window.removeEventListener("atlas:open-find", onFind);
      window.removeEventListener("atlas:open-insert-citation", onCite);
      window.removeEventListener("atlas:open-export-latex", onLatex);
    };
  }, []);

  // ⌘F intercept while no input is focused — gives the menu's "Find in paper"
  // shortcut a working browser-style keyboard path.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!(mod && e.key.toLowerCase() === "f")) return;
      const tag = (e.target as HTMLElement | null)?.tagName ?? "";
      const inField =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (inField) return;
      e.preventDefault();
      setDialog("find");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <AnimatePresence>
      {dialog === "find" && (
        <FindBar key="find" onClose={() => setDialog(null)} />
      )}
      {dialog === "citation" && (
        <CitationDialog key="cite" onClose={() => setDialog(null)} />
      )}
      {dialog === "latex" && (
        <LatexExportDialog key="latex" onClose={() => setDialog(null)} />
      )}
    </AnimatePresence>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Find bar — slides down from the top, persists across re-renders, highlights
// every match instead of jumping to one and bailing out like prompt() did.

function FindBar({ onClose }: { onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Matches are derived from query — recomputing the DOM walk every keystroke
  // is fine for paper-length docs and keeps state minimal.
  const matches = useMemo<HTMLElement[]>(() => {
    if (typeof document === "undefined") return [];
    if (!query.trim()) return [];
    const dom = document.querySelector(".tiptap") as HTMLElement | null;
    if (!dom) return [];
    const walker = document.createTreeWalker(dom, NodeFilter.SHOW_TEXT);
    const found: HTMLElement[] = [];
    const seen = new Set<HTMLElement>();
    let n: Node | null;
    while ((n = walker.nextNode())) {
      if (
        n.textContent?.toLowerCase().includes(query.toLowerCase()) &&
        n.parentElement &&
        !seen.has(n.parentElement)
      ) {
        seen.add(n.parentElement);
        found.push(n.parentElement);
      }
    }
    return found;
  }, [query]);

  // Whenever the query (and therefore matches) changes, reset cursor + jump
  // to the first hit. We key state off `query` not `matches` so the lint rule
  // for derived state is satisfied — matches is already derived from query.
  useEffect(() => {
    clearHighlights();
    if (matches[0]) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIndex(0);
      jumpTo(matches[0]);
    }
    // matches is a stable function of query — depend on query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    return () => clearHighlights();
  }, []);

  function step(delta: number) {
    if (matches.length === 0) return;
    const next = (index + delta + matches.length) % matches.length;
    setIndex(next);
    jumpTo(matches[next]);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Enter") {
      e.preventDefault();
      step(e.shiftKey ? -1 : 1);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15 }}
      className="fixed top-14 right-4 z-40 panel rounded-lg shadow-xl px-2 py-1.5 flex items-center gap-1.5 w-[min(90vw,380px)]"
      role="search"
    >
      <Search className="size-3.5 text-subtle" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKey}
        placeholder="Find in paper…"
        className="flex-1 bg-transparent text-[12px] focus:outline-none placeholder:text-subtle"
      />
      <span className="text-[10.5px] font-mono text-subtle tabular-nums shrink-0">
        {matches.length === 0
          ? query.trim()
            ? "no match"
            : "—"
          : `${index + 1} / ${matches.length}`}
      </span>
      <button
        onClick={() => step(-1)}
        disabled={matches.length === 0}
        className="btn btn-icon h-6 w-6 text-muted disabled:opacity-40"
        title="Previous (Shift+Enter)"
        aria-label="Previous match"
      >
        <ChevronDown className="size-3.5 rotate-180" />
      </button>
      <button
        onClick={() => step(1)}
        disabled={matches.length === 0}
        className="btn btn-icon h-6 w-6 text-muted disabled:opacity-40"
        title="Next (Enter)"
        aria-label="Next match"
      >
        <ChevronDown className="size-3.5" />
      </button>
      <button
        onClick={onClose}
        className="btn btn-icon h-6 w-6 text-muted"
        aria-label="Close find"
      >
        <X className="size-3.5" />
      </button>
    </motion.div>
  );
}

function jumpTo(el: HTMLElement) {
  clearHighlights();
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.dataset.atlasFindActive = "1";
  el.style.transition = "box-shadow 0.4s ease";
  el.style.boxShadow = "0 0 0 2px var(--accent)";
}

function clearHighlights() {
  document.querySelectorAll<HTMLElement>("[data-atlas-find-active]").forEach((el) => {
    el.style.boxShadow = "";
    delete el.dataset.atlasFindActive;
  });
}

// ───────────────────────────────────────────────────────────────────────────
// Citation dialog — inserts a citation mark at the cursor.

function CitationDialog({ onClose }: { onClose: () => void }) {
  const ref = useFocusTrap<HTMLFormElement>(true);
  const [key, setKey] = useState("");
  const [url, setUrl] = useState("");
  const [verifyStatus, setVerifyStatus] = useState<
    "idle" | "checking" | "ok" | "unresolved" | "error"
  >("idle");
  const [verifyMessage, setVerifyMessage] = useState<string>("");
  const [verifyCandidate, setVerifyCandidate] = useState<
    import("@/types").CitationCandidate | null
  >(null);

  // Verify the DOI/URL against /api/verify-citation before allowing the
  // user to insert. We don't block insertion of unresolved citations —
  // researchers sometimes need to insert in-progress refs — but we warn
  // clearly so the user has to opt in.
  async function verify() {
    const q = url.trim() || key.trim();
    if (!q) {
      setVerifyStatus("idle");
      return;
    }
    setVerifyStatus("checking");
    setVerifyMessage("");
    try {
      const r = await fetch("/api/verify-citation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      if (!r.ok) {
        setVerifyStatus("error");
        setVerifyMessage(`verifier returned ${r.status}`);
        return;
      }
      const data = (await r.json()) as {
        resolved: boolean;
        best?: import("@/types").CitationCandidate | null;
        warning?: string;
      };
      if (data.resolved && data.best) {
        setVerifyStatus("ok");
        setVerifyMessage(
          `${data.best.title?.slice(0, 80) ?? "Matched"} · via ${data.best.source}`,
        );
        setVerifyCandidate(data.best);
      } else {
        setVerifyStatus("unresolved");
        setVerifyMessage(
          data.warning ?? "No high-confidence match in any registry.",
        );
        setVerifyCandidate(null);
      }
    } catch (e) {
      setVerifyStatus("error");
      setVerifyMessage(e instanceof Error ? e.message : String(e));
      setVerifyCandidate(null);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = key.trim() || "ref";
    type EditorLike = {
      chain: () => {
        focus: () => {
          insertContent: (html: string) => { run: () => void };
        };
      };
    };
    const editor = (window as unknown as { __atlasEditor?: EditorLike })
      .__atlasEditor;
    editor
      ?.chain()
      .focus()
      .insertContent(
        `<span class="citation" data-key="${escapeHtml(trimmed)}" data-url="${escapeHtml(url.trim())}" data-verified="${verifyStatus === "ok" ? "1" : "0"}">[${escapeHtml(trimmed)}]</span> `,
      )
      .run();
    // Citation registry write — see SlashMenu.submitCitation for the
    // matching write path. References generation reads from this registry.
    const state = useAtlas.getState();
    const tab = state.tabs.find((t) => t.id === state.activeTabId);
    const paperId = tab?.paperId;
    if (paperId) {
      const cand: import("@/types").CitationCandidate = verifyCandidate ?? {
        title: trimmed,
        authors: [],
        year: null,
        doi: null,
        url: url.trim(),
        source: "manual",
        confidence: 0,
      };
      state.registerCitation(paperId, trimmed, cand);
    }
    onClose();
  }

  return (
    <ModalShell onClose={onClose} title="Insert citation" icon={<BookPlus className="size-4 text-accent" />}>
      <form ref={ref} onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.15em] font-mono text-subtle">
            Citation key
          </span>
          <input
            autoFocus
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Smith2024"
            className="input mt-1 w-full"
          />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.15em] font-mono text-subtle">
            URL or DOI{" "}
            <span className="text-subtle/70 normal-case tracking-normal">
              (optional — runs through registry check)
            </span>
          </span>
          <div className="flex items-center gap-1.5 mt-1">
            <input
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setVerifyStatus("idle");
                // Clear stale candidate so editing the URL after a verify
                // doesn't accidentally register the old verified metadata.
                setVerifyCandidate(null);
              }}
              onBlur={verify}
              placeholder="https://doi.org/…"
              className="input flex-1"
            />
            <button
              type="button"
              onClick={verify}
              disabled={verifyStatus === "checking"}
              className="btn btn-ghost h-9 text-[11.5px] text-muted disabled:opacity-50"
              title="Check this against CrossRef / OpenAlex / Semantic Scholar / Nia"
            >
              Verify
            </button>
          </div>
        </label>
        {verifyStatus !== "idle" && (
          <div
            className={cn(
              "text-[11px] rounded px-2 py-1.5 border flex items-start gap-1.5",
              verifyStatus === "ok" &&
                "border-accent/30 bg-accent-soft/40 text-accent",
              verifyStatus === "unresolved" &&
                "border-warning/40 bg-warning/5 text-warning",
              verifyStatus === "error" &&
                "border-warning/40 bg-warning/5 text-warning",
              verifyStatus === "checking" &&
                "border-border bg-surface-2/40 text-subtle",
            )}
          >
            <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] pt-0.5">
              {verifyStatus === "ok"
                ? "verified"
                : verifyStatus === "unresolved"
                  ? "no match"
                  : verifyStatus === "error"
                    ? "error"
                    : "checking…"}
            </span>
            <span className="flex-1 leading-snug">
              {verifyMessage || "—"}
            </span>
          </div>
        )}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost h-8 text-[12px] text-muted"
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary h-8 text-[12px]">
            {verifyStatus === "unresolved" ? "Insert anyway" : "Insert"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// LaTeX export dialog — template + authors + ledger badge embed.

function LatexExportDialog({ onClose }: { onClose: () => void }) {
  const ref = useFocusTrap<HTMLFormElement>(true);
  const templates = listVenueTemplates();
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "generic");
  const [authors, setAuthors] = useState("Author One, Author Two");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const paper = activePaper();
    if (!paper) {
      onClose();
      return;
    }
    const ledger = useAtlas.getState().getLedger(paper.id);
    let prov: LatexExportProvenance | undefined;
    if (ledger && ledger.events.length > 0) {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      let author = 0,
        ai = 0,
        sourced = 0,
        imported = 0;
      for (const ev of ledger.events) {
        const w = (ev.before?.length ?? 0) + (ev.after?.length ?? 0);
        if (ev.kind === "author") author += Math.max(20, w);
        else if (ev.kind === "import") imported += w;
        else if (ev.kind === "ai-cite" || (ev.sources && ev.sources.length))
          sourced += w;
        else ai += w;
      }
      const total = Math.max(1, author + ai + sourced + imported);
      const pct = (n: number) => Math.round((n / total) * 100);
      const params = new URLSearchParams({
        paper: paper.title.slice(0, 40),
        author: String(pct(author)),
        sourced: String(pct(sourced)),
        ai: String(pct(ai)),
        imported: String(pct(imported)),
        hash: ledger.rootHash.slice(0, 8),
      });
      prov = {
        badgeUrl: `${origin}/api/badge?${params.toString()}`,
        verifyUrl: `${origin}/verify`,
        rootHash: ledger.rootHash.slice(0, 16),
      };
    }
    const { tex, bib } = htmlToLaTeX(
      paper.html,
      paper.title,
      authors.trim() || "Anonymous Authors",
      templateId,
      prov,
    );
    download(
      new Blob([tex], { type: "application/x-tex" }),
      `${slugify(paper.title)}.tex`,
    );
    if (bib.trim()) {
      download(
        new Blob([bib], { type: "application/x-bibtex" }),
        `references.bib`,
      );
    }
    onClose();
  }

  return (
    <ModalShell
      onClose={onClose}
      title="Export as LaTeX"
      icon={<FileText className="size-4 text-accent" />}
    >
      <form ref={ref} onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.15em] font-mono text-subtle">
            Template
          </span>
          <div className="grid grid-cols-2 gap-2 mt-1.5">
            {templates.map((t) => (
              <button
                type="button"
                key={t.id}
                onClick={() => setTemplateId(t.id)}
                className={cn(
                  "p-2.5 rounded-md border text-left text-[12.5px] transition-colors",
                  templateId === t.id
                    ? "border-accent bg-accent-soft text-foreground"
                    : "border-border bg-surface hover:bg-surface-2 text-muted",
                )}
              >
                {t.name}
              </button>
            ))}
          </div>
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.15em] font-mono text-subtle">
            Authors
          </span>
          <input
            autoFocus
            value={authors}
            onChange={(e) => setAuthors(e.target.value)}
            placeholder="Author One, Author Two"
            className="input mt-1 w-full"
          />
        </label>
        <p className="text-[11px] text-subtle leading-relaxed">
          If your paper has a provenance ledger, a verifiable badge URL is
          embedded as a header comment in the .tex file.
        </p>
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost h-8 text-[12px] text-muted"
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary h-8 text-[12px]">
            Download .tex
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ───────────────────────────────────────────────────────────────────────────

function ModalShell({
  onClose,
  title,
  icon,
  children,
}: {
  onClose: () => void;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 6, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 6, scale: 0.99 }}
        transition={{ duration: 0.18, ease: [0.2, 0.7, 0.2, 1] }}
        role="dialog"
        aria-modal
        onClick={(e) => e.stopPropagation()}
        className="panel relative w-full max-w-[440px] rounded-xl p-5 shadow-2xl"
      >
        <div className="flex items-center gap-2 mb-3">
          {icon}
          <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto size-6 rounded flex items-center justify-center text-subtle hover:text-foreground hover:bg-surface-2"
            aria-label="Close"
          >
            <X className="size-3.5" />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
