"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import Typography from "@tiptap/extension-typography";
import CharacterCount from "@tiptap/extension-character-count";
import Image from "@tiptap/extension-image";
import {
  TableKit,
} from "@tiptap/extension-table";
import {
  Bold,
  Italic,
  Highlighter,
  Quote,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Link as LinkIcon,
  Sparkles,
  MessageSquarePlus,
  GitFork,
  X,
} from "lucide-react";
import { Citation, CommentMark, BindingMark, ProvenanceMark } from "./extensions";
import { BlockProvenance } from "./block-provenance";
import { InlineMath, BlockMath } from "./math";
import { MathInputRules } from "./math-input-rules";
import { Figure } from "./figure";
import { TableCaption } from "./table-caption";
import { XRef } from "./xref";
import { HeadingLabels } from "./heading-labels";
import { SectionNumbers } from "./section-numbers";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import "katex/dist/katex.min.css";
import { createBinding } from "@/lib/binding";
import { useAtlas } from "@/lib/store";
import { useSettings } from "@/lib/settings";
import { cn } from "@/lib/cn";
import { useCollab } from "../collab/CollabProvider";

// Last-seen char count per paper. Drives the wordsDelta/charsDelta in author
// edit log entries — diffing the current paper against the previous keystroke
// gives us a cheap "this commit was +N chars" signal without instrumenting
// every change descriptor through Tiptap.
//
// IMPORTANT: must be seeded with the paper's current state when the editor
// mounts, BEFORE any onUpdate fires. Otherwise the first edit on an opened
// paper logs +<entire-doc-length> as the delta. seedLastSeen() handles this.
const lastSeen = new Map<string, { chars: number; words: number; html: string }>();

function seedLastSeen(paperId: string, html: string) {
  if (lastSeen.has(paperId)) return;
  lastSeen.set(paperId, { ...plainTextLen(html), html });
}

function plainTextLen(html: string): { chars: number; words: number } {
  if (typeof window === "undefined") return { chars: 0, words: 0 };
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  const text = (tmp.textContent ?? "").trim();
  return {
    chars: text.length,
    words: text.length === 0 ? 0 : text.split(/\s+/).length,
  };
}

function recordEditPulse(
  paperId: string,
  html: string,
  actor: { id: string; label: string },
) {
  const stats = plainTextLen(html);
  const prev = lastSeen.get(paperId) ?? { chars: 0, words: 0, html: "" };
  // Skip if nothing materially changed — Tiptap fires onUpdate even on
  // selection-only changes occasionally.
  if (stats.chars === prev.chars && stats.words === prev.words) return;
  const wordsDelta = stats.words - prev.words;
  const charsDelta = stats.chars - prev.chars;
  // Ignore tiny pure-whitespace fluctuations (paste/cleanup) — they're noise.
  if (Math.abs(charsDelta) < 1 && Math.abs(wordsDelta) === 0) {
    lastSeen.set(paperId, { ...stats, html });
    return;
  }
  useAtlas.getState().recordAuthorEdit({
    id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    paperId,
    timestamp: Date.now(),
    actorId: actor.id,
    actorLabel: actor.label,
    wordsDelta,
    charsDelta,
    snippet: html.slice(0, 200).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
  });
  lastSeen.set(paperId, { ...stats, html });
}
import type { Tab } from "@/types";
import { SlashMenu } from "./SlashMenu";
import { XRefAutocomplete, type XRefAutoState } from "./XRefAutocomplete";

export function PaperEditor({ tab }: { tab: Tab }) {
  const paper = useAtlas((s) =>
    tab.paperId ? s.papers[tab.paperId] : null,
  );
  const updatePaper = useAtlas((s) => s.updatePaper);
  const setSelection = useAtlas((s) => s.setSelection);
  const showBlockProvenance = useSettings((s) => s.showBlockProvenance);
  const showSectionNumbers = useSettings((s) => s.showSectionNumbers);
  const collab = useCollab();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [bubble, setBubble] = useState<{
    x: number;
    y: number;
    show: boolean;
  }>({ x: 0, y: 0, show: false });
  const [slash, setSlash] = useState<{
    x: number;
    y: number;
    show: boolean;
    from: number;
    /** Optional: pre-open the slash menu directly into an inline form. */
    initialForm?: "math" | "citation";
  } | null>(null);
  const [xrefAuto, setXRefAuto] = useState<XRefAutoState | null>(null);

  // When collab is on, StarterKit's `history` must be off — Yjs ships its
  // own undo/redo manager that's CRDT-aware. Loading both produces dueling
  // histories and breaks redo across peers.
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
        // StarterKit's built-in undoRedo conflicts with Yjs's CRDT-aware
        // history when collab is on — disable it so peers don't desync.
        ...(collab.enabled ? { undoRedo: false as const } : {}),
      }),
      Placeholder.configure({
        placeholder: "Start drafting. Press / for blocks, ⌘L for the agent.",
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Highlight,
      Typography,
      CharacterCount,
      Image,
      TableKit.configure({ table: { resizable: true } }),
      Citation,
      CommentMark,
      BindingMark,
      ProvenanceMark,
      BlockProvenance,
      InlineMath,
      BlockMath,
      Figure,
      TableCaption,
      XRef,
      HeadingLabels,
      SectionNumbers,
      // Markdown-style math input rules: $$...$$ → block, $...$ → inline.
      // Fires when the user types the closing delimiter.
      MathInputRules,
      // Collaboration extensions are added only when a Yjs document is
      // available (a Liveblocks room is open). The Collaboration extension
      // takes over content management — the `content` prop is ignored when
      // it's present — so we have to seed the document from the local paper
      // on first connect; see the useEffect further below.
      ...(collab.enabled && collab.yDoc
        ? [
            Collaboration.configure({ document: collab.yDoc }),
            ...(collab.yProvider
              ? [
                  CollaborationCursor.configure({
                    provider: collab.yProvider,
                    user: {
                      name: collab.selfUser.name,
                      color: collab.selfUser.color,
                    },
                  }),
                ]
              : []),
          ]
        : []),
    ],
    // Only set initial content when collab is off — when collab is on the
    // content gets seeded from the Yjs document, and providing `content`
    // here would race with the Liveblocks sync.
    content: collab.enabled ? "" : (paper?.html ?? ""),
    editorProps: {
      attributes: {
        class: cn(
          "tiptap",
          !showBlockProvenance && "no-block-prov",
          showSectionNumbers && "show-section-numbers",
        ),
      },
      handleKeyDown(view, event) {
        if (event.key === "/") {
          const from = view.state.selection.from + 1;
          // Defer to next tick so coords are accurate after the "/" lands.
          requestAnimationFrame(() => {
            const coords = view.coordsAtPos(view.state.selection.from);
            setSlash({
              x: coords.left,
              y: coords.bottom + 6,
              show: true,
              from,
            });
          });
        } else if (event.key === "{") {
          // Check whether the user just completed a `\ref{` / `\autoref{` /
          // `\cref{` trigger. We look at the 10 chars before the cursor
          // — that's enough for `\autoref{` (9 chars) plus one extra
          // position so we can detect a leading backslash that would mark
          // the sequence as escaped (e.g. `\\ref{` is a literal `\ref{` in
          // the author's prose, not an actual trigger).
          requestAnimationFrame(() => {
            const sel = view.state.selection;
            const cursor = sel.from;
            const start = Math.max(0, cursor - 10);
            const lookback = view.state.doc.textBetween(start, cursor, " ", " ");
            const match = /\\(?:auto)?ref\{$|\\cref\{$/.exec(lookback);
            if (!match) return;
            // Suppress when the trigger is preceded by another backslash
            // (escaped). Negative lookbehind isn't always supported across
            // all engines we'd want to ship to, so check explicitly.
            const triggerStartIndexInLookback =
              lookback.length - match[0].length;
            if (
              triggerStartIndexInLookback > 0 &&
              lookback.charAt(triggerStartIndexInLookback - 1) === "\\"
            ) {
              return;
            }
            const triggerLength = match[0].length;
            const coords = view.coordsAtPos(cursor);
            setXRefAuto({
              from: cursor,
              x: coords.left,
              y: coords.bottom + 6,
              triggerLength,
            });
          });
        } else if (event.key === "Escape") {
          setSlash(null);
          setXRefAuto(null);
        }
        return false;
      },
    },
    onUpdate({ editor }) {
      if (!tab.paperId) return;
      const html = editor.getHTML();
      updatePaper(tab.paperId, html);
      // Track-changes pulse — coalesced server-side via recordAuthorEdit so
      // typing a sentence becomes one log entry, not one per keystroke.
      // Actor identity comes from the collab provider when collab is on,
      // so a remote peer's edits land in the log with their own actorId.
      // Single-author mode logs everything as "self / You".
      const actor = collab.enabled
        ? { id: collab.selfUser.id, label: collab.selfUser.name }
        : { id: "self", label: "You" };
      recordEditPulse(tab.paperId, html, actor);
    },
    onSelectionUpdate({ editor }) {
      const { from, to, empty } = editor.state.selection;
      if (empty) {
        setBubble((b) => ({ ...b, show: false }));
        setSelection(null);
        return;
      }
      const text = editor.state.doc.textBetween(from, to, "\n");
      setSelection({ text, from, to });
      const view = editor.view;
      const start = view.coordsAtPos(from);
      const end = view.coordsAtPos(to);
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = (start.left + end.right) / 2 - rect.left;
      const y = start.top - rect.top - 44;
      setBubble({ x, y, show: true });
    },
  });

  // Expose editor on window for agent panel to insert proposals
  useEffect(() => {
    if (!editor) return;
    (window as unknown as { __atlasEditor: typeof editor }).__atlasEditor =
      editor;
    return () => {
      delete (window as unknown as { __atlasEditor?: typeof editor }).__atlasEditor;
    };
  }, [editor]);

  // Seed the per-paper baseline for the track-changes pulse the moment we
  // know which paper this editor instance is for. Without this, the first
  // keystroke on an opened paper would record a delta equal to the full
  // document length.
  useEffect(() => {
    if (tab.paperId && paper) {
      seedLastSeen(tab.paperId, paper.html);
    }
  }, [tab.paperId, paper]);

  // First-connect content seeding for collab. The Yjs document starts empty
  // when a brand-new room is opened. We need to push the local paper into
  // it once the provider has synced (so we don't clobber existing content
  // from other peers who joined first). The yProvider emits a "synced"
  // event the moment the initial state is in hand — that's our cue.
  useEffect(() => {
    if (!editor || !collab.enabled || !collab.yProvider || !paper) return;
    const onSynced = () => {
      const fragment = collab.yDoc?.getXmlFragment("default");
      const isEmpty = !fragment || fragment.length === 0;
      // Only seed when the room genuinely has no content yet. Otherwise we
      // would race with other peers and duplicate their work.
      if (isEmpty) {
        editor.commands.setContent(paper.html, { emitUpdate: false });
      }
    };
    collab.yProvider.on("synced", onSynced);
    return () => {
      collab.yProvider?.off("synced", onSynced);
    };
  }, [editor, collab.enabled, collab.yProvider, collab.yDoc, paper]);

  // Command palette → math: open the slash menu's math form at the cursor.
  useEffect(() => {
    if (!editor) return;
    const onMath = () => {
      const view = editor.view;
      const from = view.state.selection.from;
      try {
        const coords = view.coordsAtPos(from);
        setSlash({
          x: coords.left,
          y: coords.bottom + 6,
          show: true,
          from,
          initialForm: "math",
        });
      } catch {
        /* selection out of view — open at viewport top-left */
        setSlash({
          x: 120,
          y: 120,
          show: true,
          from,
          initialForm: "math",
        });
      }
    };
    window.addEventListener("atlas:open-math-insert", onMath);
    return () => window.removeEventListener("atlas:open-math-insert", onMath);
  }, [editor]);

  // editorProps.attributes is a snapshot at mount — when the user toggles
  // block-provenance visibility we mirror the class directly on the editor DOM.
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;
    dom.classList.toggle("no-block-prov", !showBlockProvenance);
    dom.classList.toggle("show-section-numbers", showSectionNumbers);
  }, [editor, showBlockProvenance, showSectionNumbers]);

  // Tag headings with anchor ids for outline scroll
  useEffect(() => {
    if (!editor) return;
    const tag = () => {
      const dom = editor.view.dom as HTMLElement;
      dom.querySelectorAll("h1, h2, h3").forEach((h, i) => {
        h.setAttribute("data-anchor", `h-${i}`);
      });
    };
    tag();
    editor.on("update", tag);
    return () => {
      editor.off("update", tag);
    };
  }, [editor]);

  if (!paper) {
    return (
      <div className="flex-1 flex items-center justify-center text-subtle">
        Paper not found.
      </div>
    );
  }

  const wordCount = editor?.storage.characterCount?.words?.() ?? 0;
  const charCount = editor?.storage.characterCount?.characters?.() ?? 0;

  return (
    <div ref={containerRef} className="flex-1 min-h-0 relative overflow-hidden">
      {/* Doc header */}
      <div className="absolute top-0 left-0 right-0 z-10 px-8 py-3 bg-gradient-to-b from-background to-transparent pointer-events-none">
        <div className="max-w-[760px] mx-auto flex items-center justify-between text-[11px] text-subtle">
          <span className="font-mono uppercase tracking-[0.18em]">
            {paper.title}
          </span>
          <span className="font-mono">
            {wordCount} words · {charCount} chars
          </span>
        </div>
      </div>

      <div className="h-full overflow-y-auto">
        <EditorContent editor={editor} />
      </div>

      {bubble.show && editor && (
        <BubbleMenuPopover
          x={bubble.x}
          y={bubble.y}
          editor={editor}
          paperId={paper.id}
        />
      )}

      {slash?.show && editor && (
        <SlashMenu
          x={slash.x}
          y={slash.y}
          editor={editor}
          slashFrom={slash.from}
          initialForm={slash.initialForm}
          onClose={() => setSlash(null)}
        />
      )}

      {xrefAuto && editor && (
        <XRefAutocomplete
          editor={editor}
          state={xrefAuto}
          onClose={() => setXRefAuto(null)}
        />
      )}
    </div>
  );
}

type InlineForm =
  | { kind: "comment"; from: number; to: number }
  | { kind: "binding"; from: number; to: number }
  | { kind: "link" }
  | null;

function BubbleMenuPopover({
  x,
  y,
  editor,
  paperId,
}: {
  x: number;
  y: number;
  editor: ReturnType<typeof useEditor>;
  paperId: string;
}) {
  const [form, setForm] = useState<InlineForm>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (form) inputRef.current?.focus();
  }, [form]);

  if (!editor) return null;
  const toggleAgent = useAtlas.getState().toggleAgent;

  function openComment() {
    const { from, to, empty } = editor!.state.selection;
    if (empty) return;
    setForm({ kind: "comment", from, to });
  }

  function openBinding() {
    const { from, to, empty } = editor!.state.selection;
    if (empty) return;
    setForm({ kind: "binding", from, to });
  }

  function submitForm(value: string) {
    if (!form || !value.trim()) {
      setForm(null);
      return;
    }
    const trimmed = value.trim();
    if (form.kind === "comment") {
      const quote = editor!.state.doc.textBetween(form.from, form.to, " ");
      const id = `c_${Date.now()}`;
      editor!
        .chain()
        .focus()
        .setTextSelection({ from: form.from, to: form.to })
        .setMark("comment", { id })
        .run();
      useAtlas.getState().addComment({
        id,
        paperId,
        quote,
        text: trimmed,
        createdAt: Date.now(),
        resolved: false,
      });
    } else if (form.kind === "binding") {
      const passage = editor!.state.doc.textBetween(form.from, form.to, " ");
      const binding = createBinding({ paperId, passage, url: trimmed });
      editor!
        .chain()
        .focus()
        .setTextSelection({ from: form.from, to: form.to })
        .setMark("binding", {
          id: binding.id,
          url: binding.url,
          kind: binding.kind,
          status: "unknown",
        })
        .run();
      useAtlas.getState().addBinding(binding);
      fetch("/api/binding/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: binding.url }),
      })
        .then(async (r) => {
          if (!r.ok) return;
          const data = (await r.json()) as {
            status: "fresh" | "stale" | "missing" | "unknown";
            contentHash?: string | null;
            metadata?: Record<string, unknown>;
            lastCheckedAt?: number;
          };
          useAtlas.getState().patchBinding(binding.id, {
            status: data.status,
            lastSeenHash: data.contentHash ?? undefined,
            metadata: data.metadata ?? undefined,
            lastCheckedAt: data.lastCheckedAt ?? Date.now(),
          });
          const editor2 = (window as unknown as { __atlasEditor?: typeof editor })
            .__atlasEditor;
          editor2
            ?.chain()
            .focus()
            .extendMarkRange("binding", { id: binding.id })
            .updateAttributes("binding", { status: data.status })
            .run();
        })
        .catch(() => {});
    } else if (form.kind === "link") {
      editor!.chain().focus().setLink({ href: trimmed }).run();
    }
    setForm(null);
  }

  // Context-aware: hide block-transform buttons (heading/list/quote) when the
  // selection isn't a block-suitable range. Keep them when selection spans a
  // paragraph or is a heading already.
  const inHeading = editor.isActive("heading");
  const inList =
    editor.isActive("bulletList") || editor.isActive("orderedList");

  // Clamp bubble x so the menu doesn't escape the right or left edge of the
  // viewport — the menu is centered via translate-x-1/2, so we leave room for
  // ~half of its expected width on either side.
  const clampedX =
    typeof window !== "undefined"
      ? Math.max(180, Math.min(x, window.innerWidth - 180))
      : x;
  return (
    <div
      className="absolute z-20 -translate-x-1/2 panel shadow-xl rounded-lg p-1"
      style={{ left: clampedX, top: Math.max(y, 8) }}
    >
      {form ? (
        <InlineFormRow
          kind={form.kind}
          inputRef={inputRef}
          onSubmit={submitForm}
          onCancel={() => setForm(null)}
        />
      ) : (
        <div className="flex items-center gap-0.5">
          <BubbleBtn
            label="Bold"
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="size-3.5" />
          </BubbleBtn>
          <BubbleBtn
            label="Italic"
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="size-3.5" />
          </BubbleBtn>
          <BubbleBtn
            label="Highlight"
            active={editor.isActive("highlight")}
            onClick={() => editor.chain().focus().toggleHighlight().run()}
          >
            <Highlighter className="size-3.5" />
          </BubbleBtn>
          <span className="w-px h-4 bg-border mx-0.5" />
          {!inList && (
            <>
              <BubbleBtn
                label="Heading 1"
                active={editor.isActive("heading", { level: 1 })}
                onClick={() =>
                  editor.chain().focus().toggleHeading({ level: 1 }).run()
                }
              >
                <Heading1 className="size-3.5" />
              </BubbleBtn>
              <BubbleBtn
                label="Heading 2"
                active={editor.isActive("heading", { level: 2 })}
                onClick={() =>
                  editor.chain().focus().toggleHeading({ level: 2 }).run()
                }
              >
                <Heading2 className="size-3.5" />
              </BubbleBtn>
            </>
          )}
          {!inHeading && (
            <BubbleBtn
              label="Block quote"
              active={editor.isActive("blockquote")}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
            >
              <Quote className="size-3.5" />
            </BubbleBtn>
          )}
          {!inHeading && (
            <>
              <BubbleBtn
                label="Bullet list"
                active={editor.isActive("bulletList")}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
              >
                <List className="size-3.5" />
              </BubbleBtn>
              <BubbleBtn
                label="Numbered list"
                active={editor.isActive("orderedList")}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
              >
                <ListOrdered className="size-3.5" />
              </BubbleBtn>
            </>
          )}
          <BubbleBtn
            label="Insert link"
            onClick={() => setForm({ kind: "link" })}
          >
            <LinkIcon className="size-3.5" />
          </BubbleBtn>
          <span className="w-px h-4 bg-border mx-0.5" />
          <button
            type="button"
            onClick={() => {
              if (!useAtlas.getState().agentOpen) toggleAgent();
              window.dispatchEvent(new CustomEvent("atlas:focus-agent"));
            }}
            className="h-7 px-2 rounded text-[11px] inline-flex items-center gap-1.5 bg-accent text-accent-fg hover:bg-[var(--accent-hover)]"
          >
            <Sparkles className="size-3.5" />
            Ask Atlas
          </button>
          <button
            type="button"
            onClick={openComment}
            className="h-7 px-2 rounded text-[11px] inline-flex items-center gap-1.5 hover:bg-surface-2 text-muted"
          >
            <MessageSquarePlus className="size-3.5" />
            Comment
          </button>
          <button
            type="button"
            onClick={openBinding}
            className="h-7 px-2 rounded text-[11px] inline-flex items-center gap-1.5 hover:bg-surface-2 text-muted"
            title="Bind this passage to a W&B run, GitHub commit, arXiv ID, or any URL"
          >
            <GitFork className="size-3.5" />
            Bind
          </button>
        </div>
      )}
    </div>
  );
}

function InlineFormRow({
  kind,
  inputRef,
  onSubmit,
  onCancel,
}: {
  kind: "comment" | "binding" | "link";
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const placeholder =
    kind === "comment"
      ? "Add a comment about this passage…"
      : kind === "binding"
        ? "Paste a URL (W&B run, GitHub commit, arXiv abs, Jupyter…)"
        : "Paste a URL…";
  const label =
    kind === "comment"
      ? "Comment"
      : kind === "binding"
        ? "Binding URL"
        : "Link URL";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value);
      }}
      className="flex items-center gap-1.5 w-[min(85vw,360px)] sm:min-w-[320px] px-1"
    >
      <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-subtle pr-1 shrink-0">
        {label}
      </span>
      <input
        ref={inputRef}
        type={kind === "comment" ? "text" : "url"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        placeholder={placeholder}
        className="flex-1 bg-background border border-border rounded px-2 h-7 text-[12px] focus:outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={!value.trim()}
        className="h-7 px-2 rounded text-[11px] bg-accent text-accent-fg disabled:opacity-40"
      >
        Done
      </button>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel"
        className="h-7 w-7 rounded flex items-center justify-center text-subtle hover:text-foreground hover:bg-surface-2"
      >
        <X className="size-3.5" />
      </button>
    </form>
  );
}

function BubbleBtn({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "h-7 w-7 rounded flex items-center justify-center transition-colors",
        active
          ? "bg-accent-soft text-accent border border-[#2d3d12]"
          : "text-muted hover:text-foreground hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}
