"use client";

import {
  Sparkles,
  Send,
  Trash2,
  X,
  Loader2,
  Check,
  Quote,
  Globe,
  Wand2,
  ArrowUpRight,
  AtSign,
  Library,
  ListChecks,
  ShieldCheck,
  ShieldAlert,
  CircleDashed,
  Pencil,
  ScrollText,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAtlas, activePaper } from "@/lib/store";
import { getModelHeaders, useSettings } from "@/lib/settings";
import { cn } from "@/lib/cn";
import type {
  AgentMessage,
  CitationCandidate,
  EditPlan,
  EditPlanStep,
  EditProposal,
} from "@/types";

type Mode = "edit" | "ask" | "plan" | "cite";

/**
 * Fire-off helper that gates a proposal's sources through /api/verify-proposal
 * and re-patches the assistant message with the verified version. We don't
 * await it inline so the user sees the proposal land immediately; verified
 * badges appear a moment later.
 */
async function verifyAndPatch(
  proposal: EditProposal,
  pendingId: string,
  patchMessage: (id: string, patch: Partial<AgentMessage>) => void,
) {
  try {
    const r = await fetch("/api/verify-proposal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proposal }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) return;
    const data = (await r.json()) as { ok: boolean; proposal?: EditProposal };
    if (data.ok && data.proposal) {
      patchMessage(pendingId, { proposal: data.proposal });
    }
  } catch {
    /* leave the un-verified proposal as-is */
  }
}

/** Same pattern as verifyAndPatch but for multi-step plans. The plan UI
 * surfaces per-step unsupportedClaims as a yellow warning before the user
 * accepts each step. */
async function verifyPlanAndPatch(
  plan: EditPlan,
  pendingId: string,
  patchMessage: (id: string, patch: Partial<AgentMessage>) => void,
) {
  try {
    const r = await fetch("/api/verify-proposal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
      // Plans have multiple steps — give it more time than a single proposal.
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) return;
    const data = (await r.json()) as { ok: boolean; plan?: EditPlan };
    if (data.ok && data.plan) {
      patchMessage(pendingId, { plan: data.plan });
    }
  } catch {
    /* leave the un-verified plan as-is */
  }
}

const QUICK_PROMPTS: Record<Mode, { label: string; prompt: string }[]> = {
  edit: [
    { label: "Tighten", prompt: "Rewrite the selected text to be ~30% shorter without losing meaning. Keep the academic tone." },
    { label: "Make rigorous", prompt: "Rewrite the selected text to be more precise. Add hedging where appropriate and avoid unsupported claims." },
    { label: "Plain English", prompt: "Rewrite the selected text in plain English a smart undergrad would understand, without losing technical correctness." },
  ],
  ask: [
    { label: "What's missing?", prompt: "What's missing from this paper that a reviewer would flag?" },
    { label: "Counter-argument", prompt: "Suggest the strongest counter-argument a reviewer might raise about this paper." },
    { label: "Summarize", prompt: "Summarize the paper in 5 sentences for a non-specialist." },
  ],
  plan: [
    { label: "Tighten whole paper", prompt: "Produce a step-by-step plan to tighten and strengthen the entire paper before submission." },
    { label: "Reviewer-2 pass", prompt: "Plan the edits a harsh Reviewer 2 would demand. 4-6 steps, highest leverage first." },
    { label: "Limitations + rigor", prompt: "Plan edits to strengthen the limitations and evaluation rigor for the selected venue." },
  ],
  cite: [
    { label: "Cite this claim", prompt: "Find canonical citations for the selected claim." },
    { label: "Foundational refs", prompt: "Suggest 2-4 foundational references for the topic of this paper." },
    { label: "Cite a RAG claim", prompt: "Find citations to support: 'long-context retrieval-augmented generation reduces hallucination in scientific QA.'" },
  ],
};

export function AgentPanel() {
  const messages = useAtlas((s) => s.agentMessages);
  const busy = useAtlas((s) => s.agentBusy);
  const selection = useAtlas((s) => s.selection);
  const paper = useAtlas((s) => activePaper(s));
  const pushMessage = useAtlas((s) => s.pushMessage);
  const patchMessage = useAtlas((s) => s.patchMessage);
  const setAgentBusy = useAtlas((s) => s.setAgentBusy);
  const clearMessages = useAtlas((s) => s.clearMessages);
  const setProposalStatus = useAtlas((s) => s.setProposalStatus);
  const toggleAgent = useAtlas((s) => s.toggleAgent);

  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("edit");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onFocus = () => inputRef.current?.focus();
    window.addEventListener("atlas:focus-agent", onFocus);
    return () => window.removeEventListener("atlas:focus-agent", onFocus);
  }, []);

  // Ledger sidebar dispatches this when the user clicks an unsupported claim
  // — we switch the agent into Cite mode, pre-fill the input with the claim
  // text, open the panel if it's closed, and focus the input. One click → one
  // workflow step toward fixing the claim.
  // Generic "switch agent into mode X, optionally prefill prompt" — fired by
  // the welcome modal's "Try it" buttons and any other onboarding surface that
  // wants to drop the user into a specific agent mode in one click.
  useEffect(() => {
    const onSetMode = (e: Event) => {
      const detail = (e as CustomEvent<{ mode?: Mode; prompt?: string }>).detail;
      if (!detail) return;
      if (detail.mode) setMode(detail.mode);
      if (typeof detail.prompt === "string") setInput(detail.prompt);
      if (!useAtlas.getState().agentOpen) {
        useAtlas.getState().toggleAgent();
      }
      setTimeout(() => inputRef.current?.focus(), 50);
    };
    window.addEventListener("atlas:set-agent-mode", onSetMode);
    return () => window.removeEventListener("atlas:set-agent-mode", onSetMode);
  }, []);

  useEffect(() => {
    const onCiteClaim = (e: Event) => {
      const detail = (e as CustomEvent<{ claim: string }>).detail;
      if (!detail?.claim) return;
      setMode("cite");
      setInput(`Find citations for: "${detail.claim}"`);
      if (!useAtlas.getState().agentOpen) {
        useAtlas.getState().toggleAgent();
      }
      // After the panel mounts, focus the textarea so the user can review
      // the prompt and hit Enter (or edit it first).
      setTimeout(() => inputRef.current?.focus(), 50);
    };
    window.addEventListener("atlas:cite-claim", onCiteClaim);
    return () => window.removeEventListener("atlas:cite-claim", onCiteClaim);
  }, []);

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function send(text: string, overrideMode?: Mode) {
    const trimmed = text.trim();
    const useMode = overrideMode ?? mode;
    if (!trimmed || busy) return;
    pushMessage({
      id: `m_${Date.now()}_u`,
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    });
    setInput("");
    setAgentBusy(true);

    const pendingId = `m_${Date.now()}_a`;
    pushMessage({
      id: pendingId,
      role: "assistant",
      content: "",
      pending: true,
      timestamp: Date.now(),
    });

    try {
      const s = useSettings.getState();
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getModelHeaders() },
        body: JSON.stringify({
          mode: useMode,
          prompt: trimmed,
          selection: selection?.text ?? null,
          documentTitle: paper?.title ?? "",
          documentHtml: paper?.html ?? "",
          voice: s.voiceProfile ?? null,
          styleNotes: s.styleNotes ?? "",
          requireSources: s.requireSources,
        }),
      });
      if (!res.ok || !res.body) throw new Error("Agent request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let raw = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });
        const visible = stripMarkers(raw);
        patchMessage(pendingId, { content: visible, pending: true });
      }

      const patch: Partial<AgentMessage> = {
        content: stripMarkers(raw).trim(),
        pending: false,
      };

      if (raw.includes("<<<JSON>>>") && useMode === "edit") {
        const part = raw.split("<<<JSON>>>")[1] ?? "";
        try {
          const parsed = JSON.parse(part.trim());
          if (parsed?.after) {
            const initial: EditProposal = {
              id: `p_${Date.now()}`,
              before: selection?.text ?? "",
              after: parsed.after,
              rationale: parsed.rationale || "",
              status: "pending",
              sources: Array.isArray(parsed.sources) ? parsed.sources : [],
              unsupportedClaims: Array.isArray(parsed.unsupportedClaims)
                ? parsed.unsupportedClaims
                : [],
            };
            patch.proposal = initial;

            // Fire-and-forget verification: hit /api/verify-proposal in the
            // background and patch the message again when each source has been
            // resolved (or rejected) against an external registry. The user
            // sees a verified/unverified badge per source before accepting.
            void verifyAndPatch(initial, pendingId, patchMessage);
          }
        } catch {}
      }

      if (raw.includes("<<<PLAN>>>")) {
        const part = raw.split("<<<PLAN>>>")[1] ?? "";
        try {
          const parsed = JSON.parse(part.trim());
          if (parsed?.steps) {
            const plan: EditPlan = {
              goal: parsed.goal ?? "",
              steps: (parsed.steps as EditPlanStep[]).map((s, i) => ({
                ...s,
                id: s.id || `s${i + 1}`,
                status: "pending",
              })),
            };
            patch.plan = plan;
            // Same gating model as edit proposals — each plan step is
            // checked against external registries for inline citations and
            // declared sources. The agent's plan UI updates in place.
            void verifyPlanAndPatch(plan, pendingId, patchMessage);
          }
        } catch {}
      }

      if (raw.includes("<<<CITATIONS>>>") || (useMode === "cite" && raw.includes("<<<JSON>>>"))) {
        const marker = raw.includes("<<<CITATIONS>>>")
          ? "<<<CITATIONS>>>"
          : "<<<JSON>>>";
        const part = raw.split(marker)[1] ?? "";
        try {
          const parsed = JSON.parse(part.trim());
          if (Array.isArray(parsed?.candidates)) {
            patch.citationCandidates = parsed.candidates as CitationCandidate[];
          }
        } catch {}
      }

      patchMessage(pendingId, patch);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const lower = msg.toLowerCase();
      let summary: string;
      if (
        lower.includes("rate") ||
        lower.includes("429") ||
        lower.includes("too many")
      ) {
        summary =
          "Rate-limited by the model. Wait ~30 seconds and try again, or switch provider in Settings (⌘,).";
      } else if (
        lower.includes("401") ||
        lower.includes("unauthorized") ||
        lower.includes("invalid") ||
        lower.includes("api key")
      ) {
        summary =
          "API key looks invalid. Open Settings (⌘,) → Keys to paste a fresh one.";
      } else if (
        lower.includes("timeout") ||
        lower.includes("network") ||
        lower.includes("fetch failed")
      ) {
        summary =
          "Network hiccup reaching the model. Check your connection — your prompt and selection are preserved below.";
      } else if (!useSettings.getState().openaiKey && !useSettings.getState().anthropicKey && useSettings.getState().provider !== "mock") {
        summary =
          "No API key set. Add one in Settings (⌘,), or switch the provider to Mock to try Atlas without a key.";
      } else {
        summary = `Something went wrong reaching the model.\n\n${msg}`;
      }
      patchMessage(pendingId, {
        content: summary,
        pending: false,
        error: { prompt: trimmed, mode: useMode },
      });
    } finally {
      setAgentBusy(false);
    }
  }

  function retryFromError(m: AgentMessage) {
    if (!m.error) return;
    // Drop the failed assistant message and re-send the prompt with the
    // same mode the user originally chose.
    useAtlas.setState((s) => ({
      agentMessages: s.agentMessages.filter((x) => x.id !== m.id),
    }));
    send(m.error.prompt, m.error.mode as Mode);
  }

  async function applyProposal(p: EditProposal, msgId: string) {
    const editor = (window as unknown as { __atlasEditor?: any }).__atlasEditor;
    if (!editor) return;
    const sel = useAtlas.getState().selection;
    // Capture editor position before the insertion so we can compute the
    // exact range that just landed by reading position deltas — text-length
    // arithmetic is wrong once node boundaries (paragraphs) get inserted.
    const before = editor.state.selection.from;
    if (sel) {
      editor
        .chain()
        .focus()
        .insertContentAt({ from: sel.from, to: sel.to }, p.after)
        .run();
    } else {
      editor.chain().focus().insertContent(`\n${p.after}\n`).run();
    }
    const after = editor.state.selection.from;
    setProposalStatus(msgId, "accepted");
    const paperId = paper?.id;
    const s = useSettings.getState();
    const model =
      s.provider === "openai"
        ? s.openaiModel
        : s.provider === "anthropic"
          ? s.anthropicModel
          : "mock";
    if (paperId) {
      const ev = await useAtlas.getState().recordEvent({
        paperId,
        kind: "ai-edit",
        actor: { type: "ai", label: `Atlas Agent · ${s.provider}` },
        provider: s.provider,
        model,
        before: p.before,
        after: p.after,
        sources: p.sources?.map((src) => ({
          label: src.label,
          origin: src.origin,
          doi: src.doi,
          url: src.url,
          quote: src.quote,
        })),
        unsupportedClaims: p.unsupportedClaims,
        position: sel ? { from: sel.from, to: sel.to } : undefined,
      });
      // Wrap the just-inserted range with the ProvenanceMark so hover-to-
      // see-provenance lights up in the editor. The range is the doc-position
      // delta read from the editor after `insertContentAt` runs.
      const insertFrom = sel ? sel.from : Math.min(before, after);
      const insertTo = Math.max(before, after);
      if (insertTo > insertFrom) {
        try {
          editor
            .chain()
            .setTextSelection({ from: insertFrom, to: insertTo })
            .setMark("provenance", {
              eventId: ev.id,
              kind: "ai-edit",
              actor: `Atlas Agent · ${s.provider}`,
              model,
              sourceCount: p.sources?.length ?? 0,
              unsourcedCount: p.unsupportedClaims?.length ?? 0,
            })
            .setTextSelection(insertTo)
            .run();
        } catch {
          // Defensive: if the editor's content shifted underneath us, skip the
          // inline mark — the ledger sidebar still has the event.
        }
      }
    }
  }

  function applyStep(step: EditPlanStep, msgId: string, planIndex: number) {
    const editor = (window as unknown as { __atlasEditor?: any }).__atlasEditor;
    if (!editor) return;
    if (step.action === "insert" || step.action === "rewrite") {
      const text = editor.state.doc.textContent as string;
      const idx = text.indexOf(step.targetQuote);
      if (idx >= 0 && step.action === "rewrite") {
        // Convert plain-text index to ProseMirror position best-effort.
        // We can map by walking the doc.
        const pos = textIndexToDocPos(editor, idx, step.targetQuote.length);
        if (pos) {
          editor
            .chain()
            .focus()
            .insertContentAt({ from: pos.from, to: pos.to }, step.draft)
            .run();
        } else {
          editor.chain().focus().insertContent(`\n${step.draft}\n`).run();
        }
      } else {
        editor.chain().focus().insertContent(`\n${step.draft}\n`).run();
      }
    } else if (step.action === "delete") {
      const text = editor.state.doc.textContent as string;
      const idx = text.indexOf(step.targetQuote);
      const pos = textIndexToDocPos(editor, idx, step.targetQuote.length);
      if (pos) {
        editor.chain().focus().deleteRange({ from: pos.from, to: pos.to }).run();
      }
    } else if (step.action === "comment") {
      // Add a comment mark + push to comments store
      const text = editor.state.doc.textContent as string;
      const idx = text.indexOf(step.targetQuote);
      const pos = textIndexToDocPos(editor, idx, step.targetQuote.length);
      const id = `c_${Date.now()}_${planIndex}`;
      if (pos) {
        editor
          .chain()
          .focus()
          .setTextSelection({ from: pos.from, to: pos.to })
          .setMark("comment", { id })
          .run();
      }
      const paperId = useAtlas.getState().tabs.find(
        (t) => t.id === useAtlas.getState().activeTabId,
      )?.paperId;
      if (paperId) {
        useAtlas.getState().addComment({
          id,
          paperId,
          quote: step.targetQuote,
          text: step.draft,
          createdAt: Date.now(),
          resolved: false,
        });
      }
    }

    // Mark step applied
    const msg = useAtlas
      .getState()
      .agentMessages.find((m) => m.id === msgId);
    if (msg?.plan) {
      const updatedSteps = msg.plan.steps.map((s) =>
        s.id === step.id ? { ...s, status: "applied" as const } : s,
      );
      patchMessage(msgId, {
        plan: { ...msg.plan, steps: updatedSteps },
      });
    }
  }

  function skipStep(stepId: string, msgId: string) {
    const msg = useAtlas
      .getState()
      .agentMessages.find((m) => m.id === msgId);
    if (msg?.plan) {
      patchMessage(msgId, {
        plan: {
          ...msg.plan,
          steps: msg.plan.steps.map((s) =>
            s.id === stepId ? { ...s, status: "skipped" } : s,
          ),
        },
      });
    }
  }

  async function insertCitation(c: CitationCandidate) {
    const editor = (window as unknown as { __atlasEditor?: any }).__atlasEditor;
    if (!editor) return;
    const key = c.authors[0]?.split(" ").pop() ?? "ref";
    const yr = c.year ?? new Date().getFullYear();
    const url = c.url || (c.doi ? `https://doi.org/${c.doi}` : "");
    const label = `${key}${yr}`;
    const before = editor.state.selection.from;
    // Cite-mode candidates came from /api/verify-citation in
    // gatherCitationContext — the server filtered to confidence ≥ 0.6 before
    // streaming, so this insertion is server-verified. Mark the chip
    // explicitly so the editor can render a verified badge.
    editor
      .chain()
      .focus()
      .insertContent(
        `<span class="citation" data-key="${escapeHtml(label)}" data-url="${escapeHtml(url)}" data-verified="1" data-resolved-via="${escapeHtml(c.source)}">[${escapeHtml(label)}]</span> `,
      )
      .run();
    // Register full citation metadata for the References generator.
    if (paper?.id) {
      useAtlas.getState().registerCitation(paper.id, label, c);
    }
    const after = editor.state.selection.from;
    const paperId = paper?.id;
    if (paperId) {
      const ev = await useAtlas.getState().recordEvent({
        paperId,
        kind: "ai-cite",
        actor: { type: "ai", label: "Citation library" },
        after: `[${label}]`,
        sources: [
          {
            label,
            origin: c.source === "nia" ? "library" : "verified",
            doi: c.doi ?? undefined,
            url,
            quote:
              c.snippet ??
              `${c.title} — ${c.authors.slice(0, 3).join(", ")}${c.year ? ` (${c.year})` : ""}`,
          },
        ],
      });
      // Mark the inserted citation chip with provenance metadata so hover
      // reveals the same event details as any other AI-emitted text.
      const insertFrom = Math.min(before, after);
      const insertTo = Math.max(before, after);
      if (insertTo > insertFrom) {
        try {
          editor
            .chain()
            .setTextSelection({ from: insertFrom, to: insertTo })
            .setMark("provenance", {
              eventId: ev.id,
              kind: "ai-cite",
              actor: "Citation library",
              model: c.source,
              sourceCount: 1,
              unsourcedCount: 0,
            })
            .setTextSelection(insertTo)
            .run();
        } catch {
          // Defensive: skip the inline mark if positions shifted.
        }
      }
    }
  }

  return (
    <aside className="w-full h-full flex-1 min-h-0 border-l border-border bg-surface flex flex-col">
      <header className="h-11 px-3 flex items-center gap-2 border-b border-border shrink-0">
        <div className="size-6 rounded bg-accent-soft border border-[#2d3d12] flex items-center justify-center">
          <Sparkles className="size-3.5 text-accent" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[12px] font-semibold">Atlas Agent</span>
          <span className="text-[10px] text-subtle font-mono uppercase tracking-[0.15em]">
            {busy ? "thinking…" : "ready"}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={clearMessages}
            className="btn btn-ghost h-7 text-[11px]"
            title="Clear conversation"
          >
            <Trash2 className="size-3.5" />
          </button>
          <button
            onClick={toggleAgent}
            className="btn btn-ghost h-7 text-[11px]"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </header>

      <div className="px-3 pt-3 shrink-0">
        <div className="grid grid-cols-4 gap-1 p-0.5 bg-background border border-border rounded-md">
          <ModeChip mode="edit" current={mode} setMode={setMode} icon={<Pencil className="size-3" />}>Edit</ModeChip>
          <ModeChip mode="ask" current={mode} setMode={setMode} icon={<Sparkles className="size-3" />}>Ask</ModeChip>
          <ModeChip mode="plan" current={mode} setMode={setMode} icon={<ListChecks className="size-3" />}>Plan</ModeChip>
          <ModeChip mode="cite" current={mode} setMode={setMode} icon={<Library className="size-3" />}>Cite</ModeChip>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3"
      >
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            onAcceptProposal={(p) => applyProposal(p, m.id)}
            onRejectProposal={() => setProposalStatus(m.id, "rejected")}
            onRestoreProposal={() => setProposalStatus(m.id, "pending")}
            onApplyStep={(s, i) => applyStep(s, m.id, i)}
            onSkipStep={(sid) => skipStep(sid, m.id)}
            onInsertCitation={insertCitation}
            onRetry={() => retryFromError(m)}
          />
        ))}
      </div>

      <div className="border-t border-border p-3 space-y-2 bg-background/60 shrink-0">
        {selection && (
          <div className="flex items-start gap-2 px-2 py-1.5 rounded-md bg-accent-soft border border-[#2d3d12] text-[11px] text-foreground">
            <AtSign className="size-3.5 text-accent mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-accent">
                Selection · {selection.text.length} chars
              </div>
              <div className="line-clamp-2 text-muted">{selection.text}</div>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-1">
          {QUICK_PROMPTS[mode].map((q) => (
            <button
              key={q.label}
              onClick={() => send(q.prompt)}
              disabled={busy || (mode === "edit" && !selection)}
              className="text-[10.5px] px-2 py-1 rounded-full border border-border bg-surface text-muted hover:text-foreground hover:bg-surface-2 disabled:opacity-40"
            >
              {q.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              mode === "edit"
                ? selection
                  ? "How should I rewrite this?"
                  : "Highlight text first, then describe the edit."
                : mode === "ask"
                  ? "Ask anything about the paper."
                  : mode === "plan"
                    ? "What should we plan? (whole paper, abstract, methods…)"
                    : "Describe the claim that needs citing, or paste it."
            }
            rows={3}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            className="w-full resize-none bg-background border border-border rounded-md p-2.5 pr-10 text-[13px] placeholder:text-subtle focus:outline-none focus:border-border-strong"
          />
          <button
            onClick={() => send(input)}
            disabled={busy || !input.trim()}
            className="absolute bottom-2 right-2 size-7 rounded bg-accent text-accent-fg flex items-center justify-center disabled:opacity-30 disabled:bg-surface-3 disabled:text-subtle"
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
          </button>
        </div>
        <div className="flex items-center justify-between text-[10px] text-subtle">
          <span>
            <span className="kbd">↵</span> send ·{" "}
            <span className="kbd">⇧↵</span> newline
          </span>
          <ProviderBadge />
        </div>
      </div>
    </aside>
  );
}

function ModeChip({
  mode,
  current,
  setMode,
  icon,
  children,
}: {
  mode: Mode;
  current: Mode;
  setMode: (m: Mode) => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={() => setMode(mode)}
      className={cn(
        "h-7 rounded text-[11px] font-medium inline-flex items-center justify-center gap-1",
        current === mode
          ? "bg-accent text-accent-fg"
          : "text-muted hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function ProviderBadge() {
  const toggleSettings = useAtlas((s) => s.toggleSettings);
  const provider = useSettings((s) => s.provider);
  const openaiModel = useSettings((s) => s.openaiModel);
  const anthropicModel = useSettings((s) => s.anthropicModel);
  const venue = useSettings((s) => s.venue);
  const model =
    provider === "openai"
      ? openaiModel
      : provider === "anthropic"
        ? anthropicModel
        : "mock";
  return (
    <button
      onClick={() => toggleSettings(true)}
      className="font-mono hover:text-foreground transition-colors text-right"
      title="Change model and venue in settings"
    >
      {provider} · {model.replace("claude-", "").replace("gpt-", "")}
      <span className="ml-1 text-subtle">· {venue}</span>
    </button>
  );
}

function MessageBubble({
  message,
  onAcceptProposal,
  onRejectProposal,
  onRestoreProposal,
  onApplyStep,
  onSkipStep,
  onInsertCitation,
  onRetry,
}: {
  message: AgentMessage;
  onAcceptProposal: (p: EditProposal) => void;
  onRejectProposal: () => void;
  onRestoreProposal: () => void;
  onApplyStep: (s: EditPlanStep, idx: number) => void;
  onSkipStep: (id: string) => void;
  onInsertCitation: (c: CitationCandidate) => void;
  onRetry: () => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] bg-surface-2 border border-border rounded-lg rounded-tr-sm px-3 py-2 text-[13px] whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }
  const isError = !!message.error;
  return (
    <div className="flex gap-2">
      <div
        className={cn(
          "size-6 rounded-md shrink-0 flex items-center justify-center mt-0.5 border",
          isError
            ? "bg-warning/10 border-warning/40"
            : "bg-accent-soft border-[#2d3d12]",
        )}
      >
        {isError ? (
          <ShieldAlert className="size-3.5 text-warning" />
        ) : (
          <Sparkles className="size-3.5 text-accent" />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {message.content && (
          <div
            className={cn(
              "text-[13px] leading-relaxed whitespace-pre-wrap",
              isError ? "text-warning" : "text-foreground",
            )}
          >
            {message.content}
            {message.pending && (
              <span className="inline-block ml-1 align-middle size-1.5 rounded-full bg-accent pulse-dot" />
            )}
          </div>
        )}
        {isError && (
          <button
            onClick={onRetry}
            className="btn btn-sm text-[11px]"
            title="Re-send the same prompt"
          >
            Try again
          </button>
        )}
        {message.proposal && (
          <ProposalCard
            proposal={message.proposal}
            onAccept={() => onAcceptProposal(message.proposal!)}
            onReject={onRejectProposal}
            onRestore={onRestoreProposal}
          />
        )}
        {message.plan && (
          <PlanCard
            plan={message.plan}
            onApply={onApplyStep}
            onSkip={onSkipStep}
          />
        )}
        {message.citationCandidates && message.citationCandidates.length > 0 && (
          <CitationsList
            candidates={message.citationCandidates}
            onInsert={onInsertCitation}
          />
        )}
      </div>
    </div>
  );
}

function ProposalCard({
  proposal,
  onAccept,
  onReject,
  onRestore,
}: {
  proposal: EditProposal;
  onAccept: () => void;
  onReject: () => void;
  onRestore: () => void;
}) {
  const accepted = proposal.status === "accepted";
  const rejected = proposal.status === "rejected";
  return (
    <div
      className={cn(
        "rounded-md border bg-background overflow-hidden",
        accepted
          ? "border-accent"
          : rejected
            ? "border-border opacity-70"
            : "border-border",
      )}
    >
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border bg-surface">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-subtle font-mono">
          <Wand2 className="size-3" />
          Proposed edit
        </div>
        <div className="flex items-center gap-1">
          {accepted ? (
            <span className="text-[10px] text-accent flex items-center gap-1">
              <Check className="size-3" /> Applied
            </span>
          ) : rejected ? (
            <button
              onClick={onRestore}
              className="text-[10.5px] px-2 h-6 rounded border border-border text-muted hover:text-foreground hover:bg-surface-2 inline-flex items-center gap-1"
              title="Restore this proposal to pending"
            >
              <ArrowUpRight className="size-3 -rotate-90" />
              Undo dismiss
            </button>
          ) : (
            <>
              <button
                onClick={onReject}
                className="text-[10.5px] px-2 h-6 rounded border border-border text-muted hover:text-foreground hover:bg-surface-2"
              >
                Reject
              </button>
              <button
                onClick={onAccept}
                className="text-[10.5px] px-2 h-6 rounded bg-accent text-accent-fg hover:bg-[var(--accent-hover)] flex items-center gap-1"
              >
                <Check className="size-3" />
                Accept
              </button>
            </>
          )}
        </div>
      </div>
      <div className="p-2.5 space-y-1.5 text-[12px]">
        {proposal.before && (
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-subtle mb-0.5">
              Before
            </div>
            <div className="px-2 py-1.5 rounded bg-surface-2 border border-border text-muted line-through decoration-1 decoration-[color-mix(in_srgb,var(--subtle)_70%,transparent)]">
              {proposal.before}
            </div>
          </div>
        )}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-subtle mb-0.5">
            After
          </div>
          <div className="px-2 py-1.5 rounded bg-accent-soft border border-[#2d3d12] text-foreground">
            {proposal.after}
          </div>
        </div>
        {proposal.rationale && (
          <div className="flex gap-1.5 pt-1 text-[11px] text-muted">
            <Quote className="size-3 text-subtle mt-0.5 shrink-0" />
            <span className="italic">{proposal.rationale}</span>
          </div>
        )}
        {proposal.sources && proposal.sources.length > 0 && (
          <div className="pt-1.5 space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-subtle flex items-center gap-1.5">
              <span>Supported by · {proposal.sources.length}</span>
              {proposal.sources.some((s) => s.verified === undefined) && (
                <span className="flex items-center gap-1 text-info">
                  <Loader2 className="size-2.5 animate-spin" />
                  verifying
                </span>
              )}
            </div>
            <ul className="space-y-1">
              {proposal.sources.map((s, i) => {
                // Three states: verified (green), pending (subtle), failed (warning).
                const state =
                  s.verified === true
                    ? "ok"
                    : s.verified === false
                      ? "fail"
                      : "pending";
                return (
                  <li
                    key={i}
                    className={cn(
                      "text-[10.5px] flex items-start gap-1.5 pl-2 border-l-2",
                      state === "ok" && "border-accent/40",
                      state === "fail" && "border-warning/40",
                      state === "pending" && "border-border",
                    )}
                  >
                    {state === "ok" ? (
                      <ShieldCheck className="size-2.5 mt-0.5 text-accent shrink-0" />
                    ) : state === "fail" ? (
                      <ShieldAlert className="size-2.5 mt-0.5 text-warning shrink-0" />
                    ) : (
                      <CircleDashed className="size-2.5 mt-0.5 text-subtle shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div
                        className={cn(
                          "font-medium",
                          state === "fail" ? "text-warning" : "text-foreground",
                        )}
                      >
                        {s.label ?? s.origin ?? "source"}
                        {s.url && (
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1 text-accent underline underline-offset-2"
                          >
                            link
                          </a>
                        )}
                        {state === "ok" && s.resolvedVia && (
                          <span className="ml-1.5 text-subtle font-mono text-[9.5px] uppercase tracking-[0.12em]">
                            via {s.resolvedVia}
                            {typeof s.confidence === "number" && (
                              <> · {Math.round(s.confidence * 100)}%</>
                            )}
                          </span>
                        )}
                        {state === "fail" && (
                          <span className="ml-1.5 text-warning font-mono text-[9.5px] uppercase tracking-[0.12em]">
                            unverified
                          </span>
                        )}
                      </div>
                      <div className="text-subtle italic truncate">
                        &ldquo;{s.quote}&rdquo;
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {proposal.unsupportedClaims &&
          proposal.unsupportedClaims.length > 0 && (
            <div className="pt-1.5 space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-warning">
                Needs citation · {proposal.unsupportedClaims.length}
              </div>
              <ul className="space-y-0.5">
                {proposal.unsupportedClaims.map((c, i) => (
                  <li
                    key={i}
                    className="text-[10.5px] text-warning flex items-start gap-1.5 border-l-2 border-warning/40 pl-2"
                  >
                    <ShieldAlert className="size-2.5 mt-0.5 shrink-0" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  onApply,
  onSkip,
}: {
  plan: EditPlan;
  onApply: (s: EditPlanStep, idx: number) => void;
  onSkip: (id: string) => void;
}) {
  return (
    <div className="rounded-md border border-border bg-background overflow-hidden">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border bg-surface">
        <ScrollText className="size-3 text-accent" />
        <div className="text-[10px] uppercase tracking-[0.15em] text-subtle font-mono">
          Edit plan · {plan.steps.length} steps
        </div>
        <div className="ml-auto text-[10px] text-subtle">
          {plan.steps.filter((s) => s.status === "applied").length}/
          {plan.steps.length} applied
        </div>
      </div>
      {plan.goal && (
        <div className="px-2.5 py-1.5 text-[11.5px] text-muted border-b border-border bg-surface/40">
          Goal: <span className="text-foreground">{plan.goal}</span>
        </div>
      )}
      <ol className="divide-y divide-border">
        {plan.steps.map((s, i) => {
          const isApplied = s.status === "applied";
          const isSkipped = s.status === "skipped";
          return (
            <li
              key={s.id}
              className={cn(
                "px-2.5 py-2 space-y-1",
                isSkipped && "opacity-50",
              )}
            >
              <div className="flex items-center gap-2 text-[11px]">
                <span
                  className={cn(
                    "size-4 rounded-full border flex items-center justify-center text-[9px] font-mono",
                    isApplied
                      ? "bg-accent text-accent-fg border-accent"
                      : "border-border text-subtle",
                  )}
                >
                  {isApplied ? <Check className="size-2.5" /> : i + 1}
                </span>
                <span className="text-[10px] uppercase tracking-[0.12em] text-subtle font-mono">
                  {s.action} · {s.section}
                </span>
                <span className="ml-auto flex items-center gap-1">
                  {!isApplied && !isSkipped && (
                    <>
                      <button
                        onClick={() => onSkip(s.id)}
                        className="text-[10px] px-1.5 h-5 rounded border border-border text-muted hover:text-foreground"
                      >
                        Skip
                      </button>
                      <button
                        onClick={() => onApply(s, i)}
                        className="text-[10px] px-1.5 h-5 rounded bg-accent text-accent-fg hover:bg-[#b7e23a]"
                      >
                        Apply
                      </button>
                    </>
                  )}
                </span>
              </div>
              <div className="text-[11.5px] text-muted italic line-clamp-1">
                {`"${s.targetQuote}"`}
              </div>
              <div className="text-[12px] text-foreground leading-relaxed">
                {s.draft}
              </div>
              <div className="text-[10.5px] text-subtle">{s.why}</div>
              {s.sources && s.sources.length > 0 && (
                <div className="text-[10.5px] text-subtle flex items-center gap-1 flex-wrap pt-0.5">
                  <span className="font-mono uppercase tracking-[0.12em]">
                    sources:
                  </span>
                  {s.sources.map((src, sidx) => (
                    <span
                      key={sidx}
                      className={cn(
                        "px-1 py-0.5 rounded border text-[9.5px] font-mono",
                        src.verified
                          ? "border-accent/40 bg-accent-soft text-accent"
                          : src.verified === false
                            ? "border-warning/40 bg-warning/5 text-warning"
                            : "border-border text-subtle",
                      )}
                      title={
                        src.verified
                          ? `verified via ${src.resolvedVia ?? "registry"}${src.confidence ? ` · ${Math.round(src.confidence * 100)}%` : ""}`
                          : src.verified === false
                            ? "could not verify against any registry"
                            : "pending verification"
                      }
                    >
                      {src.label || src.doi || src.url || "?"}
                    </span>
                  ))}
                </div>
              )}
              {s.unsupportedClaims && s.unsupportedClaims.length > 0 && (
                <div className="text-[10.5px] text-warning flex items-start gap-1.5 pt-0.5">
                  <ShieldAlert className="size-2.5 mt-0.5 shrink-0" />
                  <span>
                    Unverified citation
                    {s.unsupportedClaims.length === 1 ? "" : "s"}:{" "}
                    {s.unsupportedClaims.join(", ")}
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function CitationsList({
  candidates,
  onInsert,
}: {
  candidates: CitationCandidate[];
  onInsert: (c: CitationCandidate) => void;
}) {
  return (
    <div className="rounded-md border border-border bg-background overflow-hidden">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border bg-surface">
        <Library className="size-3 text-accent" />
        <div className="text-[10px] uppercase tracking-[0.15em] text-subtle font-mono">
          Citation candidates · {candidates.length}
        </div>
      </div>
      <ul className="divide-y divide-border">
        {candidates.map((c, i) => (
          <li key={i} className="px-2.5 py-2 space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-subtle font-mono">
              <span className="px-1.5 py-0.5 rounded bg-accent-soft text-accent border border-[#2d3d12]">
                {c.source}
              </span>
              <ConfidencePill confidence={c.confidence} />
              {c.doi && <span className="text-subtle">doi:{c.doi}</span>}
              <span className="ml-auto">{c.year ?? ""}</span>
            </div>
            <div className="text-[12.5px] font-medium text-foreground leading-snug">
              {c.title}
            </div>
            <div className="text-[11px] text-muted">
              {c.authors.slice(0, 4).join(", ")}
              {c.authors.length > 4 ? " et al." : ""}
            </div>
            {c.snippet && (
              <div className="text-[11px] text-subtle italic line-clamp-2 border-l-2 border-border pl-2">
                {c.snippet}
              </div>
            )}
            <div className="flex items-center gap-1 pt-1">
              <button
                onClick={() => onInsert(c)}
                className="btn h-6 text-[10.5px]"
              >
                <Check className="size-3" />
                Insert citation
              </button>
              {c.url && (
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost h-6 text-[10.5px]"
                >
                  <ArrowUpRight className="size-3" />
                  Open
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConfidencePill({ confidence }: { confidence: number }) {
  const verified = confidence >= 0.7;
  const lowConf = confidence < 0.5;
  return (
    <span
      className={cn(
        "px-1.5 py-0.5 rounded inline-flex items-center gap-1 border",
        verified
          ? "text-accent border-[#2d3d12] bg-accent-soft"
          : lowConf
            ? "text-warning border-warning/40 bg-warning/5"
            : "text-info border-info/40 bg-info/5",
      )}
    >
      {verified ? (
        <ShieldCheck className="size-2.5" />
      ) : lowConf ? (
        <ShieldAlert className="size-2.5" />
      ) : (
        <CircleDashed className="size-2.5" />
      )}
      {Math.round(confidence * 100)}%
    </span>
  );
}

function stripMarkers(s: string) {
  for (const marker of ["<<<JSON>>>", "<<<PLAN>>>", "<<<CITATIONS>>>"]) {
    const idx = s.indexOf(marker);
    if (idx >= 0) return s.slice(0, idx);
  }
  return s;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textIndexToDocPos(
  editor: any,
  textIdx: number,
  length: number,
): { from: number; to: number } | null {
  if (textIdx < 0) return null;
  let pos = 0;
  let from = -1;
  let to = -1;
  let acc = 0;
  editor.state.doc.descendants((node: any, position: number) => {
    if (from >= 0 && to >= 0) return false;
    if (node.isText) {
      const text = node.text ?? "";
      const start = acc;
      const end = acc + text.length;
      if (from < 0 && textIdx >= start && textIdx < end) {
        from = position + (textIdx - start);
      }
      if (to < 0 && textIdx + length >= start && textIdx + length <= end) {
        to = position + (textIdx + length - start);
      }
      acc = end;
    }
    pos = position;
    return true;
  });
  if (from < 0 || to < 0) return null;
  return { from, to };
}
