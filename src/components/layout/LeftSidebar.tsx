"use client";

import {
  BookOpenText,
  FileText,
  Folder,
  ListTree,
  Plus,
  Settings2,
  MessageSquare,
  Check,
  Trash2,
  ShieldCheck,
  Network,
  GitFork,
  History,
} from "lucide-react";
import { useAtlas, activePaper } from "@/lib/store";
import { useSettings } from "@/lib/settings";
import { cn } from "@/lib/cn";
import { useEffect, useState } from "react";
import { ProvenanceTimeline } from "./ProvenanceTimeline";
import { SpinePanel } from "./SpinePanel";
import { SessionPanel } from "./SessionPanel";
import type { DataBinding } from "@/types";
import { useCollab } from "../collab/CollabProvider";

// Stable empty-array sentinel so the zustand selector returns the same
// reference whenever bindings[paperId] is undefined. Without this, every
// render allocates a fresh [] and useSyncExternalStore loops forever.
const EMPTY_BINDINGS: DataBinding[] = [];

type Heading = { level: number; text: string; anchor: string };

export function LeftSidebar() {
  const papers = useAtlas((s) => s.papers);
  const newPaper = useAtlas((s) => s.newPaper);
  const openTab = useAtlas((s) => s.openTab);
  const activeTabId = useAtlas((s) => s.activeTabId);
  const tabs = useAtlas((s) => s.tabs);
  const paper = useAtlas((s) => activePaper(s));
  const comments = useAtlas((s) => s.comments);
  const resolveComment = useAtlas((s) => s.resolveComment);
  const deleteComment = useAtlas((s) => s.deleteComment);
  const toggleSettings = useAtlas((s) => s.toggleSettings);
  const [section, setSection] = useState<
    "files" | "outline" | "comments" | "ledger" | "spine" | "session"
  >("outline");
  const ledger = useAtlas((s) =>
    paper ? s.ledgers[paper.id] : undefined,
  );
  const bindings = useAtlas((s) =>
    paper ? s.bindings[paper.id] ?? EMPTY_BINDINGS : EMPTY_BINDINGS,
  );
  const staleCount = bindings.filter(
    (b) => b.status === "stale" || b.status === "missing",
  ).length;
  const editCount = useAtlas((s) =>
    paper ? (s.authorEdits[paper.id]?.length ?? 0) : 0,
  );

  const [outline, setOutline] = useState<Heading[]>([]);
  useEffect(() => {
    setOutline(extractOutline(paper?.html ?? ""));
  }, [paper?.html]);

  // TrustMeter (TopBar) emits this event when the user clicks the chip — we
  // jump to the Ledger tab so the chain timeline is one click from anywhere.
  useEffect(() => {
    const onOpen = () => setSection("ledger");
    window.addEventListener("atlas:open-ledger", onOpen);
    return () => window.removeEventListener("atlas:open-ledger", onOpen);
  }, []);

  const paperComments = comments.filter((c) => c.paperId === paper?.id);
  const unresolved = paperComments.filter((c) => !c.resolved).length;

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-surface flex flex-col">
      <div className="h-9 px-2 flex items-center gap-0.5 border-b border-border">
        <SidebarTab
          active={section === "outline"}
          onClick={() => setSection("outline")}
          icon={<ListTree className="size-3.5" />}
          label="Outline"
        />
        <SidebarTab
          active={section === "files"}
          onClick={() => setSection("files")}
          icon={<Folder className="size-3.5" />}
          label="Files"
        />
        <SidebarTab
          active={section === "comments"}
          onClick={() => setSection("comments")}
          icon={<MessageSquare className="size-3.5" />}
          label="Notes"
          badge={unresolved || undefined}
        />
        <span data-tour="sidebar-ledger" className="contents">
          <SidebarTab
            active={section === "ledger"}
            onClick={() => setSection("ledger")}
            icon={<ShieldCheck className="size-3.5" />}
            label="Ledger"
            badge={ledger?.events.length || undefined}
          />
        </span>
        <SidebarTab
          active={section === "spine"}
          onClick={() => setSection("spine")}
          icon={<GitFork className="size-3.5" />}
          label="Spine"
          badge={staleCount || undefined}
        />
        <SidebarTab
          active={section === "session"}
          onClick={() => setSection("session")}
          icon={<History className="size-3.5" />}
          label="Track changes"
          badge={editCount || undefined}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {section === "outline" && (
          <div className="p-2">
            <div className="px-2 py-1.5 text-[10px] uppercase tracking-[0.15em] text-subtle">
              Document outline
            </div>
            {outline.length === 0 && (
              <div className="px-2 py-3 text-xs text-subtle">
                No headings yet.
              </div>
            )}
            <ul className="space-y-0.5">
              {outline.map((h, i) => (
                <li key={i}>
                  <a
                    href={`#${h.anchor}`}
                    onClick={(e) => {
                      e.preventDefault();
                      const target = document.querySelector(
                        `[data-anchor="${h.anchor}"]`,
                      );
                      target?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    }}
                    className={cn(
                      "block px-2 py-1 rounded text-xs hover:bg-surface-2 text-muted hover:text-foreground truncate",
                      h.level === 1 && "font-medium text-foreground",
                      h.level === 3 && "pl-5 text-subtle",
                      h.level === 2 && "pl-3",
                    )}
                  >
                    {h.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {section === "files" && (
          <div className="p-2">
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-[10px] uppercase tracking-[0.15em] text-subtle">
                Workspace
              </span>
              <button
                onClick={newPaper}
                className="size-5 rounded hover:bg-surface-2 flex items-center justify-center text-subtle hover:text-foreground"
                title="New paper"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
            <ul className="space-y-0.5">
              {Object.values(papers).map((p) => {
                const tab = tabs.find((t) => t.paperId === p.id);
                const active = tab?.id === activeTabId;
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => {
                        if (tab) {
                          useAtlas.getState().setActiveTab(tab.id);
                        } else {
                          openTab({
                            id: `t_${p.id}`,
                            kind: "editor",
                            title: p.title,
                            paperId: p.id,
                          });
                        }
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left",
                        active
                          ? "bg-surface-2 text-foreground"
                          : "text-muted hover:bg-surface-2 hover:text-foreground",
                      )}
                    >
                      <FileText className="size-3.5 shrink-0" />
                      <span className="truncate">{p.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {section === "ledger" && <ProvenanceTimeline />}
        {section === "spine" && <SpinePanel />}
        {section === "session" && <SessionPanel />}

        {section === "comments" && (
          <div className="p-2 space-y-2">
            <div className="px-2 py-1.5 text-[10px] uppercase tracking-[0.15em] text-subtle">
              Comments · {paperComments.length}
            </div>
            {paperComments.length === 0 && (
              <div className="px-2 py-3 text-xs text-subtle leading-relaxed">
                Highlight a passage and click{" "}
                <span className="text-foreground">Comment</span> in the bubble
                menu to leave a note.
              </div>
            )}
            {paperComments.map((c) => (
              <CommentCard key={c.id} comment={c} />
            ))}
          </div>
        )}
      </div>

      <LabFooterChip />
      <div className="border-t border-border p-2 flex items-center gap-2">
        <button
          onClick={() => toggleSettings(true)}
          className="btn btn-ghost h-7 text-[11px] text-muted"
        >
          <Settings2 className="size-3.5" />
          Settings
        </button>
        <div className="ml-auto flex items-center gap-1 text-[10px] text-subtle">
          <BookOpenText className="size-3" />
          <span>
            {Object.keys(papers).length} doc
            {Object.keys(papers).length === 1 ? "" : "s"}
          </span>
        </div>
      </div>
    </aside>
  );
}

function SidebarTab({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  // Icon-only at this sidebar width — labels truncate to garbage at 240px.
  // Native `title` carries the label for keyboard/hover users; aria-label
  // is announced by SR. Badge stays visible as a small overlay.
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "relative flex-1 h-7 min-w-0 rounded flex items-center justify-center transition-colors",
        active
          ? "bg-surface-2 text-foreground"
          : "text-muted hover:text-foreground hover:bg-surface-2",
      )}
    >
      <span className="shrink-0">{icon}</span>
      {badge !== undefined && (
        <span className="absolute -top-0.5 -right-0.5 shrink-0 min-w-[14px] h-[14px] px-1 rounded-full bg-accent text-accent-fg text-[9px] font-mono font-bold flex items-center justify-center pointer-events-none">
          {badge}
        </span>
      )}
    </button>
  );
}

function LabFooterChip() {
  const lab = useSettings((s) => s.lab);
  const toggleSettings = useAtlas((s) => s.toggleSettings);
  if (!lab) {
    return (
      <button
        onClick={() => toggleSettings(true)}
        className="border-t border-border p-2 flex items-center gap-2 text-[10.5px] text-subtle hover:text-foreground hover:bg-surface-2/50 transition-colors"
        title="Open Settings → Lab graph"
      >
        <Network className="size-3 text-subtle" />
        <span>No lab attached</span>
        <span className="ml-auto text-accent">Set up →</span>
      </button>
    );
  }
  return (
    <button
      onClick={() => toggleSettings(true)}
      className="border-t border-border p-2 flex items-center gap-2 hover:bg-surface-2/50 transition-colors text-left"
      title="Manage in Settings → Lab graph"
    >
      <span className="size-6 rounded bg-accent-soft border border-[#2d3d12] flex items-center justify-center text-accent shrink-0">
        <Network className="size-3" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11.5px] font-medium text-foreground truncate">
          {lab.name}
        </div>
        <div className="text-[9.5px] font-mono text-subtle">
          {lab.members.length} member{lab.members.length === 1 ? "" : "s"} ·{" "}
          {lab.rules.length} rule{lab.rules.length === 1 ? "" : "s"}
        </div>
      </div>
    </button>
  );
}

function CommentCard({ comment: c }: { comment: import("@/lib/store").Comment }) {
  const resolveComment = useAtlas((s) => s.resolveComment);
  const deleteComment = useAtlas((s) => s.deleteComment);
  const addCommentReply = useAtlas((s) => s.addCommentReply);
  const deleteCommentReply = useAtlas((s) => s.deleteCommentReply);
  const authorName = useSettings((s) => s.authorName);
  const authorOrcid = useSettings((s) => s.authorOrcid);
  const collab = useCollab();
  const [reply, setReply] = useState("");
  const [showReplyForm, setShowReplyForm] = useState(false);
  const replies = c.replies ?? [];

  function postReply() {
    const text = reply.trim();
    if (!text) return;
    // Stamp the author from settings (or the collab self-user when
    // collab is on) so replies carry the same identity as ledger events.
    const name =
      authorName.trim() ||
      (collab.enabled ? collab.selfUser.name : "You");
    addCommentReply(c.id, {
      id: `cr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      authorName: name,
      authorOrcid: authorOrcid || undefined,
      text,
      createdAt: Date.now(),
    });
    setReply("");
    setShowReplyForm(false);
  }

  return (
    <div
      className={cn(
        "panel p-2.5 text-[11.5px] space-y-1.5",
        c.resolved && "opacity-55",
      )}
    >
      <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-subtle flex items-center gap-1.5">
        <span>
          {new Date(c.createdAt).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
        {c.resolved && <span className="text-accent">resolved</span>}
        {replies.length > 0 && (
          <span className="ml-auto text-subtle">
            {replies.length} {replies.length === 1 ? "reply" : "replies"}
          </span>
        )}
      </div>
      <div
        onClick={() => {
          const el = document.querySelector(`[data-comment-id="${c.id}"]`);
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
        }}
        className="text-muted italic line-clamp-2 cursor-pointer hover:text-foreground"
        title="Jump to passage"
      >
        &ldquo;{c.quote}&rdquo;
      </div>
      <div className="text-foreground leading-relaxed">{c.text}</div>

      {replies.length > 0 && (
        <ul className="space-y-1 pl-2 border-l-2 border-border">
          {replies.map((r) => (
            <li key={r.id} className="text-[11px] leading-relaxed">
              <div className="text-[9.5px] font-mono uppercase tracking-[0.12em] text-subtle flex items-center gap-1.5">
                <span className="text-foreground">{r.authorName}</span>
                {r.authorOrcid && (
                  <a
                    href={`https://orcid.org/${r.authorOrcid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent normal-case tracking-normal"
                  >
                    iD {r.authorOrcid.slice(-4)}
                  </a>
                )}
                <span className="ml-auto">
                  {new Date(r.createdAt).toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
                <button
                  onClick={() => deleteCommentReply(c.id, r.id)}
                  aria-label="Delete reply"
                  className="text-subtle hover:text-danger"
                >
                  <Trash2 className="size-2.5" />
                </button>
              </div>
              <div className="text-foreground/90">{r.text}</div>
            </li>
          ))}
        </ul>
      )}

      {showReplyForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            postReply();
          }}
          className="space-y-1"
        >
          <textarea
            autoFocus
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setShowReplyForm(false);
                setReply("");
              } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                postReply();
              }
            }}
            placeholder="Reply…"
            rows={2}
            className="w-full bg-background border border-border rounded px-2 py-1 text-[12px] focus:outline-none focus:border-accent resize-none"
          />
          <div className="flex items-center gap-1 justify-end text-[10.5px] text-subtle font-mono">
            <span className="mr-auto">
              <span className="kbd">⌘</span>
              <span className="kbd">↵</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setShowReplyForm(false);
                setReply("");
              }}
              className="h-6 px-2 rounded text-muted hover:text-foreground hover:bg-surface-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!reply.trim()}
              className="h-6 px-2 rounded bg-accent text-accent-fg disabled:opacity-40 text-[10.5px]"
            >
              Reply
            </button>
          </div>
        </form>
      )}

      <div className="flex items-center gap-1 pt-1">
        <button
          onClick={() => resolveComment(c.id)}
          className="btn btn-ghost h-6 text-[10.5px] text-muted"
        >
          <Check className="size-3" />
          {c.resolved ? "Reopen" : "Resolve"}
        </button>
        {!showReplyForm && (
          <button
            onClick={() => setShowReplyForm(true)}
            className="btn btn-ghost h-6 text-[10.5px] text-muted"
          >
            <MessageSquare className="size-3" />
            Reply
          </button>
        )}
        <button
          onClick={() => deleteComment(c.id)}
          className="btn btn-ghost h-6 text-[10.5px] text-muted ml-auto"
          aria-label="Delete comment"
        >
          <Trash2 className="size-3" />
        </button>
      </div>
    </div>
  );
}

function extractOutline(html: string): Heading[] {
  if (typeof window === "undefined") return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  const headings = Array.from(doc.querySelectorAll("h1, h2, h3"));
  return headings.map((h, i) => ({
    level: parseInt(h.tagName.slice(1), 10),
    text: h.textContent || "",
    anchor: `h-${i}`,
  }));
}
