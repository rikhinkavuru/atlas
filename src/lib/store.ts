"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { SAMPLE_PAPER_HTML } from "./sample-paper";
import type {
  AgentMessage,
  AnalysisReport,
  AuthorEdit,
  CitationCandidate,
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

export interface CommentReply {
  id: string;
  /** Author display name at the moment the reply was posted. */
  authorName: string;
  /** Optional ORCID iD stamped from settings — same provenance flow as
   *  the signed ledger so reviewers can tie replies to a real human. */
  authorOrcid?: string;
  text: string;
  createdAt: number;
}

export interface Comment {
  id: string;
  paperId: string;
  quote: string;
  text: string;
  createdAt: number;
  resolved: boolean;
  /** Threaded replies. Local-only today; when real-time collab grows
   *  past the cursor/presence MVP, these move into Liveblocks Storage
   *  so peers see each other's replies live. The shape doesn't change. */
  replies?: CommentReply[];
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
  /** Author edit log per paper. Append-only; persisted; capped at 200 events
   * per paper so the local storage doesn't blow up over months of drafting. */
  authorEdits: Record<string, AuthorEdit[]>;
  /** Per-paper citation registry — every citation candidate that's been
   * inserted into the paper, indexed by the citation key. Drives the
   * "Generate references" flow + bibliography format export. */
  citations: Record<string, Record<string, CitationCandidate>>;

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
  /** Append a reply to an existing comment. No-op when the comment id
   *  isn't found (e.g. user deleted the parent mid-typing a reply). */
  addCommentReply: (commentId: string, reply: CommentReply) => void;
  /** Delete a reply by id. Useful for "undo my last reply" or moderation. */
  deleteCommentReply: (commentId: string, replyId: string) => void;

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
  /** Record (or coalesce) an author commit. See updatePaper for trigger logic. */
  recordAuthorEdit: (edit: AuthorEdit) => void;
  /** Read-only convenience: the last commit timestamp for a paper. */
  lastAuthorEditAt: (paperId: string) => number | undefined;
  /** Add a citation to the registry for a paper. Keyed by citation key (e.g.
   * "Smith2024") so re-inserting the same key updates the stored metadata. */
  registerCitation: (paperId: string, key: string, c: CitationCandidate) => void;
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
    "Welcome to Atlas. I'm your AI co-author — but every action I take is signed into a hash-chained ledger your reviewers can verify.\n\nTry this on the sample paper:\n\n1. Highlight any sentence and ask me to tighten or rewrite it — I'll return a diff you accept or reject, and the change goes in the ledger.\n2. Type $E = mc^2$ anywhere to insert inline math, or press / and pick \"Math equation\" for display equations.\n3. Hit ⌘⇧A to run the Paper Critic — it grades against the venue rubric and predicts Reviewer 2's questions.\n4. When you're ready, File → Publish ledger gives reviewers a /p/<key> URL they can verify independently.\n\nThe sample paper below is from a fake AtlasRAG draft — feel free to scribble on it.",
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
  authorEdits: {},
  citations: {},
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
  addCommentReply: (commentId, reply) =>
    set((s) => ({
      comments: s.comments.map((c) =>
        c.id === commentId
          ? { ...c, replies: [...(c.replies ?? []), reply] }
          : c,
      ),
    })),
  deleteCommentReply: (commentId, replyId) =>
    set((s) => ({
      comments: s.comments.map((c) =>
        c.id === commentId
          ? {
              ...c,
              replies: (c.replies ?? []).filter((r) => r.id !== replyId),
            }
          : c,
      ),
    })),

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
  recordAuthorEdit: (edit) =>
    set((s) => {
      const prev = s.authorEdits[edit.paperId] ?? [];
      // Coalesce: if the last edit is by the same actor within 30s, merge.
      const last = prev[prev.length - 1];
      const isCoalescable =
        last &&
        last.actorId === edit.actorId &&
        edit.timestamp - last.timestamp < 30_000;
      const next = isCoalescable
        ? [
            ...prev.slice(0, -1),
            {
              ...last,
              timestamp: edit.timestamp,
              wordsDelta: last.wordsDelta + edit.wordsDelta,
              charsDelta: last.charsDelta + edit.charsDelta,
              snippet: edit.snippet,
            },
          ]
        : [...prev, edit];
      // Cap at 200 entries per paper.
      const capped = next.length > 200 ? next.slice(-200) : next;
      return { authorEdits: { ...s.authorEdits, [edit.paperId]: capped } };
    }),
  lastAuthorEditAt: (paperId) => {
    const list = get().authorEdits[paperId];
    return list && list.length > 0 ? list[list.length - 1].timestamp : undefined;
  },
  registerCitation: (paperId, key, c) =>
    set((s) => {
      const paper = s.citations[paperId] ?? {};
      return {
        citations: {
          ...s.citations,
          [paperId]: { ...paper, [key]: c },
        },
      };
    }),
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
        authorEdits: s.authorEdits,
        citations: s.citations,
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
