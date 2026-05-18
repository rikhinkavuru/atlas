"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code2,
  Minus,
  BookMarked,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useAtlas } from "@/lib/store";

type Item = {
  title: string;
  desc: string;
  icon: React.ReactNode;
  apply: (editor: Editor) => void;
  needsCleanup?: boolean;
  /** When set, slash-menu returns this kind to the host so it can show an
   * inline form instead of running `apply` immediately. */
  inlineForm?: "citation";
};

const items: Item[] = [
  {
    title: "Heading 1",
    desc: "Section title",
    icon: <Heading1 className="size-4" />,
    apply: (e) => e.chain().focus().setHeading({ level: 1 }).run(),
    needsCleanup: true,
  },
  {
    title: "Heading 2",
    desc: "Subsection",
    icon: <Heading2 className="size-4" />,
    apply: (e) => e.chain().focus().setHeading({ level: 2 }).run(),
    needsCleanup: true,
  },
  {
    title: "Heading 3",
    desc: "Sub-subsection",
    icon: <Heading3 className="size-4" />,
    apply: (e) => e.chain().focus().setHeading({ level: 3 }).run(),
    needsCleanup: true,
  },
  {
    title: "Bullet list",
    desc: "Unordered list",
    icon: <List className="size-4" />,
    apply: (e) => e.chain().focus().toggleBulletList().run(),
    needsCleanup: true,
  },
  {
    title: "Numbered list",
    desc: "Ordered list",
    icon: <ListOrdered className="size-4" />,
    apply: (e) => e.chain().focus().toggleOrderedList().run(),
    needsCleanup: true,
  },
  {
    title: "Quote",
    desc: "Block quote",
    icon: <Quote className="size-4" />,
    apply: (e) => e.chain().focus().toggleBlockquote().run(),
    needsCleanup: true,
  },
  {
    title: "Code block",
    desc: "Monospace block",
    icon: <Code2 className="size-4" />,
    apply: (e) => e.chain().focus().toggleCodeBlock().run(),
    needsCleanup: true,
  },
  {
    title: "Divider",
    desc: "Horizontal rule",
    icon: <Minus className="size-4" />,
    apply: (e) => e.chain().focus().setHorizontalRule().run(),
    needsCleanup: true,
  },
  {
    title: "Citation",
    desc: "Inline reference",
    icon: <BookMarked className="size-4" />,
    inlineForm: "citation",
    // apply is unused when inlineForm is set, but a noop keeps the type happy.
    apply: () => {},
    needsCleanup: true,
  },
  {
    title: "Ask the agent",
    desc: "Open the AI agent panel",
    icon: <Sparkles className="size-4" />,
    apply: () => {
      const toggleAgent = useAtlas.getState().toggleAgent;
      if (!useAtlas.getState().agentOpen) toggleAgent();
      window.dispatchEvent(new CustomEvent("atlas:focus-agent"));
    },
    needsCleanup: true,
  },
];

export function SlashMenu({
  x,
  y,
  editor,
  slashFrom,
  onClose,
}: {
  x: number;
  y: number;
  editor: Editor;
  slashFrom: number;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [inlineForm, setInlineForm] = useState<null | "citation">(null);
  const [formKey, setFormKey] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);
  const formInputRef = useRef<HTMLInputElement | null>(null);

  // Watch the editor for typed query characters after the slash.
  useEffect(() => {
    if (inlineForm) return;
    const update = () => {
      const to = editor.state.selection.from;
      if (to < slashFrom) {
        onClose();
        return;
      }
      const text = editor.state.doc.textBetween(slashFrom, to, " ");
      if (text.includes(" ") || text.includes("\n")) {
        onClose();
        return;
      }
      setQuery(text);
    };
    editor.on("selectionUpdate", update);
    editor.on("update", update);
    update();
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("update", update);
    };
  }, [editor, slashFrom, onClose, inlineForm]);

  useEffect(() => {
    if (inlineForm) formInputRef.current?.focus();
  }, [inlineForm]);

  const filtered = items.filter((it) =>
    it.title.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    setActive(0);
  }, [query]);

  // Capture only navigation keys at capture-phase so the editor doesn't see them.
  useEffect(() => {
    if (inlineForm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setActive((a) => Math.min(a + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        const item = filtered[active];
        if (item) runItem(item);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [filtered, active, onClose, inlineForm]);

  function cleanupSlash() {
    const to = editor.state.selection.from;
    editor
      .chain()
      .focus()
      .deleteRange({ from: Math.max(0, slashFrom - 1), to })
      .run();
  }

  function runItem(item: Item) {
    if (item.inlineForm === "citation") {
      // Clean up the slash + query immediately, but stay open and prompt for
      // the citation key and URL inline. Replaces the old window.prompt pair.
      cleanupSlash();
      setInlineForm("citation");
      return;
    }
    if (item.needsCleanup) cleanupSlash();
    item.apply(editor);
    onClose();
  }

  function submitCitation() {
    const key = formKey.trim() || "ref";
    const url = formUrl.trim();
    editor
      .chain()
      .focus()
      .insertContent(
        `<span class="citation" data-key="${escapeAttr(key)}" data-url="${escapeAttr(url)}">[${escapeAttr(key)}]</span> `,
      )
      .run();
    onClose();
  }

  if (inlineForm === "citation") {
    // Clamp x so the 320px-wide citation form doesn't escape the viewport
    // edge when the slash menu was opened near the right side of the editor.
    // Mirrors the BubbleMenu clamping in PaperEditor.
    const clampedX =
      typeof window !== "undefined"
        ? Math.max(8, Math.min(x, window.innerWidth - 328))
        : x;
    return (
      <div
        ref={ref}
        className="fixed z-30 panel shadow-2xl w-80 max-w-[92vw] p-2 rounded-lg overflow-hidden"
        style={{ left: clampedX, top: y }}
      >
        <div className="px-1 pb-2 text-[10px] uppercase tracking-[0.15em] text-subtle flex items-center justify-between">
          <span>Insert citation</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cancel"
            className="h-5 w-5 rounded flex items-center justify-center text-subtle hover:text-foreground hover:bg-surface-2"
          >
            <X className="size-3" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitCitation();
          }}
          className="space-y-1.5"
        >
          <input
            ref={formInputRef}
            value={formKey}
            onChange={(e) => setFormKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              }
            }}
            placeholder="Citation key (e.g., Smith2024)"
            className="w-full bg-background border border-border rounded px-2 h-7 text-[12px] focus:outline-none focus:border-accent"
          />
          <input
            value={formUrl}
            onChange={(e) => setFormUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              }
            }}
            type="url"
            placeholder="URL or DOI (optional)"
            className="w-full bg-background border border-border rounded px-2 h-7 text-[12px] focus:outline-none focus:border-accent"
          />
          <div className="flex items-center justify-end gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={onClose}
              className="h-7 px-2 rounded text-[11px] text-muted hover:text-foreground hover:bg-surface-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-7 px-2 rounded text-[11px] bg-accent text-accent-fg"
            >
              Insert
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="fixed z-30 panel shadow-2xl w-72 p-1 rounded-lg overflow-hidden"
      style={{ left: x, top: y }}
    >
      <div className="px-2 py-1.5 text-[10px] uppercase tracking-[0.15em] text-subtle flex items-center justify-between">
        <span>Blocks</span>
        {query && <span className="font-mono">/{query}</span>}
      </div>
      <div className="max-h-72 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="px-3 py-3 text-xs text-subtle">No matches.</div>
        )}
        {filtered.map((it, i) => (
          <button
            key={it.title}
            type="button"
            onClick={() => runItem(it)}
            onMouseEnter={() => setActive(i)}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left",
              i === active ? "bg-surface-2" : "hover:bg-surface-2",
            )}
          >
            <div className="size-7 rounded border border-border bg-surface flex items-center justify-center text-muted">
              {it.icon}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-foreground truncate">
                {it.title}
              </div>
              <div className="text-[11px] text-subtle truncate">{it.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function escapeAttr(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
