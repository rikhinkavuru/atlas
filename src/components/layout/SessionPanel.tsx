"use client";

import { useMemo } from "react";
import { History, Plus, Minus, UserCircle, Network } from "lucide-react";
import { useAtlas, activePaper } from "@/lib/store";
import { cn } from "@/lib/cn";
import type { AuthorEdit } from "@/types";

/**
 * Track-changes timeline for the active paper.
 *
 * Distinct from the provenance ledger: this records human edits to give
 * authors a "what did I do this week" view. The ledger only records actions
 * that need cryptographic provenance (AI edits, imports, citations).
 *
 * When real multi-author collab ships (Yjs/Liveblocks), each peer's commits
 * arrive with their own actorId; the UI groups by author automatically.
 */
export function SessionPanel() {
  const paper = useAtlas((s) => activePaper(s));
  const edits = useAtlas((s) =>
    paper ? s.authorEdits[paper.id] ?? [] : [],
  );

  // Group consecutive commits by day for the timeline header.
  const groups = useMemo(() => groupByDay(edits), [edits]);

  return (
    <div className="p-2">
      <div className="px-2 py-1.5 text-[10px] uppercase tracking-[0.15em] text-subtle flex items-center gap-1.5">
        <History className="size-3 text-accent" />
        Track changes
        <span className="ml-auto text-foreground/80 font-mono">
          {edits.length}
        </span>
      </div>

      <PresenceStub />

      {edits.length === 0 && (
        <div className="px-2 py-3 text-xs text-subtle leading-relaxed">
          No author edits recorded yet. Start typing in the editor — every
          sentence-sized change lands here as a track-changes entry, separate
          from the AI provenance ledger.
        </div>
      )}

      <ul className="space-y-2 mt-1">
        {groups.map((g) => (
          <li key={g.label}>
            <div className="px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-subtle font-mono">
              {g.label}
            </div>
            <ul className="space-y-1">
              {g.items
                .slice()
                .reverse()
                .map((e) => (
                  <li key={e.id}>
                    <EditRow edit={e} />
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ul>

      <p className="mt-3 px-2 text-[10px] text-subtle leading-relaxed">
        Author edits are persisted locally and stay in-browser until you
        publish the ledger. Real multi-author collaboration (Yjs/Liveblocks)
        is on the roadmap — this panel is the surface that lights up when
        it ships.
      </p>
    </div>
  );
}

function PresenceStub() {
  // Placeholder for real presence — single-author today. We keep the chip in
  // place so the slot exists for when the collab backend lands; nothing else
  // in the UI needs to move.
  return (
    <div className="mx-2 my-2 px-2 py-1.5 rounded-md bg-surface-2/40 border border-border flex items-center gap-2 text-[11px]">
      <span className="size-5 rounded-full bg-accent-soft border border-[#2d3d12] flex items-center justify-center text-accent">
        <UserCircle className="size-3" />
      </span>
      <span className="text-foreground">You</span>
      <span className="text-subtle font-mono text-[10px]">· editing</span>
      <span
        className="ml-auto inline-flex items-center gap-1 text-[9.5px] font-mono uppercase tracking-[0.12em] text-subtle"
        title="Multi-author collab is on the roadmap"
      >
        <Network className="size-2.5" />
        1 online
      </span>
    </div>
  );
}

function EditRow({ edit }: { edit: AuthorEdit }) {
  const time = new Date(edit.timestamp).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const sign = edit.charsDelta >= 0 ? "+" : "";
  return (
    <div className="px-2 py-1.5 rounded hover:bg-surface-2/60 transition-colors">
      <div className="flex items-center gap-2 text-[11px]">
        <span className="text-subtle font-mono w-12 shrink-0 text-[10.5px]">
          {time}
        </span>
        <span
          className={cn(
            "font-mono text-[10.5px] tabular-nums shrink-0",
            edit.charsDelta >= 0 ? "text-accent" : "text-warning",
          )}
        >
          {edit.charsDelta >= 0 ? (
            <Plus className="size-2.5 inline -mt-0.5 mr-0.5" />
          ) : (
            <Minus className="size-2.5 inline -mt-0.5 mr-0.5" />
          )}
          {sign}
          {Math.abs(edit.charsDelta)}c
          <span className="text-subtle ml-1">
            {sign}
            {edit.wordsDelta}w
          </span>
        </span>
      </div>
      {edit.snippet && (
        <div className="text-[10.5px] text-muted italic leading-snug mt-0.5 pl-14 line-clamp-1">
          “{edit.snippet}”
        </div>
      )}
    </div>
  );
}

function groupByDay(edits: AuthorEdit[]): {
  label: string;
  items: AuthorEdit[];
}[] {
  if (edits.length === 0) return [];
  const fmt = (ts: number) => {
    const d = new Date(ts);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };
  const groups = new Map<string, AuthorEdit[]>();
  for (const e of edits) {
    const k = fmt(e.timestamp);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(e);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({
    label,
    items,
  }));
}
