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
  lab: null,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
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
