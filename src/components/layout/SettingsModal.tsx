"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Sun,
  Moon,
  Key,
  Cpu,
  Eye,
  EyeOff,
  Trash2,
  Check,
  Sparkles,
  Target,
  Library,
  Plus,
  Loader2,
  Globe,
  ShieldCheck,
  ShieldAlert,
  CircleDashed,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { useSettings, type Provider, type Theme } from "@/lib/settings";
import { normalizeOrcid } from "@/lib/orcid";
import { VENUE_PRESETS, type VenueId } from "@/lib/rubrics";
import { computeVoiceProfile } from "@/lib/voice";
import { downloadLab, importLabFile } from "@/lib/atlaslab";
import { LabSection } from "./LabSection";
import { cn } from "@/lib/cn";
import { Network, Archive } from "lucide-react";
import { useFocusTrap } from "@/lib/use-focus-trap";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Section =
  | "keys"
  | "model"
  | "venue"
  | "voice"
  | "library"
  | "lab"
  | "workspace"
  | "appearance"
  | "about";

const OPENAI_MODELS = [
  { id: "gpt-4o-mini", label: "GPT-4o mini — fast / cheap" },
  { id: "gpt-4o", label: "GPT-4o — flagship" },
  { id: "gpt-4.1-mini", label: "GPT-4.1 mini" },
  { id: "gpt-4.1", label: "GPT-4.1" },
];

const ANTHROPIC_MODELS = [
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 — fast" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { id: "claude-opus-4-7", label: "Claude Opus 4.7 — strongest" },
];

export function SettingsModal({ open, onClose }: Props) {
  const settings = useSettings();
  const [section, setSection] = useState<Section>("keys");
  const [showOpenAI, setShowOpenAI] = useState(false);
  const [showAnthropic, setShowAnthropic] = useState(false);
  const [showNia, setShowNia] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Settings"
        >
          <motion.div
            ref={trapRef}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="panel w-[860px] max-w-[96vw] h-[620px] max-h-[90vh] overflow-hidden shadow-2xl rounded-xl flex flex-col lg:flex-row"
          >
            <aside className="w-full lg:w-44 shrink-0 border-b lg:border-b-0 lg:border-r border-border bg-surface-2 p-3 flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-visible">
              <div className="text-[10px] uppercase tracking-[0.15em] text-subtle font-mono px-2 mb-2">
                Settings
              </div>
              <NavItem
                active={section === "keys"}
                onClick={() => setSection("keys")}
                icon={<Key className="size-3.5" />}
                label="API keys"
              />
              <NavItem
                active={section === "model"}
                onClick={() => setSection("model")}
                icon={<Cpu className="size-3.5" />}
                label="Model"
              />
              <NavItem
                active={section === "venue"}
                onClick={() => setSection("venue")}
                icon={<Target className="size-3.5" />}
                label="Rubric & venue"
              />
              <NavItem
                active={section === "voice"}
                onClick={() => setSection("voice")}
                icon={<Sparkles className="size-3.5" />}
                label="Voice"
              />
              <NavItem
                active={section === "library"}
                onClick={() => setSection("library")}
                icon={<Library className="size-3.5" />}
                label="Citation library"
              />
              <NavItem
                active={section === "lab"}
                onClick={() => setSection("lab")}
                icon={<Network className="size-3.5" />}
                label="Lab graph"
              />
              <NavItem
                active={section === "workspace"}
                onClick={() => setSection("workspace")}
                icon={<Archive className="size-3.5" />}
                label="Workspace"
              />
              <NavItem
                active={section === "appearance"}
                onClick={() => setSection("appearance")}
                icon={
                  settings.theme === "light" ? (
                    <Sun className="size-3.5" />
                  ) : (
                    <Moon className="size-3.5" />
                  )
                }
                label="Appearance"
              />
              <NavItem
                active={section === "about"}
                onClick={() => setSection("about")}
                icon={<Sparkles className="size-3.5" />}
                label="About"
              />
              <div className="mt-auto pt-3 border-t border-border">
                <button
                  onClick={() => {
                    if (confirm("Reset all settings (including API keys)?")) {
                      settings.reset();
                    }
                  }}
                  className="btn btn-ghost h-7 text-[11px] text-subtle w-full justify-start"
                >
                  <Trash2 className="size-3.5" />
                  Reset all
                </button>
              </div>
            </aside>
            <main className="flex-1 min-w-0 flex flex-col">
              <header className="h-11 px-5 flex items-center border-b border-border">
                <h2 className="text-[13px] font-semibold tracking-tight">
                  {section === "keys" && "API Keys"}
                  {section === "model" && "Model"}
                  {section === "venue" && "Rubric & venue"}
                  {section === "voice" && "Voice profile"}
                  {section === "library" && "Citation library (Nia)"}
                  {section === "lab" && "Lab graph"}
                  {section === "workspace" && "Workspace export & import"}
                  {section === "appearance" && "Appearance"}
                  {section === "about" && "About Atlas"}
                </h2>
                <button
                  onClick={onClose}
                  className="ml-auto size-7 rounded hover:bg-surface-2 flex items-center justify-center text-muted"
                >
                  <X className="size-4" />
                </button>
              </header>
              <div className="flex-1 overflow-y-auto p-5">
                {section === "keys" && (
                  <div className="space-y-5">
                    <p className="text-[12px] text-muted leading-relaxed">
                      Bring your own keys. Stored locally in your browser only —
                      they never touch our server except as a forwarded header
                      when calling the provider's API.
                    </p>
                    <KeyField
                      label="OpenAI API key"
                      hint="GPT models. platform.openai.com → API keys."
                      placeholder="sk-..."
                      value={settings.openaiKey}
                      setValue={settings.setOpenAIKey}
                      visible={showOpenAI}
                      setVisible={setShowOpenAI}
                    />
                    <KeyField
                      label="Anthropic API key"
                      hint="Claude models. console.anthropic.com → API keys."
                      placeholder="sk-ant-..."
                      value={settings.anthropicKey}
                      setValue={settings.setAnthropicKey}
                      visible={showAnthropic}
                      setVisible={setShowAnthropic}
                    />
                    <KeyField
                      label="Nia API key"
                      hint="Powers the citation library (indexing + semantic search). app.trynia.ai → Settings → API Keys."
                      placeholder="nia_..."
                      value={settings.niaKey}
                      setValue={settings.setNiaKey}
                      visible={showNia}
                      setVisible={setShowNia}
                    />
                    <div className="text-[11px] text-subtle bg-surface-2 border border-border rounded-md p-3 leading-relaxed">
                      <span className="text-foreground font-medium">
                        Without a model key
                      </span>{" "}
                      Atlas falls back to a mock so the UI is demoable. Without
                      a Nia key, citation suggestions still work via CrossRef +
                      OpenAlex + Semantic Scholar — you just lose the personal
                      library.
                    </div>
                  </div>
                )}

                {section === "model" && (
                  <div className="space-y-5">
                    <Field
                      label="Provider"
                      hint="Which API to use for the agent and analyzer."
                    >
                      <div className="grid grid-cols-3 gap-1 p-0.5 bg-background border border-border rounded-md">
                        {(["openai", "anthropic", "mock"] as Provider[]).map(
                          (p) => (
                            <button
                              key={p}
                              onClick={() => settings.setProvider(p)}
                              className={cn(
                                "h-8 rounded text-[11.5px] font-medium",
                                settings.provider === p
                                  ? "bg-accent text-accent-fg"
                                  : "text-muted hover:text-foreground",
                              )}
                            >
                              {p === "openai"
                                ? "OpenAI"
                                : p === "anthropic"
                                  ? "Anthropic"
                                  : "Mock"}
                            </button>
                          ),
                        )}
                      </div>
                    </Field>
                    {settings.provider === "openai" && (
                      <Field
                        label="OpenAI model"
                        hint="Lower-cost models stream faster but may produce shorter rewrites."
                      >
                        <Select
                          value={settings.openaiModel}
                          onChange={settings.setOpenAIModel}
                          options={OPENAI_MODELS}
                        />
                      </Field>
                    )}
                    {settings.provider === "anthropic" && (
                      <Field
                        label="Anthropic model"
                        hint="Claude Haiku is fastest; Opus is strongest for review."
                      >
                        <Select
                          value={settings.anthropicModel}
                          onChange={settings.setAnthropicModel}
                          options={ANTHROPIC_MODELS}
                        />
                      </Field>
                    )}
                    {settings.provider === "mock" && (
                      <div className="text-[12px] text-muted bg-surface-2 border border-border rounded-md p-3">
                        Mock provider returns scripted responses. Useful for
                        development without burning tokens.
                      </div>
                    )}
                  </div>
                )}

                {section === "venue" && <VenueSection />}
                {section === "voice" && <VoiceSection />}
                {section === "library" && <LibrarySection />}
                {section === "lab" && <LabSection />}
                {section === "workspace" && <WorkspaceSection />}

                {section === "appearance" && (
                  <div className="space-y-5">
                    <Field label="Theme">
                      <div className="grid grid-cols-2 gap-2">
                        {(["dark", "light"] as Theme[]).map((t) => (
                          <button
                            key={t}
                            onClick={() => settings.setTheme(t)}
                            className={cn(
                              "p-3 rounded-md border text-left flex items-center gap-2",
                              settings.theme === t
                                ? "border-accent bg-accent-soft"
                                : "border-border bg-surface hover:bg-surface-2",
                            )}
                          >
                            {t === "dark" ? (
                              <Moon className="size-4 text-muted" />
                            ) : (
                              <Sun className="size-4 text-muted" />
                            )}
                            <span className="text-[13px] font-medium capitalize">
                              {t}
                            </span>
                            {settings.theme === t && (
                              <Check className="size-4 text-accent ml-auto" />
                            )}
                          </button>
                        ))}
                      </div>
                    </Field>
                    <Field label="Editor">
                      <label className="flex items-center gap-2 text-[13px]">
                        <input
                          type="checkbox"
                          checked={settings.showShortcuts}
                          onChange={settings.toggleShortcuts}
                          className="accent-accent"
                        />
                        Show keyboard shortcuts in tooltips
                      </label>
                      <label className="flex items-center gap-2 text-[13px] mt-2">
                        <input
                          type="checkbox"
                          checked={settings.autoSave}
                          onChange={settings.toggleAutoSave}
                          className="accent-accent"
                        />
                        Auto-save drafts to this browser
                      </label>
                      <label className="flex items-center gap-2 text-[13px] mt-2">
                        <input
                          type="checkbox"
                          checked={settings.showBlockProvenance}
                          onChange={settings.toggleShowBlockProvenance}
                          className="accent-accent"
                        />
                        <span className="flex-1">
                          Show paragraph provenance markers
                          <span className="block text-[11px] text-subtle leading-tight mt-0.5">
                            A 2px left border on each paragraph — green for
                            sourced AI text, amber for unsupported claims.
                          </span>
                        </span>
                      </label>
                    </Field>
                  </div>
                )}

                {section === "about" && (
                  <div className="space-y-4 text-[13px] text-muted leading-relaxed">
                    <h3 className="text-foreground text-base font-semibold">
                      Atlas — Research Paper Studio
                    </h3>
                    <p>
                      A Cursor-style workspace for analyzing, marking up, and
                      drafting research papers. Highlight any passage and
                      describe the edit in plain English; validate every claim
                      with an in-tab browser; run a rubric-graded peer-review
                      critique on demand; build a private citation library with
                      Nia.
                    </p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>
                        BYOK: OpenAI, Anthropic, and Nia keys live in your
                        browser only.
                      </li>
                      <li>
                        Citations are verified against CrossRef + OpenAlex +
                        Semantic Scholar (+ your Nia library) before insertion.
                      </li>
                      <li>
                        Hit <span className="kbd">⌘</span>{" "}
                        <span className="kbd">K</span> any time to jump between
                        features.
                      </li>
                    </ul>
                  </div>
                )}
              </div>
              <footer className="px-5 py-3 border-t border-border flex items-center justify-between text-[11px] text-subtle">
                <span>Changes save automatically.</span>
                <button onClick={onClose} className="btn btn-primary h-7 text-[11px]">
                  Done
                </button>
              </footer>
            </main>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function NavItem({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded text-[12px] text-left",
        active
          ? "bg-surface text-foreground"
          : "text-muted hover:text-foreground hover:bg-surface",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-foreground mb-1">
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-[11px] text-subtle mt-1 leading-relaxed">{hint}</p>
      )}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input"
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function KeyField({
  label,
  hint,
  placeholder,
  value,
  setValue,
  visible,
  setVisible,
}: {
  label: string;
  hint: string;
  placeholder: string;
  value: string;
  setValue: (v: string) => void;
  visible: boolean;
  setVisible: (v: boolean) => void;
}) {
  return (
    <Field label={label} hint={hint}>
      <div className="relative">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          className="input pr-9"
        />
        <button
          onClick={() => setVisible(!visible)}
          className="absolute right-1 top-1/2 -translate-y-1/2 size-7 rounded flex items-center justify-center text-subtle hover:text-foreground hover:bg-surface-2"
        >
          {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
      </div>
    </Field>
  );
}

function VenueSection() {
  const venue = useSettings((s) => s.venue);
  const setVenue = useSettings((s) => s.setVenue);
  const rubric = VENUE_PRESETS[venue];

  return (
    <div className="space-y-5">
      <Field
        label="Target venue"
        hint="The analyzer uses this rubric to grade your draft. Switch venues to compare critiques."
      >
        <div className="grid grid-cols-2 gap-2">
          {Object.values(VENUE_PRESETS).map((v) => (
            <button
              key={v.id}
              onClick={() => setVenue(v.id as VenueId)}
              className={cn(
                "p-2.5 rounded-md border text-left",
                venue === v.id
                  ? "border-accent bg-accent-soft"
                  : "border-border bg-surface hover:bg-surface-2",
              )}
            >
              <div className="text-[12.5px] font-medium text-foreground">
                {v.name}
              </div>
              <div className="text-[10.5px] text-subtle leading-relaxed mt-0.5">
                {v.audience}
              </div>
              {venue === v.id && (
                <Check className="size-3.5 text-accent mt-1" />
              )}
            </button>
          ))}
        </div>
      </Field>
      <div>
        <div className="text-[10px] uppercase tracking-[0.15em] text-subtle font-mono mb-2">
          Rubric · {rubric.name}
        </div>
        <div className="space-y-3">
          {rubric.dimensions.map((d) => (
            <div
              key={d.name}
              className="border border-border rounded-md p-3 bg-surface"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12.5px] font-medium text-foreground">
                  {d.name}
                </span>
                <span className="text-[10px] text-subtle font-mono">
                  weight {d.weight}
                </span>
              </div>
              <ul className="space-y-1">
                {d.criteria.map((c, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-1.5 text-[11.5px] text-muted leading-relaxed"
                  >
                    <Target className="size-2.5 mt-0.5 shrink-0 text-accent" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-subtle mt-3 leading-relaxed">
          Each analyzer score is graded against these criteria, and every issue
          surfaced cites the specific rubric line it relates to.
        </p>
      </div>
    </div>
  );
}

interface LibraryItem {
  id: string;
  title: string;
  url: string;
  status: string;
  type: string;
}

function LibrarySection() {
  const niaKey = useSettings((s) => s.niaKey);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [displayName, setDisplayName] = useState("");

  function headers() {
    const h: Record<string, string> = {};
    if (niaKey) h["x-nia-key"] = niaKey;
    return h;
  }

  async function refresh() {
    if (!niaKey) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/library", { headers: headers() });
      const data = await r.json();
      if (data.error) {
        setError(`${data.error}${data.status ? ` (${data.status})` : ""}`);
        setItems([]);
      } else {
        setItems(data.sources ?? []);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [niaKey]);

  // Poll any "indexing/pending/processing" items every few seconds
  useEffect(() => {
    const inflight = items.filter(
      (i) =>
        !["completed", "ready", "failed", "error"].includes(
          (i.status ?? "").toLowerCase(),
        ),
    );
    if (inflight.length === 0) return;
    const interval = setInterval(async () => {
      let changed = false;
      const updated = await Promise.all(
        items.map(async (it) => {
          if (
            ["completed", "ready", "failed", "error"].includes(
              (it.status ?? "").toLowerCase(),
            )
          ) {
            return it;
          }
          try {
            const r = await fetch(
              `/api/library/status?id=${encodeURIComponent(it.id)}`,
              { headers: headers() },
            );
            const data = await r.json();
            if (data.status && data.status !== it.status) changed = true;
            return { ...it, status: data.status ?? it.status };
          } catch {
            return it;
          }
        }),
      );
      if (changed) setItems(updated);
    }, 4000);
    return () => clearInterval(interval);
  }, [items, niaKey]);

  async function addSource() {
    const u = url.trim();
    if (!u || !niaKey) return;
    setAdding(true);
    setError(null);
    try {
      const r = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers() },
        body: JSON.stringify({ url: u, displayName: displayName.trim() || undefined }),
      });
      const data = await r.json();
      if (data.error) {
        setError(`${data.error}${data.status ? ` (${data.status})` : ""}`);
      } else if (data.source) {
        setItems((prev) => [data.source, ...prev]);
        setUrl("");
        setDisplayName("");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this source from your library?")) return;
    try {
      await fetch(`/api/library?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: headers(),
      });
      setItems((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      setError(String(e));
    }
  }

  if (!niaKey) {
    return (
      <div className="space-y-3">
        <div className="text-[12.5px] text-muted leading-relaxed">
          Atlas uses{" "}
          <a
            href="https://docs.trynia.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline underline-offset-2"
          >
            Nia
          </a>{" "}
          to build a private semantic index of your reading list. Paste papers,
          blog posts, or documentation URLs once, and the agent can pull
          verified citations from your library before falling back to CrossRef
          / OpenAlex / Semantic Scholar.
        </div>
        <div className="panel p-3 text-[12px] text-muted">
          Add a Nia API key in the <span className="text-foreground">API keys</span> tab
          to enable the citation library.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-[12px] text-muted leading-relaxed">
        Paste any URL — arXiv paper, journal article, blog post, doc page. Nia
        crawls it, embeds it, and makes it semantically searchable by the
        agent. Indexing takes a few seconds to a few minutes; status updates
        live below.
      </div>

      <div className="panel p-3 space-y-2">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addSource();
            }}
            placeholder="https://arxiv.org/abs/2310.06825"
            className="input"
            disabled={adding}
          />
          <button
            onClick={addSource}
            disabled={adding || !url.trim()}
            className="btn btn-primary h-8 text-[12px] disabled:opacity-40"
          >
            {adding ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Indexing
              </>
            ) : (
              <>
                <Plus className="size-3.5" /> Index
              </>
            )}
          </button>
        </div>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Optional label (e.g., 'Smith2024 — RetroLM')"
          className="input"
          disabled={adding}
        />
      </div>

      {error && (
        <div className="text-[11px] text-warning bg-warning/5 border border-warning/40 rounded p-2 leading-relaxed font-mono">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.15em] text-subtle font-mono">
          Indexed sources · {items.length}
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="btn btn-ghost h-7 text-[11px]"
        >
          <RefreshCw
            className={cn("size-3.5", loading && "animate-spin")}
          />
          Refresh
        </button>
      </div>

      {loading && items.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-14 rounded bg-surface-2 shimmer border border-border"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-[12px] text-subtle p-4 border border-dashed border-border rounded text-center">
          No sources yet. Paste a URL above to get started.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it) => (
            <LibraryRow key={it.id} item={it} onRemove={remove} />
          ))}
        </ul>
      )}
    </div>
  );
}

function VoiceSection() {
  const voice = useSettings((s) => s.voiceProfile);
  const setVoice = useSettings((s) => s.setVoiceProfile);
  const styleNotes = useSettings((s) => s.styleNotes);
  const setStyleNotes = useSettings((s) => s.setStyleNotes);
  const requireSources = useSettings((s) => s.requireSources);
  const toggleRequireSources = useSettings((s) => s.toggleRequireSources);
  const authorName = useSettings((s) => s.authorName);
  const setAuthorName = useSettings((s) => s.setAuthorName);
  const authorOrcid = useSettings((s) => s.authorOrcid);
  const setAuthorOrcid = useSettings((s) => s.setAuthorOrcid);
  const [orcidInput, setOrcidInput] = useState(authorOrcid);
  const [orcidError, setOrcidError] = useState<string | null>(null);
  const [samples, setSamples] = useState<string[]>(voice?.samples ?? [""]);
  const [busy, setBusy] = useState(false);

  function commitOrcid() {
    const trimmed = orcidInput.trim();
    if (!trimmed) {
      setAuthorOrcid("");
      setOrcidError(null);
      return;
    }
    const normalised = normalizeOrcid(trimmed);
    if (!normalised) {
      setOrcidError(
        "Doesn't look like a valid ORCID iD — expected XXXX-XXXX-XXXX-XXXX with a valid checksum.",
      );
      return;
    }
    setAuthorOrcid(normalised);
    setOrcidInput(normalised);
    setOrcidError(null);
  }

  function addSample() {
    setSamples((s) => [...s, ""]);
  }
  function removeSample(idx: number) {
    setSamples((s) => s.filter((_, i) => i !== idx));
  }
  function updateSample(idx: number, value: string) {
    setSamples((s) => s.map((v, i) => (i === idx ? value : v)));
  }

  function build() {
    const valid = samples.filter((s) => s.trim().length > 80);
    if (valid.length === 0) {
      setVoice(null);
      return;
    }
    setBusy(true);
    setTimeout(() => {
      const profile = computeVoiceProfile(valid);
      setVoice(profile);
      setBusy(false);
    }, 50);
  }

  function clearVoice() {
    if (!confirm("Clear voice profile?")) return;
    setVoice(null);
    setSamples([""]);
  }

  return (
    <div className="space-y-5">
      <Field label="Author identity">
        <p className="text-[11.5px] text-subtle leading-relaxed mb-2">
          Stamped onto every author event in the provenance ledger so
          reviewers can verify which human signed it. ORCID iD is optional
          but recommended for camera-ready submissions — it lets a reviewer
          tie the ledger to your published authorship.
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-subtle">
              Display name
            </span>
            <input
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Jane Smith"
              className="input mt-1 w-full"
              maxLength={80}
            />
          </label>
          <label className="block">
            <span className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-subtle">
              ORCID iD
            </span>
            <input
              value={orcidInput}
              onChange={(e) => {
                setOrcidInput(e.target.value);
                if (orcidError) setOrcidError(null);
              }}
              onBlur={commitOrcid}
              placeholder="0000-0001-2345-6789"
              className={cn(
                "input mt-1 w-full font-mono text-[12.5px]",
                orcidError && "border-warning",
              )}
            />
            {orcidError ? (
              <span className="text-[10.5px] text-warning mt-1 block">
                {orcidError}
              </span>
            ) : authorOrcid ? (
              <a
                href={`https://orcid.org/${authorOrcid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10.5px] text-accent underline underline-offset-2 mt-1 inline-block"
              >
                Verify on orcid.org →
              </a>
            ) : null}
          </label>
        </div>
      </Field>

      <p className="text-[12px] text-muted leading-relaxed">
        Paste 1–3 paragraphs (or whole sections) of writing you&apos;ve published.
        Atlas computes a style fingerprint — sentence length, hedge habits,
        vocabulary, characteristic phrasing — and conditions every rewrite to
        match. This is what stops the agent from sounding like generic AI.
      </p>

      <div className="space-y-2">
        {samples.map((s, i) => (
          <div key={i} className="relative">
            <textarea
              value={s}
              onChange={(e) => updateSample(i, e.target.value)}
              rows={5}
              placeholder={`Paste sample ${i + 1} (your published prose, abstract, methods, etc.)`}
              className="w-full bg-background border border-border rounded-md p-2.5 text-[12.5px] focus:outline-none focus:border-border-strong resize-none"
            />
            {samples.length > 1 && (
              <button
                onClick={() => removeSample(i)}
                className="absolute top-2 right-2 size-6 rounded text-subtle hover:text-danger hover:bg-surface-2 flex items-center justify-center"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        ))}
        <div className="flex items-center gap-2">
          <button
            onClick={addSample}
            className="btn btn-ghost h-7 text-[11px]"
          >
            <Plus className="size-3.5" />
            Add another sample
          </button>
          <button
            onClick={build}
            disabled={busy || samples.every((s) => s.trim().length < 80)}
            className="btn btn-primary h-7 text-[11px] ml-auto"
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            Compute voice profile
          </button>
        </div>
      </div>

      {voice && (
        <div className="panel p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.15em] text-subtle font-mono">
              Active profile
            </div>
            <button
              onClick={clearVoice}
              className="text-[11px] text-subtle hover:text-danger"
            >
              Clear
            </button>
          </div>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11.5px]">
            <li>
              <span className="text-subtle">Avg sentence</span>{" "}
              <span className="text-foreground font-mono">
                {voice.avgSentenceLength} words
              </span>
            </li>
            <li>
              <span className="text-subtle">Hedge rate</span>{" "}
              <span className="text-foreground font-mono">
                {(voice.hedgeRate * 100).toFixed(2)}%
              </span>
            </li>
            <li>
              <span className="text-subtle">Passive ratio</span>{" "}
              <span className="text-foreground font-mono">
                {voice.passiveRate}
              </span>
            </li>
            <li>
              <span className="text-subtle">Citations / 1k</span>{" "}
              <span className="text-foreground font-mono">
                {voice.citationDensityPer1k}
              </span>
            </li>
          </ul>
          {voice.preferredHedges.length > 0 && (
            <div className="text-[11px]">
              <span className="text-subtle">Hedges: </span>
              <span className="text-foreground">
                {voice.preferredHedges.slice(0, 6).join(", ")}
              </span>
            </div>
          )}
          {voice.jargonVocab.length > 0 && (
            <div className="text-[11px]">
              <span className="text-subtle">Vocab: </span>
              <span className="text-foreground">
                {voice.jargonVocab.slice(0, 10).join(", ")}
              </span>
            </div>
          )}
          {voice.characteristicBigrams.length > 0 && (
            <div className="text-[11px]">
              <span className="text-subtle">Phrasing: </span>
              <span className="text-foreground italic">
                {voice.characteristicBigrams.slice(0, 5).join(" · ")}
              </span>
            </div>
          )}
        </div>
      )}

      <Field
        label="Free-form style notes"
        hint="Anything the model should know — preferred terms, forbidden phrases, advisor preferences."
      >
        <textarea
          value={styleNotes}
          onChange={(e) => setStyleNotes(e.target.value)}
          rows={3}
          placeholder={`e.g. Don't use "delve", "leverage", or "in conclusion". Prefer "we" over "the authors".`}
          className="w-full bg-background border border-border rounded-md p-2.5 text-[12.5px] focus:outline-none focus:border-border-strong resize-none"
        />
      </Field>

      <label className="flex items-center gap-2 text-[12.5px]">
        <input
          type="checkbox"
          checked={requireSources}
          onChange={toggleRequireSources}
          className="accent-accent"
        />
        Require source quotes for every claim in agent rewrites
      </label>
      <p className="text-[11px] text-subtle leading-relaxed">
        When on, the agent must populate the &ldquo;Supported by&rdquo; box on
        every proposal. Claims it can&apos;t source go into &ldquo;Needs citation&rdquo; instead of into your paper.
      </p>
    </div>
  );
}

function WorkspaceSection() {
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function doExport() {
    try {
      downloadLab();
      setInfo("Workspace exported.");
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }

  function pickFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.atlaslab.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const res = await importLabFile(file);
        setInfo(
          `Imported ${res.imported} paper${res.imported === 1 ? "" : "s"}${res.voice ? " + voice profile" : ""}.`,
        );
        setError(null);
      } catch (e) {
        setError(String(e));
      }
    };
    input.click();
  }

  return (
    <div className="space-y-5">
      <p className="text-[12px] text-muted leading-relaxed">
        Bundle your papers, comments, citation library configuration, voice
        profile, and venue settings into one file. Import it on another machine
        or share with a labmate to seed their workspace.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={doExport}
          className="panel p-4 text-left hover:border-border-strong transition-colors"
        >
          <div className="text-[13px] font-medium mb-1">
            Export workspace
          </div>
          <div className="text-[11.5px] text-subtle leading-relaxed">
            Saves a portable{" "}
            <span className="font-mono text-foreground">.atlaslab.json</span>{" "}
            with every paper, comment, and the voice/rubric you have set.
          </div>
        </button>
        <button
          onClick={pickFile}
          className="panel p-4 text-left hover:border-border-strong transition-colors"
        >
          <div className="text-[13px] font-medium mb-1">
            Import workspace
          </div>
          <div className="text-[11.5px] text-subtle leading-relaxed">
            Loads papers and settings from a{" "}
            <span className="font-mono text-foreground">.atlaslab.json</span>.
            Papers are added without overwriting your current ones.
          </div>
        </button>
      </div>

      {info && (
        <div className="text-[11.5px] text-accent bg-accent-soft border border-[#2d3d12] rounded p-2">
          {info}
        </div>
      )}
      {error && (
        <div className="text-[11.5px] text-warning bg-warning/5 border border-warning/40 rounded p-2">
          {error}
        </div>
      )}
    </div>
  );
}

function LibraryRow({
  item,
  onRemove,
}: {
  item: LibraryItem;
  onRemove: (id: string) => void;
}) {
  const status = (item.status ?? "").toLowerCase();
  const ready = ["completed", "ready"].includes(status);
  const failed = ["failed", "error"].includes(status);
  const inflight = !ready && !failed;
  return (
    <li className="panel p-2.5 flex items-start gap-2.5">
      <div
        className={cn(
          "size-7 rounded border flex items-center justify-center shrink-0 mt-0.5",
          ready
            ? "text-accent border-[#2d3d12] bg-accent-soft"
            : failed
              ? "text-danger border-danger/40 bg-danger/5"
              : "text-info border-info/40 bg-info/5",
        )}
      >
        {ready ? (
          <ShieldCheck className="size-3.5" />
        ) : failed ? (
          <ShieldAlert className="size-3.5" />
        ) : (
          <Loader2 className="size-3.5 animate-spin" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-subtle font-mono">
          <span className="px-1.5 py-0.5 rounded bg-surface-3">
            {item.type || "source"}
          </span>
          <span
            className={cn(
              ready
                ? "text-accent"
                : failed
                  ? "text-danger"
                  : "text-info",
            )}
          >
            {item.status}
          </span>
        </div>
        <div className="text-[12px] font-medium text-foreground truncate">
          {item.title}
        </div>
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10.5px] text-subtle hover:text-accent truncate inline-flex items-center gap-1"
          >
            <Globe className="size-2.5" />
            {item.url}
            <ExternalLink className="size-2.5" />
          </a>
        )}
      </div>
      <button
        onClick={() => onRemove(item.id)}
        className="size-6 rounded text-subtle hover:text-danger hover:bg-surface-2 flex items-center justify-center shrink-0"
        title="Remove from library"
      >
        <Trash2 className="size-3.5" />
      </button>
    </li>
  );
}
