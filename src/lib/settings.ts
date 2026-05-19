"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { VenueId } from "./rubrics";
import type { VoiceProfile } from "./voice";
import type { Lab } from "./lab";

export type Theme = "light" | "dark";
export type Provider = "openai" | "anthropic" | "mock";

export interface Settings {
  theme: Theme;
  provider: Provider;
  openaiKey: string;
  anthropicKey: string;
  openaiModel: string;
  anthropicModel: string;
  showShortcuts: boolean;
  autoSave: boolean;
  venue: VenueId;
  niaKey: string;
  voiceProfile: VoiceProfile | null;
  styleNotes: string;
  requireSources: boolean;
  suggestionMode: boolean;
  agentPanelWidth: number;
  focusMode: boolean;
  /** Render the 2px provenance left-border on top-level blocks. Default on. */
  showBlockProvenance: boolean;
  /** Reviewer-Model corpus opt-in default for new papers. The `corpusOptIn`
   * field below tracks the per-paper override on top of this default. */
  corpusOptInDefault: boolean;
  /** Per-paper opt-in. Keyed by paperId; presence in the map means the user
   * has made an explicit choice (overrides the default). */
  corpusOptIn: Record<string, boolean>;
  /** Author ORCID iD in canonical dashed form (XXXX-XXXX-XXXX-XXXX). Stamped
   *  onto provenance events so reviewers can verify which human signed them.
   *  Empty string = not set. Validated on save. */
  authorOrcid: string;
  /** Display name for the author actor on provenance events. Defaults to
   *  "Author" when empty. Capped at 80 chars on save. */
  authorName: string;
  lab: Lab | null;
}

interface SettingsState extends Settings {
  setTheme: (t: Theme) => void;
  setProvider: (p: Provider) => void;
  setOpenAIKey: (k: string) => void;
  setAnthropicKey: (k: string) => void;
  setOpenAIModel: (m: string) => void;
  setAnthropicModel: (m: string) => void;
  toggleShortcuts: () => void;
  toggleAutoSave: () => void;
  setVenue: (v: VenueId) => void;
  setNiaKey: (k: string) => void;
  setVoiceProfile: (p: VoiceProfile | null) => void;
  setStyleNotes: (s: string) => void;
  toggleRequireSources: () => void;
  toggleSuggestionMode: () => void;
  setAgentPanelWidth: (w: number) => void;
  toggleFocusMode: (open?: boolean) => void;
  toggleShowBlockProvenance: () => void;
  toggleCorpusOptInDefault: () => void;
  setCorpusOptIn: (paperId: string, value: boolean | null) => void;
  isCorpusOptedIn: (paperId: string) => boolean;
  setAuthorOrcid: (orcid: string) => void;
  setAuthorName: (name: string) => void;
  setLab: (lab: Lab | null) => void;
  patchLab: (patch: Partial<Lab>) => void;
  reset: () => void;
}

const defaults: Settings = {
  theme: "dark",
  provider: "openai",
  openaiKey: "",
  anthropicKey: "",
  openaiModel: "gpt-4o-mini",
  anthropicModel: "claude-haiku-4-5-20251001",
  showShortcuts: true,
  autoSave: true,
  venue: "generic",
  niaKey: "",
  voiceProfile: null,
  styleNotes: "",
  requireSources: true,
  suggestionMode: false,
  agentPanelWidth: 420,
  focusMode: false,
  showBlockProvenance: true,
  // Reviewer-Model corpus opt-in is OFF by default — promise is "stay-out is
  // the default and we don't penalise you for it". User flips this globally
  // OR per-paper, and the per-paper override beats the default.
  corpusOptInDefault: false,
  corpusOptIn: {},
  authorOrcid: "",
  authorName: "",
  lab: null,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...defaults,
      setTheme: (theme) => {
        set({ theme });
        if (typeof document !== "undefined") {
          document.documentElement.setAttribute("data-theme", theme);
        }
      },
      setProvider: (provider) => set({ provider }),
      setOpenAIKey: (openaiKey) => set({ openaiKey }),
      setAnthropicKey: (anthropicKey) => set({ anthropicKey }),
      setOpenAIModel: (openaiModel) => set({ openaiModel }),
      setAnthropicModel: (anthropicModel) => set({ anthropicModel }),
      toggleShortcuts: () => set((s) => ({ showShortcuts: !s.showShortcuts })),
      toggleAutoSave: () => set((s) => ({ autoSave: !s.autoSave })),
      setVenue: (venue) => set({ venue }),
      setNiaKey: (niaKey) => set({ niaKey }),
      setVoiceProfile: (voiceProfile) => set({ voiceProfile }),
      setStyleNotes: (styleNotes) => set({ styleNotes }),
      toggleRequireSources: () =>
        set((s) => ({ requireSources: !s.requireSources })),
      toggleSuggestionMode: () =>
        set((s) => ({ suggestionMode: !s.suggestionMode })),
      setAgentPanelWidth: (agentPanelWidth) =>
        set({
          agentPanelWidth: Math.max(300, Math.min(720, agentPanelWidth)),
        }),
      toggleFocusMode: (open) =>
        set((s) => ({ focusMode: open ?? !s.focusMode })),
      toggleShowBlockProvenance: () =>
        set((s) => ({ showBlockProvenance: !s.showBlockProvenance })),
      toggleCorpusOptInDefault: () =>
        set((s) => ({ corpusOptInDefault: !s.corpusOptInDefault })),
      setCorpusOptIn: (paperId, value) =>
        set((s) => {
          const next = { ...s.corpusOptIn };
          if (value === null) delete next[paperId];
          else next[paperId] = value;
          return { corpusOptIn: next };
        }),
      isCorpusOptedIn: (paperId) => {
        const s = get();
        // Per-paper override beats the global default. `undefined` means the
        // user hasn't decided for this paper yet → fall through to default.
        const override = s.corpusOptIn[paperId];
        if (typeof override === "boolean") return override;
        return s.corpusOptInDefault;
      },
      setAuthorOrcid: (authorOrcid) => set({ authorOrcid }),
      setAuthorName: (authorName) =>
        set({ authorName: authorName.slice(0, 80) }),
      setLab: (lab) => set({ lab }),
      patchLab: (patch) =>
        set((s) => ({
          lab: s.lab ? { ...s.lab, ...patch, updatedAt: Date.now() } : s.lab,
        })),
      reset: () => set({ ...defaults }),
    }),
    {
      name: "atlas:settings",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);

export function getModelHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const s = useSettings.getState();
  const h: Record<string, string> = {
    "x-provider": s.provider,
  };
  if (s.openaiKey) h["x-openai-key"] = s.openaiKey;
  if (s.anthropicKey) h["x-anthropic-key"] = s.anthropicKey;
  if (s.provider === "openai" && s.openaiModel) h["x-model"] = s.openaiModel;
  if (s.provider === "anthropic" && s.anthropicModel)
    h["x-model"] = s.anthropicModel;
  if (s.niaKey) h["x-nia-key"] = s.niaKey;
  if (s.venue) h["x-venue"] = s.venue;
  return h;
}
