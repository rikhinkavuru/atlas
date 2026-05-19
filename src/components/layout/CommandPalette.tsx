"use client";

import { useEffect, useRef, useState } from "react";
import {
  Search,
  FileText,
  Globe,
  Sparkles,
  Wand2,
  Plus,
  Library,
  ShieldCheck,
  Sigma,
  BookOpenCheck,
  Beaker,
  Package,
  History,
  ArrowRight,
} from "lucide-react";
import { useAtlas } from "@/lib/store";
import { cn } from "@/lib/cn";
import { useFocusTrap } from "@/lib/use-focus-trap";

type ActionGroup =
  | "Recent"
  | "Workspace"
  | "Web"
  | "Agent"
  | "Tools"
  | "Provenance"
  | "Editor";

type Action = {
  id: string;
  title: string;
  desc?: string;
  icon: React.ReactNode;
  run: () => void;
  group: ActionGroup;
  hotkey?: string;
};

const RECENT_KEY = "atlas:cmd-recent";
const MAX_RECENT = 5;

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecent(id: string) {
  if (typeof window === "undefined") return;
  const cur = loadRecent().filter((x) => x !== id);
  const next = [id, ...cur].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

export function CommandPalette() {
  const open = useAtlas((s) => s.commandOpen);
  const toggle = useAtlas((s) => s.toggleCommand);
  const tabs = useAtlas((s) => s.tabs);
  const papers = useAtlas((s) => s.papers);
  const setActiveTab = useAtlas((s) => s.setActiveTab);
  const openTab = useAtlas((s) => s.openTab);
  const toggleAgent = useAtlas((s) => s.toggleAgent);
  const toggleAnalyzer = useAtlas((s) => s.toggleAnalyzer);
  const newPaper = useAtlas((s) => s.newPaper);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const focusRef = useFocusTrap<HTMLDivElement>(open);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setQuery("");
    setActive(0);
    if (open) setRecent(loadRecent());
  }, [open]);

  // Scroll the active row into view as the user arrow-keys through the list.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLButtonElement>(
      `[data-cmd-index="${active}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  if (!open) return null;

  const actions: Action[] = [
    ...Object.values(papers).map<Action>((p) => ({
      id: `paper_${p.id}`,
      title: p.title,
      desc: "Open paper",
      icon: <FileText className="size-4" />,
      group: "Workspace",
      run: () => {
        const tab = tabs.find((t) => t.paperId === p.id);
        if (tab) setActiveTab(tab.id);
        else
          openTab({
            id: `t_${p.id}`,
            kind: "editor",
            title: p.title,
            paperId: p.id,
          });
        toggle(false);
      },
    })),
    {
      id: "new-paper",
      title: "New paper",
      desc: "Create a blank draft",
      icon: <Plus className="size-4" />,
      group: "Workspace",
      run: () => {
        newPaper();
        toggle(false);
      },
    },
    ...tabs
      .filter((t) => t.kind === "browser" || t.kind === "search")
      .map<Action>((t) => ({
        id: `tab_${t.id}`,
        title: t.title,
        desc: t.url ?? t.query ?? "Browser tab",
        icon: <Globe className="size-4" />,
        group: "Web",
        run: () => {
          setActiveTab(t.id);
          toggle(false);
        },
      })),
    {
      id: "new-search",
      title: "Search the web",
      desc: "Open a new browser tab and search",
      icon: <Search className="size-4" />,
      group: "Web",
      run: () => {
        const id = `t_search_${Math.random().toString(36).slice(2, 7)}`;
        openTab({
          id,
          kind: "search",
          title: "New search",
          query: "",
        });
        toggle(false);
      },
    },
    {
      id: "toggle-agent",
      title: "Toggle Atlas Agent",
      desc: "Open the AI co-author panel",
      icon: <Sparkles className="size-4" />,
      group: "Agent",
      hotkey: "⌘L",
      run: () => {
        toggleAgent();
        toggle(false);
      },
    },
    {
      id: "analyze",
      title: "Run paper critic",
      desc: "Full structural review with scoring",
      icon: <Wand2 className="size-4" />,
      group: "Tools",
      hotkey: "⌘⇧A",
      run: () => {
        toggleAnalyzer();
        toggle(false);
      },
    },
    {
      id: "library",
      title: "Manage citation library",
      desc: "Open Settings → Citation library",
      icon: <Library className="size-4" />,
      group: "Tools",
      run: () => {
        toggle(false);
        useAtlas.getState().toggleSettings(true);
      },
    },
    {
      id: "publish-ledger",
      title: "Publish ledger publicly",
      desc: "Get a /p/<shareKey> URL reviewers can verify",
      icon: <ShieldCheck className="size-4" />,
      group: "Provenance",
      run: () => {
        toggle(false);
        window.dispatchEvent(new CustomEvent("atlas:open-publish-ledger"));
      },
    },
    {
      id: "recover-version",
      title: "Recover previous version",
      desc: "Browse the last 5 snapshots and roll back",
      icon: <History className="size-4" />,
      group: "Workspace",
      run: () => {
        toggle(false);
        window.dispatchEvent(new CustomEvent("atlas:open-recovery"));
      },
    },
    {
      id: "corpus-optin",
      title: "Reviewer-Model corpus opt-in",
      desc: "Choose whether this paper contributes to the next training run",
      icon: <Beaker className="size-4" />,
      group: "Provenance",
      run: () => {
        toggle(false);
        window.dispatchEvent(new CustomEvent("atlas:open-corpus-optin"));
      },
    },
    {
      id: "insert-math",
      title: "Insert math equation",
      desc: "Add an inline or display LaTeX equation",
      icon: <Sigma className="size-4" />,
      group: "Editor",
      run: () => {
        toggle(false);
        // Reuse the slash menu's math form by simulating a slash at the
        // current cursor: PaperEditor listens to this event and pops it open.
        window.dispatchEvent(new CustomEvent("atlas:open-math-insert"));
      },
    },
    {
      id: "generate-references",
      title: "Generate references",
      desc: "Format the paper's citations in APA / Chicago / MLA / Vancouver / IEEE",
      icon: <BookOpenCheck className="size-4" />,
      group: "Editor",
      run: () => {
        toggle(false);
        window.dispatchEvent(new CustomEvent("atlas:open-references"));
      },
    },
    {
      id: "arxiv-bundle",
      title: "Build arXiv submission bundle",
      desc: "Zip up the .tex, .bib, signed ledger, and a submission README",
      icon: <Package className="size-4" />,
      group: "Workspace",
      run: () => {
        toggle(false);
        window.dispatchEvent(new CustomEvent("atlas:open-arxiv-bundle"));
      },
    },
  ];

  // When there's no query, surface recently-used commands first.
  let filtered: Action[];
  if (query) {
    const q = query.toLowerCase();
    filtered = actions.filter((a) =>
      (a.title + " " + (a.desc ?? "")).toLowerCase().includes(q),
    );
  } else if (recent.length > 0) {
    const byId = new Map(actions.map((a) => [a.id, a]));
    const recentActions: Action[] = recent
      .map((id) => byId.get(id))
      .filter((a): a is Action => !!a)
      .map((a) => ({ ...a, group: "Recent" as ActionGroup }));
    const usedIds = new Set(recent);
    filtered = [...recentActions, ...actions.filter((a) => !usedIds.has(a.id))];
  } else {
    filtered = actions;
  }

  const groups = Array.from(new Set(filtered.map((a) => a.group)));

  function runAction(a: Action) {
    saveRecent(a.id);
    a.run();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const a = filtered[active];
      if (a) runAction(a);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[14vh]"
      onClick={() => toggle(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        ref={focusRef}
        className="w-[640px] max-w-[92vw] panel shadow-2xl rounded-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 h-12 border-b border-border">
          <Search className="size-4 text-subtle" />
          <input
            autoFocus
            placeholder="What do you want to do?"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-subtle"
          />
          <span className="kbd">esc</span>
        </div>
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-1.5">
          {filtered.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-subtle">
              No commands match.
            </div>
          )}
          {groups.map((g) => (
            <div key={g} className="mb-1">
              <div className="px-3 py-1 text-[10px] uppercase tracking-[0.15em] text-subtle font-mono">
                {g}
              </div>
              {filtered
                .filter((a) => a.group === g)
                .map((a) => {
                  const idx = filtered.indexOf(a);
                  const selected = idx === active;
                  return (
                    <button
                      key={a.id}
                      data-cmd-index={idx}
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => runAction(a)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded text-left border border-transparent transition-colors",
                        // Keyboard / hover share a single highlighted state.
                        // Active row gets a left accent bar for keyboard
                        // legibility; hover-only rows use a subtler bg.
                        selected
                          ? "bg-surface-2 border-l-accent border-l-2 pl-[10px]"
                          : "hover:bg-surface-2/60",
                      )}
                    >
                      <div className="size-7 rounded border border-border bg-surface flex items-center justify-center text-muted">
                        {a.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium text-foreground truncate">
                          {highlight(a.title, query)}
                        </div>
                        {a.desc && (
                          <div className="text-[11px] text-subtle truncate">
                            {highlight(a.desc, query)}
                          </div>
                        )}
                      </div>
                      {a.hotkey && <span className="kbd">{a.hotkey}</span>}
                      <ArrowRight className="size-3.5 text-subtle" />
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
        <div className="border-t border-border px-3 py-2 flex items-center justify-between text-[10px] text-subtle">
          <div className="flex items-center gap-1.5">
            <span className="kbd">↑</span>
            <span className="kbd">↓</span>
            <span>navigate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="kbd">↵</span>
            <span>select</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const q = query.trim();
  const lower = text.toLowerCase();
  const ql = q.toLowerCase();
  const idx = lower.indexOf(ql);
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-accent font-semibold">
        {text.slice(idx, idx + q.length)}
      </span>
      {text.slice(idx + q.length)}
    </>
  );
}
