"use client";

import { useEffect, useState } from "react";

import { Focus, Save, Loader2, Cpu, History } from "lucide-react";
import { useAtlas, activePaper } from "@/lib/store";
import { useSettings } from "@/lib/settings";
import { venueBudget } from "@/lib/venue-limits";
import { VENUE_PRESETS } from "@/lib/rubrics";
import { listSnapshots } from "@/lib/recovery";
import { cn } from "@/lib/cn";

export function StatusBar() {
  const paper = useAtlas((s) => activePaper(s));
  const agentBusy = useAtlas((s) => s.agentBusy);
  const analysisBusy = useAtlas((s) => s.analysisBusy);
  const focusMode = useSettings((s) => s.focusMode);
  const toggleFocusMode = useSettings((s) => s.toggleFocusMode);
  const venue = useSettings((s) => s.venue);
  const provider = useSettings((s) => s.provider);
  const openaiModel = useSettings((s) => s.openaiModel);
  const anthropicModel = useSettings((s) => s.anthropicModel);
  const ollamaModel = useSettings((s) => s.ollamaModel);
  const toggleSettings = useAtlas((s) => s.toggleSettings);
  const toggleAnalyzer = useAtlas((s) => s.toggleAnalyzer);
  const model =
    provider === "openai"
      ? openaiModel
      : provider === "anthropic"
        ? anthropicModel
        : provider === "ollama"
          ? ollamaModel
          : "mock";

  // savedAgo fades out after a quiet period — once the user trusts that the
  // app saves, repeating "saved 2m ago" forever is just noise. Show it for 5s
  // after each edit, then auto-hide; mouse-enter on the bar re-reveals it.
  // We derive both "savedAgo" and "showSaved" from a single `now` heartbeat
  // tied to paper.updatedAt — no setState-inside-effect needed.
  const [now, setNow] = useState(() => Date.now());
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    if (!paper) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, [paper, paper?.updatedAt]);
  const elapsed = paper
    ? Math.max(0, Math.floor((now - paper.updatedAt) / 1000))
    : 0;
  const savedAgo =
    elapsed < 3
      ? "just now"
      : elapsed < 60
        ? `${elapsed}s ago`
        : elapsed < 3600
          ? `${Math.floor(elapsed / 60)}m ago`
          : `${Math.floor(elapsed / 3600)}h ago`;
  const showSaved = hovered || elapsed < 5;

  const words = countWords(paper?.html ?? "");
  const chars = stripTags(paper?.html ?? "").length;
  const budget = venueBudget(venue, words);
  const venueName = VENUE_PRESETS[venue].name;
  const modelShort = model.replace("claude-", "").replace("gpt-", "");

  return (
    <div
      className="h-6 border-t border-border bg-surface flex items-center px-3 gap-3 text-[10.5px] font-mono text-subtle select-none"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="text-foreground truncate max-w-[280px]">
        {paper?.title ?? "No paper"}
      </span>

      {/* Word/char count is the most useful at-a-glance number. When a venue
          budget is set we promote it to a progress chip — reviewer-facing
          context beats raw counts. */}
      {budget ? (
        <button
          onClick={toggleAnalyzer}
          className={cn(
            "group flex items-center gap-1.5 hover:text-foreground transition-colors",
            budget.state === "over" && "text-danger",
            budget.state === "tight" && "text-warning",
          )}
          title={`${budget.used.toLocaleString()} / ${budget.limit.toLocaleString()} words · ${venueName} · ${chars.toLocaleString()} chars`}
        >
          <span className="tabular-nums">
            {budget.used.toLocaleString()}
            <span className="text-subtle/70"> / {budget.limit.toLocaleString()}</span>
          </span>
          <span
            className="w-12 h-1 rounded-full bg-surface-3 overflow-hidden"
            aria-hidden
          >
            <span
              className={cn(
                "block h-full rounded-full transition-all",
                budget.state === "ok" && "bg-accent",
                budget.state === "near" && "bg-accent",
                budget.state === "tight" && "bg-warning",
                budget.state === "over" && "bg-danger",
              )}
              style={{ width: `${Math.round(budget.ratio * 100)}%` }}
            />
          </span>
          <span className="hidden xl:inline text-subtle group-hover:text-muted">
            {venueName.split(" ")[0]}
          </span>
        </button>
      ) : (
        <span title={`${chars.toLocaleString()} chars`}>
          {words.toLocaleString()} words
        </span>
      )}

      {paper && showSaved && (
        <span className="flex items-center gap-1 text-accent transition-opacity">
          <Save className="size-2.5" />
          saved {savedAgo}
        </span>
      )}

      {(agentBusy || analysisBusy) && (
        <span className="flex items-center gap-1 text-info">
          <Loader2 className="size-2.5 animate-spin" />
          {agentBusy ? "agent" : "critic"} thinking
        </span>
      )}

      <div className="ml-auto flex items-center gap-2.5">
        <SnapshotChip paperId={paper?.id} now={now} />

        {focusMode && (
          <button
            onClick={() => toggleFocusMode()}
            className="flex items-center gap-1 text-accent hover:text-foreground transition-colors"
            title="Exit focus mode (⌘.)"
          >
            <Focus className="size-2.5" />
            focus
            <span className="kbd ml-0.5">⌘.</span>
          </button>
        )}

        {/* Provider · model · venue collapsed into a single chip with a
            tooltip-style title. Click opens Settings where these live. */}
        <button
          onClick={() => toggleSettings(true)}
          className="flex items-center gap-1.5 hover:text-foreground transition-colors group"
          title={`Provider: ${provider} · Model: ${model} · Venue: ${venueName}`}
        >
          <Cpu className="size-2.5 text-accent" />
          <span className="tabular-nums">{modelShort}</span>
          <span className="hidden lg:inline text-subtle/70 group-hover:text-muted">
            · {venueName.split(" ")[0].toLowerCase()}
          </span>
        </button>
      </div>
    </div>
  );
}

function SnapshotChip({
  paperId,
  now,
}: {
  paperId: string | undefined;
  now: number;
}) {
  if (!paperId) return null;
  const snapshots = listSnapshots(paperId);
  if (snapshots.length === 0) return null;
  // Newest snapshot at index 0; format its age relative to `now` so this
  // chip refreshes on the same heartbeat as the saved-Xs-ago label.
  const newestTs = Date.parse(snapshots[0].takenAt);
  const ageS = Math.max(0, Math.floor((now - newestTs) / 1000));
  const ageLabel =
    ageS < 60
      ? `${ageS}s`
      : ageS < 3600
        ? `${Math.floor(ageS / 60)}m`
        : `${Math.floor(ageS / 3600)}h`;
  return (
    <button
      onClick={() =>
        window.dispatchEvent(new CustomEvent("atlas:open-recovery"))
      }
      className="flex items-center gap-1 hover:text-foreground transition-colors group"
      title={`${snapshots.length} recovery snapshot${snapshots.length === 1 ? "" : "s"} · newest taken ${ageLabel} ago. Click to open the recovery dialog.`}
    >
      <History className="size-2.5 text-accent" />
      <span className="tabular-nums">{snapshots.length}</span>
      <span className="hidden lg:inline text-subtle/70 group-hover:text-muted">
        · {ageLabel}
      </span>
    </button>
  );
}

function stripTags(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(html: string) {
  const t = stripTags(html);
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}
