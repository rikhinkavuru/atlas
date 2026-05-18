"use client";

import { useEffect, useState } from "react";
import {
  GitFork,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  CircleDashed,
  Loader2,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { useAtlas, activePaper } from "@/lib/store";
import { bindingKindLabel } from "@/lib/binding";
import { cn } from "@/lib/cn";
import type { DataBinding } from "@/types";

// Module-level stable sentinel — see LeftSidebar.tsx for the why.
const EMPTY_BINDINGS: DataBinding[] = [];

export function SpinePanel() {
  const paper = useAtlas((s) => activePaper(s));
  const bindings = useAtlas((s) =>
    paper ? s.bindings[paper.id] ?? EMPTY_BINDINGS : EMPTY_BINDINGS,
  );
  const patchBinding = useAtlas((s) => s.patchBinding);
  const removeBinding = useAtlas((s) => s.removeBinding);
  const [checking, setChecking] = useState<string | null>(null);
  const [auto, setAuto] = useState(false);

  async function check(b: DataBinding) {
    setChecking(b.id);
    try {
      const r = await fetch("/api/binding/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: b.url, lastSeenHash: b.lastSeenHash }),
      });
      if (!r.ok) return;
      const data = (await r.json()) as {
        status: DataBinding["status"];
        contentHash?: string | null;
        metadata?: Record<string, unknown>;
        lastCheckedAt?: number;
      };
      patchBinding(b.id, {
        status: data.status,
        lastSeenHash: data.contentHash ?? b.lastSeenHash,
        metadata: data.metadata ?? b.metadata,
        lastCheckedAt: data.lastCheckedAt ?? Date.now(),
      });
      // Sync inline mark on the editor.
      const editor = (window as unknown as { __atlasEditor?: any })
        .__atlasEditor;
      if (editor) {
        editor
          .chain()
          .focus()
          .extendMarkRange("binding", { id: b.id })
          .updateAttributes("binding", { status: data.status })
          .run();
      }
    } finally {
      setChecking(null);
    }
  }

  async function checkAll() {
    for (const b of bindings) {
      await check(b);
    }
  }

  // Optional: auto-check every 5 minutes when toggle is on.
  useEffect(() => {
    if (!auto || bindings.length === 0) return;
    const id = setInterval(() => {
      checkAll();
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, bindings.length]);

  function jumpTo(b: DataBinding) {
    const el = document.querySelector(`[data-binding-id="${b.id}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (el) {
      const orig = (el as HTMLElement).style.boxShadow;
      (el as HTMLElement).style.transition = "box-shadow 0.4s ease";
      (el as HTMLElement).style.boxShadow = "0 0 0 2px var(--accent)";
      setTimeout(() => {
        (el as HTMLElement).style.boxShadow = orig;
      }, 1400);
    }
  }

  function remove(b: DataBinding) {
    if (!confirm("Remove this binding from the spine?")) return;
    removeBinding(b.id);
    const editor = (window as unknown as { __atlasEditor?: any })
      .__atlasEditor;
    if (editor) {
      editor
        .chain()
        .focus()
        .extendMarkRange("binding", { id: b.id })
        .unsetMark("binding")
        .run();
    }
  }

  if (!paper) {
    return (
      <div className="px-2 py-3 text-xs text-subtle">
        Open a paper to see its reproducibility spine.
      </div>
    );
  }

  return (
    <div className="p-2 space-y-2">
      <div className="px-2 py-1.5 text-[10px] uppercase tracking-[0.15em] text-subtle flex items-center justify-between">
        <span>Spine · {bindings.length}</span>
        <div className="flex items-center gap-1">
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={auto}
              onChange={(e) => setAuto(e.target.checked)}
              className="accent-accent size-2.5"
            />
            <span className="text-[9.5px] text-subtle normal-case tracking-normal">
              auto
            </span>
          </label>
          <button
            onClick={checkAll}
            disabled={bindings.length === 0 || checking !== null}
            className="size-5 rounded hover:bg-surface-2 flex items-center justify-center text-subtle hover:text-foreground disabled:opacity-30"
            title="Re-check all bindings now"
          >
            {checking ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <RefreshCw className="size-3" />
            )}
          </button>
        </div>
      </div>

      {bindings.length === 0 ? (
        <div className="px-2 py-3 text-[11.5px] text-subtle leading-relaxed">
          Highlight a sentence with a quantitative claim, hit{" "}
          <span className="text-foreground">Bind</span> in the bubble menu, and
          paste a W&amp;B run / GitHub commit / arXiv ID. Atlas re-checks the
          source on a timer and flags the claim if it goes stale.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {bindings.map((b) => (
            <li key={b.id} className="panel p-2 space-y-1 text-[11px]">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.12em]">
                <StatusPill status={b.status} />
                <span className="text-subtle">{bindingKindLabel(b.kind)}</span>
                <span className="ml-auto text-subtle truncate">
                  {b.lastCheckedAt
                    ? new Date(b.lastCheckedAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "—"}
                </span>
              </div>
              <button
                onClick={() => jumpTo(b)}
                className="text-foreground italic line-clamp-2 cursor-pointer hover:text-accent text-left w-full"
                title="Jump to passage"
              >
                &ldquo;{b.passage}&rdquo;
              </button>
              {b.metadata?.title && (
                <div
                  className="text-[10.5px] text-muted truncate"
                  title={String(b.metadata.title)}
                >
                  {String(b.metadata.title)}
                </div>
              )}
              <a
                href={b.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] font-mono text-subtle hover:text-accent truncate"
              >
                <ExternalLink className="size-2.5 shrink-0" />
                {b.url}
              </a>
              <div className="flex items-center gap-1 pt-0.5">
                <button
                  onClick={() => check(b)}
                  disabled={checking === b.id}
                  className="btn btn-ghost h-6 text-[10.5px]"
                >
                  {checking === b.id ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3" />
                  )}
                  Recheck
                </button>
                <button
                  onClick={() => remove(b)}
                  className="btn btn-ghost h-6 text-[10.5px] ml-auto text-subtle hover:text-danger"
                  aria-label="Remove binding"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: DataBinding["status"] }) {
  if (status === "fresh") {
    return (
      <span className="text-accent flex items-center gap-1">
        <ShieldCheck className="size-2.5" />
        fresh
      </span>
    );
  }
  if (status === "stale") {
    return (
      <span className="text-warning flex items-center gap-1">
        <ShieldAlert className="size-2.5" />
        stale
      </span>
    );
  }
  if (status === "missing") {
    return (
      <span className="text-danger flex items-center gap-1">
        <ShieldAlert className="size-2.5" />
        missing
      </span>
    );
  }
  return (
    <span className="text-subtle flex items-center gap-1">
      <CircleDashed className="size-2.5" />
      unknown
    </span>
  );
}
