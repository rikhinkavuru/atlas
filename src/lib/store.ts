"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { SAMPLE_PAPER_HTML } from "./sample-paper";
import type {
  AgentMessage,
  AnalysisReport,
  DataBinding,
  EditProposal,
  Paper,
  ProvenanceEvent,
  ProvenanceLedger,
  ReviewSession,
  ReviewerItem,
  SubmissionForecast,
  Tab,
} from "@/types";
import {
  buildEvent,
  computeRootHash,
  getWorkspaceId,
  signRoot,
} from "./provenance";

interface Selection {
  text: string;
  from: number;
  to: number;
}

export interface Comment {
  id: string;
  paperId: string;
  quote: string;
  text: string;
  createdAt: number;
  resolved: boolean;
}

interface AtlasState {
  papers: Record<string, Paper>;
  tabs: Tab[];
  activeTabId: string;
  agentOpen: boolean;
  analyzerOpen: boolean;
  commandOpen: boolean;
  settingsOpen: boolean;
  shortcutsOpen: boolean;
  agentMessages: AgentMessage[];
  agentBusy: boolean;
  selection: Selection | null;
  analysis: AnalysisReport | null;
  analysisBusy: boolean;
  comments: Comment[];
  reviews: Record<string, ReviewSession>;
  ledgers: Record<string, ProvenanceLedger>;
  forecasts: Record<string, SubmissionForecast>;
  bindings: Record<string, DataBinding[]>;

  setActiveTab: (id: string) => void;
  openTab: (tab: Tab) => void;
  closeTab: (id: string) => void;
  updateTab: (id: string, patch: Partial<Tab>) => void;

  updatePaper: (id: string, html: string) => void;
  newPaper: () => string;

  toggleAgent: () => void;
  toggleAnalyzer: () => void;
  toggleCommand: (open?: boolean) => void;
  toggleSettings: (open?: boolean) => void;
  toggleShortcuts: (open?: boolean) => void;

  addComment: (c: Comment) => void;
  resolveComment: (id: string) => void;
  deleteComment: (id: string) => void;

  createReview: (rawText: string, items: ReviewerItem[], paperId?: string) => string;
  updateReviewItem: (
    reviewId: string,
    itemId: string,
    patch: Partial<ReviewerItem>,
  ) => void;
  deleteReview: (id: string) => void;

  recordEvent: (
    input: Omit<Parameters<typeof buildEvent>[1], "paperId"> & {
      paperId: string;
    },
  ) => Promise<ProvenanceEvent>;
  getLedger: (paperId: string) => ProvenanceLedger | null;
  setForecast: (paperId: string, forecast: SubmissionForecast) => void;

  addBinding: (b: DataBinding) => void;
  patchBinding: (id: string, patch: Partial<DataBinding>) => void;
  removeBinding: (id: string) => void;

  setSelection: (s: Selection | null) => void;
  pushMessage: (m: AgentMessage) => void;
  patchMessage: (id: string, patch: Partial<AgentMessage>) => void;
  setAgentBusy: (b: boolean) => void;
  clearMessages: () => void;

  setProposalStatus: (
    messageId: string,
    status: EditProposal["status"],
  ) => void;

  setAnalysis: (r: AnalysisReport | null) => void;
  setAnalysisBusy: (b: boolean) => void;
}

const PAPER_ID = "p_atlas_rag";

const SAMPLE_TAB: Tab = {
  id: "t_main",
  kind: "editor",
  title: "AtlasRAG — draft",
  paperId: PAPER_ID,
};

const SAMPLE_PAPER: Paper = {
  id: PAPER_ID,
  title: "AtlasRAG — Long-Context RAG for Scientific QA",
  html: SAMPLE_PAPER_HTML,
  updatedAt: Date.now(),
};

const WELCOME_MESSAGE: AgentMessage = {
  id: "m_welcome",
  role: "assistant",
  content:
    "I'm your research co-author. Highlight any text and tell me what to do — tighten it, add a citation, rewrite for a reviewer, suggest a counterargument. Or open a browser tab to validate a source and I'll pull the citation in for you.",
  timestamp: Date.now(),
};

export const useAtlas = create<AtlasState>()(
  persist(
    (set, get) => ({
  papers: {
    [PAPER_ID]: SAMPLE_PAPER,
  },
  tabs: [SAMPLE_TAB],
  activeTabId: "t_main",
  agentOpen: true,
  analyzerOpen: false,
  commandOpen: false,
  settingsOpen: false,
  shortcutsOpen: false,
  comments: [],
  reviews: {},
  ledgers: {},
  forecasts: {},
  bindings: {},
  agentMessages: [WELCOME_MESSAGE],
  agentBusy: false,
  selection: null,
  analysis: null,
  analysisBusy: false,

  setActiveTab: (id) => set({ activeTabId: id }),
  openTab: (tab) =>
    set((s) => {
      if (s.tabs.some((t) => t.id === tab.id)) {
        return { activeTabId: tab.id };
      }
      return { tabs: [...s.tabs, tab], activeTabId: tab.id };
    }),
  closeTab: (id) =>
    set((s) => {
      const tabs = s.tabs.filter((t) => t.id !== id);
      const fallback = tabs[tabs.length - 1]?.id ?? "";
      return {
        tabs,
        activeTabId: s.activeTabId === id ? fallback : s.activeTabId,
      };
    }),
  updateTab: (id, patch) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),

  updatePaper: (id, html) =>
    set((s) => ({
      papers: {
        ...s.papers,
        [id]: { ...s.papers[id], html, updatedAt: Date.now() },
      },
    })),
  newPaper: () => {
    const id = `p_${Math.random().toString(36).slice(2, 9)}`;
    const paper: Paper = {
      id,
      title: "Untitled Draft",
      html: "<h1>Untitled Draft</h1><p></p>",
      updatedAt: Date.now(),
    };
    const tab: Tab = {
      id: `t_${id}`,
      kind: "editor",
      title: paper.title,
      paperId: id,
    };
    set((s) => ({
      papers: { ...s.papers, [id]: paper },
      tabs: [...s.tabs, tab],
      activeTabId: tab.id,
    }));
    return id;
  },

  toggleAgent: () => set((s) => ({ agentOpen: !s.agentOpen })),
  toggleAnalyzer: () => set((s) => ({ analyzerOpen: !s.analyzerOpen })),
  toggleCommand: (open) =>
    set((s) => ({ commandOpen: open ?? !s.commandOpen })),
  toggleSettings: (open) =>
    set((s) => ({ settingsOpen: open ?? !s.settingsOpen })),
  toggleShortcuts: (open) =>
    set((s) => ({ shortcutsOpen: open ?? !s.shortcutsOpen })),

  addComment: (c) => set((s) => ({ comments: [c, ...s.comments] })),
  resolveComment: (id) =>
    set((s) => ({
      comments: s.comments.map((c) =>
        c.id === id ? { ...c, resolved: !c.resolved } : c,
      ),
    })),
  deleteComment: (id) =>
    set((s) => ({ comments: s.comments.filter((c) => c.id !== id) })),

  createReview: (rawText, items, paperId) => {
    const id = `r_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const session: ReviewSession = {
      id,
      paperId,
      title: deriveReviewTitle(rawText),
      rawText,
      items,
      createdAt: Date.now(),
    };
    set((s) => ({
      reviews: { ...s.reviews, [id]: session },
      tabs: [
        ...s.tabs,
        {
          id: `t_${id}`,
          kind: "review",
          title: session.title,
          reviewId: id,
          paperId,
        },
      ],
      activeTabId: `t_${id}`,
    }));
    return id;
  },
  updateReviewItem: (reviewId, itemId, patch) =>
    set((s) => ({
      reviews: {
        ...s.reviews,
        [reviewId]: {
          ...s.reviews[reviewId],
          items: s.reviews[reviewId].items.map((it) =>
            it.id === itemId ? { ...it, ...patch } : it,
          ),
        },
      },
    })),
  deleteReview: (id) =>
    set((s) => {
      const { [id]: _, ...rest } = s.reviews;
      const tabs = s.tabs.filter((t) => t.reviewId !== id);
      const activeTabId =
        s.activeTabId.includes(id) ? tabs[tabs.length - 1]?.id ?? "" : s.activeTabId;
      return { reviews: rest, tabs, activeTabId };
    }),

  recordEvent: async (input) => {
    const wsId = getWorkspaceId();
    const state = get();
    const existing = state.ledgers[input.paperId];
    const prev = existing?.events[existing.events.length - 1] ?? null;
    const ev = await buildEvent(prev, input);
    const events = [...(existing?.events ?? []), ev];
    const rootHash = await computeRootHash(wsId, input.paperId, ev.hash);
    const paper = state.papers[input.paperId];
    // Sign the new root with the workspace ECDSA key (Web Crypto).
    let signature: string | undefined;
    let publicKey: ProvenanceLedger["publicKey"];
    let publicKeyFingerprint: string | undefined;
    try {
      const signed = await signRoot(rootHash);
      signature = signed.signature;
      publicKey = signed.publicKey;
      publicKeyFingerprint = signed.fingerprint;
    } catch {
      // SSR / older browser path — leave unsigned, summariser will tag as "missing".
    }
    const ledger: ProvenanceLedger = {
      paperId: input.paperId,
      paperTitle: paper?.title ?? "Untitled",
      createdAt: existing?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
      workspaceId: wsId,
      events,
      rootHash,
      signature,
      publicKey,
      publicKeyFingerprint,
      version: 1,
    };
    set((s) => ({ ledgers: { ...s.ledgers, [input.paperId]: ledger } }));
    return ev;
  },
  getLedger: (paperId) => get().ledgers[paperId] ?? null,
  setForecast: (paperId, forecast) =>
    set((s) => ({ forecasts: { ...s.forecasts, [paperId]: forecast } })),
  addBinding: (b) =>
    set((s) => ({
      bindings: {
        ...s.bindings,
        [b.paperId]: [...(s.bindings[b.paperId] ?? []), b],
      },
    })),
  patchBinding: (id, patch) =>
    set((s) => {
      const next: Record<string, DataBinding[]> = {};
      for (const [pid, list] of Object.entries(s.bindings)) {
        next[pid] = list.map((b) => (b.id === id ? { ...b, ...patch } : b));
      }
      return { bindings: next };
    }),
  removeBinding: (id) =>
    set((s) => {
      const next: Record<string, DataBinding[]> = {};
      for (const [pid, list] of Object.entries(s.bindings)) {
        next[pid] = list.filter((b) => b.id !== id);
      }
      return { bindings: next };
    }),

  setSelection: (selection) => set({ selection }),
  pushMessage: (m) => set((s) => ({ agentMessages: [...s.agentMessages, m] })),
  patchMessage: (id, patch) =>
    set((s) => ({
      agentMessages: s.agentMessages.map((m) =>
        m.id === id ? { ...m, ...patch } : m,
      ),
    })),
  setAgentBusy: (agentBusy) => set({ agentBusy }),
  clearMessages: () =>
    set({
      agentMessages: [
        {
          id: "m_welcome",
          role: "assistant",
          content:
            "Cleared. What should we work on next? Try: 'tighten the abstract', 'add a citation for ColBERTv2', or open a browser tab to validate a source.",
          timestamp: Date.now(),
        },
      ],
    }),

  setProposalStatus: (messageId, status) =>
    set((s) => ({
      agentMessages: s.agentMessages.map((m) =>
        m.id === messageId && m.proposal
          ? { ...m, proposal: { ...m.proposal, status } }
          : m,
      ),
    })),

  setAnalysis: (analysis) => set({ analysis }),
  setAnalysisBusy: (analysisBusy) => set({ analysisBusy }),
}),
    {
      name: "atlas:workspace",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Persist the data the user actually owns — papers, tabs, the active
      // selection, comments, ledgers, reviews, forecasts, bindings — so
      // returning to /app restores "where I left off." UI ephemera
      // (commandOpen, selection, agentBusy, agentMessages, analysis) stays
      // session-local.
      partialize: (s) => ({
        papers: s.papers,
        tabs: s.tabs,
        activeTabId: s.activeTabId,
        comments: s.comments,
        reviews: s.reviews,
        ledgers: s.ledgers,
        forecasts: s.forecasts,
        bindings: s.bindings,
      }),
      // If a returning user has zero tabs (e.g. they closed everything before
      // refreshing), make sure they don't land on a blank screen with no way
      // back to the sample paper.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (!state.papers || Object.keys(state.papers).length === 0) {
          state.papers = { [PAPER_ID]: SAMPLE_PAPER };
        }
        if (!state.tabs || state.tabs.length === 0) {
          state.tabs = [SAMPLE_TAB];
          state.activeTabId = SAMPLE_TAB.id;
        }
        // Defensive: if the active tab no longer exists in tabs, drop to
        // the first tab.
        if (!state.tabs.some((t) => t.id === state.activeTabId)) {
          state.activeTabId = state.tabs[0]?.id ?? "";
        }
      },
    },
  ),
);

export function activePaper(state = useAtlas.getState()): Paper | null {
  const tab = state.tabs.find((t) => t.id === state.activeTabId);
  if (!tab?.paperId) return null;
  return state.papers[tab.paperId] ?? null;
}

function deriveReviewTitle(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "Review";
  const firstLine = trimmed.split(/\n+/)[0].slice(0, 64);
  return `R&R · ${firstLine}`;
}
