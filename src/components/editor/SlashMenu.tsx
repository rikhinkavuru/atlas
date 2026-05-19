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
  Sigma,
  Image as ImageIcon,
  Table as TableIcon,
  Link2,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useAtlas } from "@/lib/store";
import { collectXRefTargets } from "./xref";
import katex from "katex";

type Item = {
  title: string;
  desc: string;
  icon: React.ReactNode;
  apply: (editor: Editor) => void;
  needsCleanup?: boolean;
  /** When set, slash-menu returns this kind to the host so it can show an
   * inline form instead of running `apply` immediately. */
  inlineForm?: "citation" | "math" | "figure" | "xref" | "captioned-table";
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
    title: "Math equation",
    desc: "Inline or display LaTeX",
    icon: <Sigma className="size-4" />,
    inlineForm: "math",
    apply: () => {},
    needsCleanup: true,
  },
  {
    title: "Figure",
    desc: "Image with caption + auto-numbered Figure N.",
    icon: <ImageIcon className="size-4" />,
    inlineForm: "figure",
    apply: () => {},
    needsCleanup: true,
  },
  {
    title: "Captioned table",
    desc: "3×3 table with auto-numbered Table N. caption",
    icon: <TableIcon className="size-4" />,
    inlineForm: "captioned-table",
    apply: () => {},
    needsCleanup: true,
  },
  {
    title: "Cross-reference",
    desc: "Refer to a numbered Figure or Table",
    icon: <Link2 className="size-4" />,
    inlineForm: "xref",
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
  initialForm,
}: {
  x: number;
  y: number;
  editor: Editor;
  slashFrom: number;
  onClose: () => void;
  initialForm?: "math" | "citation";
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [inlineForm, setInlineForm] = useState<
    null | "citation" | "math" | "figure" | "xref" | "captioned-table"
  >(initialForm ?? null);
  const [figSrc, setFigSrc] = useState("");
  const [figCaption, setFigCaption] = useState("");
  const [figLabel, setFigLabel] = useState("");
  const [tableCaption, setTableCaption] = useState("");
  const [tableLabel, setTableLabel] = useState("");
  const [xrefTarget, setXrefTarget] = useState("");
  const [formKey, setFormKey] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [mathTex, setMathTex] = useState("");
  const [mathKind, setMathKind] = useState<"inline" | "display">("display");
  const [mathLabel, setMathLabel] = useState("");
  const mathPreviewRef = useRef<HTMLSpanElement | null>(null);
  const [citeVerifyStatus, setCiteVerifyStatus] = useState<
    "idle" | "checking" | "ok" | "unresolved" | "error"
  >("idle");
  const [citeVerifyMsg, setCiteVerifyMsg] = useState<string>("");
  const [citeCandidate, setCiteCandidate] = useState<
    import("@/types").CitationCandidate | null
  >(null);
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
    if (item.inlineForm === "math") {
      cleanupSlash();
      setInlineForm("math");
      return;
    }
    if (item.inlineForm === "figure") {
      cleanupSlash();
      setInlineForm("figure");
      return;
    }
    if (item.inlineForm === "captioned-table") {
      cleanupSlash();
      setInlineForm("captioned-table");
      return;
    }
    if (item.inlineForm === "xref") {
      cleanupSlash();
      setInlineForm("xref");
      return;
    }
    if (item.needsCleanup) cleanupSlash();
    item.apply(editor);
    onClose();
  }

  function submitCaptionedTable() {
    const caption = tableCaption.trim();
    if (!caption) {
      onClose();
      return;
    }
    editor.commands.insertCaptionedTable(caption, tableLabel.trim() || undefined);
    onClose();
  }

  function submitXRef() {
    const target = xrefTarget.trim();
    if (!target) {
      onClose();
      return;
    }
    editor.commands.insertXRef(target);
    onClose();
  }

  // List of labeled targets in the document — used by the xref picker so
  // users can pick from an existing label rather than retyping it from
  // memory and risking a dead link.
  const xrefCandidates =
    inlineForm === "xref" ? collectXRefTargets(editor.state.doc) : [];

  function submitFigure() {
    const src = figSrc.trim();
    const caption = figCaption.trim();
    if (!src || !caption) {
      onClose();
      return;
    }
    editor.commands.insertFigure({
      src,
      caption,
      label: figLabel.trim() || undefined,
    });
    onClose();
  }

  function submitMath() {
    const tex = mathTex.trim();
    if (!tex) {
      onClose();
      return;
    }
    const label = mathLabel.trim();
    editor
      .chain()
      .focus()
      .insertContent({
        type: mathKind === "inline" ? "inlineMath" : "blockMath",
        attrs:
          mathKind === "display"
            ? { tex, label: label || "" }
            : { tex },
      })
      .run();
    onClose();
  }

  // Live preview as the user types LaTeX. KaTeX swallows errors silently with
  // throwOnError:false so a half-typed `\frac{` doesn't blow up the form.
  useEffect(() => {
    if (inlineForm !== "math" || !mathPreviewRef.current) return;
    try {
      katex.render(mathTex || "\\text{Preview appears here}", mathPreviewRef.current, {
        displayMode: mathKind === "display",
        throwOnError: false,
        errorColor: "var(--color-danger, #f88)",
        strict: "ignore",
        output: "html",
      });
    } catch {
      if (mathPreviewRef.current) mathPreviewRef.current.textContent = mathTex;
    }
  }, [mathTex, mathKind, inlineForm]);

  // Verify the URL/DOI against /api/verify-citation. Same UX as
  // NavDialogs.CitationDialog — verification is non-blocking (researchers
  // need to cite in-progress refs sometimes), but the resulting chip carries
  // data-verified so downstream UI knows the citation's trust state.
  async function verifyCitation() {
    const q = formUrl.trim() || formKey.trim();
    if (!q) {
      setCiteVerifyStatus("idle");
      return;
    }
    setCiteVerifyStatus("checking");
    setCiteVerifyMsg("");
    try {
      const r = await fetch("/api/verify-citation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      if (!r.ok) {
        setCiteVerifyStatus("error");
        setCiteVerifyMsg(`verifier returned ${r.status}`);
        return;
      }
      const data = (await r.json()) as {
        resolved: boolean;
        best?: import("@/types").CitationCandidate | null;
        warning?: string;
      };
      if (data.resolved && data.best) {
        setCiteVerifyStatus("ok");
        setCiteVerifyMsg(
          `${(data.best.title ?? "Matched").slice(0, 80)} · via ${data.best.source}`,
        );
        setCiteCandidate(data.best);
      } else {
        setCiteVerifyStatus("unresolved");
        setCiteVerifyMsg(
          data.warning ?? "No high-confidence match in any registry.",
        );
        setCiteCandidate(null);
      }
    } catch (e) {
      setCiteVerifyStatus("error");
      setCiteVerifyMsg(e instanceof Error ? e.message : String(e));
      setCiteCandidate(null);
    }
  }

  function submitCitation() {
    const key = formKey.trim() || "ref";
    const url = formUrl.trim();
    const verified = citeVerifyStatus === "ok";
    editor
      .chain()
      .focus()
      .insertContent(
        `<span class="citation" data-key="${escapeAttr(key)}" data-url="${escapeAttr(url)}" data-verified="${verified ? "1" : "0"}">[${escapeAttr(key)}]</span> `,
      )
      .run();
    // Register what we know in the citation registry so the References
    // generator can format this citation properly. When the verifier
    // resolved a candidate we get full metadata (title / authors / year);
    // otherwise we register a minimal stub the user can later enrich via
    // the "Enrich missing" button in the References dialog.
    const paperId = useAtlas.getState().activeTabId
      ? useAtlas
          .getState()
          .papers[
            useAtlas.getState().tabs.find(
              (t) => t.id === useAtlas.getState().activeTabId,
            )?.paperId ?? ""
          ]?.id
      : undefined;
    if (paperId) {
      const cand: import("@/types").CitationCandidate = citeCandidate ?? {
        title: key,
        authors: [],
        year: null,
        doi: null,
        url,
        source: "manual",
        confidence: 0,
      };
      useAtlas.getState().registerCitation(paperId, key, cand);
    }
    onClose();
  }

  if (inlineForm === "xref") {
    const clampedX =
      typeof window !== "undefined"
        ? Math.max(8, Math.min(x, window.innerWidth - 360))
        : x;
    return (
      <div
        ref={ref}
        className="fixed z-30 panel shadow-2xl w-[360px] max-w-[92vw] p-3 rounded-lg overflow-hidden"
        style={{ left: clampedX, top: y }}
      >
        <div className="px-1 pb-2 text-[10px] uppercase tracking-[0.15em] text-subtle flex items-center justify-between">
          <span>Cross-reference</span>
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
            submitXRef();
          }}
          className="space-y-1.5"
        >
          <input
            ref={formInputRef}
            value={xrefTarget}
            onChange={(e) => setXrefTarget(e.target.value)}
            placeholder="Target label (e.g. fig:overview)"
            className="w-full bg-background border border-border rounded px-2 h-7 text-[12px] font-mono focus:outline-none focus:border-accent"
          />
          {xrefCandidates.length > 0 ? (
            <div className="max-h-44 overflow-y-auto border border-border rounded">
              {xrefCandidates.map((c) => (
                <button
                  key={`${c.kind}-${c.label}`}
                  type="button"
                  onClick={() => setXrefTarget(c.label)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 text-[11.5px] text-left hover:bg-surface-2",
                    xrefTarget === c.label && "bg-accent-soft text-accent",
                  )}
                >
                  <span
                    className={cn(
                      "px-1 rounded text-[9.5px] font-mono uppercase tracking-[0.12em]",
                      c.kind === "figure"
                        ? "bg-accent-soft text-accent border border-accent/30"
                        : "bg-info/10 text-info border border-info/30",
                    )}
                  >
                    {c.kind} {c.number}
                  </span>
                  <span className="font-mono text-subtle truncate">
                    {c.label}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[10.5px] text-subtle leading-relaxed">
              No labeled figures or tables in this document yet. Add a label
              when inserting a figure (e.g. <span className="font-mono">fig:overview</span>)
              and it'll show up here.
            </p>
          )}
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
              disabled={!xrefTarget.trim()}
              className="h-7 px-2 rounded text-[11px] bg-accent text-accent-fg disabled:opacity-40"
            >
              Insert
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (inlineForm === "captioned-table") {
    const clampedX =
      typeof window !== "undefined"
        ? Math.max(8, Math.min(x, window.innerWidth - 408))
        : x;
    return (
      <div
        ref={ref}
        className="fixed z-30 panel shadow-2xl w-[400px] max-w-[92vw] p-3 rounded-lg overflow-hidden"
        style={{ left: clampedX, top: y }}
      >
        <div className="px-1 pb-2 text-[10px] uppercase tracking-[0.15em] text-subtle flex items-center justify-between">
          <span>Insert captioned table</span>
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
            submitCaptionedTable();
          }}
          className="space-y-1.5"
        >
          <input
            ref={formInputRef}
            value={tableCaption}
            onChange={(e) => setTableCaption(e.target.value)}
            placeholder="Caption text (required)"
            className="w-full bg-background border border-border rounded px-2 h-7 text-[12px] focus:outline-none focus:border-accent"
          />
          <input
            value={tableLabel}
            onChange={(e) => setTableLabel(e.target.value)}
            placeholder="Label for cross-ref (optional, e.g. tab:results)"
            className="w-full bg-background border border-border rounded px-2 h-7 text-[12px] font-mono focus:outline-none focus:border-accent"
          />
          <p className="text-[10px] text-subtle leading-relaxed pt-1">
            Inserts a 3×3 editable table with an auto-numbered Table N.
            caption block beneath it. LaTeX export wraps the pair in{" "}
            <span className="font-mono">\begin{`{table}`}</span>.
          </p>
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
              disabled={!tableCaption.trim()}
              className="h-7 px-2 rounded text-[11px] bg-accent text-accent-fg disabled:opacity-40"
            >
              Insert
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (inlineForm === "figure") {
    const clampedX =
      typeof window !== "undefined"
        ? Math.max(8, Math.min(x, window.innerWidth - 408))
        : x;
    return (
      <div
        ref={ref}
        className="fixed z-30 panel shadow-2xl w-[400px] max-w-[92vw] p-3 rounded-lg overflow-hidden"
        style={{ left: clampedX, top: y }}
      >
        <div className="px-1 pb-2 text-[10px] uppercase tracking-[0.15em] text-subtle flex items-center justify-between">
          <span>Insert figure</span>
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
            submitFigure();
          }}
          className="space-y-1.5"
        >
          <input
            ref={formInputRef}
            value={figSrc}
            onChange={(e) => setFigSrc(e.target.value)}
            placeholder="Image URL (https://… or data:image/png;base64,…)"
            className="w-full bg-background border border-border rounded px-2 h-7 text-[12px] focus:outline-none focus:border-accent"
          />
          <input
            value={figCaption}
            onChange={(e) => setFigCaption(e.target.value)}
            placeholder="Caption text (required)"
            className="w-full bg-background border border-border rounded px-2 h-7 text-[12px] focus:outline-none focus:border-accent"
          />
          <input
            value={figLabel}
            onChange={(e) => setFigLabel(e.target.value)}
            placeholder="Label for cross-ref (optional, e.g. fig:overview)"
            className="w-full bg-background border border-border rounded px-2 h-7 text-[12px] font-mono focus:outline-none focus:border-accent"
          />
          <p className="text-[10px] text-subtle leading-relaxed pt-1">
            Figures are auto-numbered in document order. LaTeX export wraps
            this as <span className="font-mono">\begin{`{figure}`}</span>{" "}
            with the caption + label.
          </p>
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
              disabled={!figSrc.trim() || !figCaption.trim()}
              className="h-7 px-2 rounded text-[11px] bg-accent text-accent-fg disabled:opacity-40"
            >
              Insert
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (inlineForm === "math") {
    const clampedX =
      typeof window !== "undefined"
        ? Math.max(8, Math.min(x, window.innerWidth - 408))
        : x;
    return (
      <div
        ref={ref}
        className="fixed z-30 panel shadow-2xl w-[400px] max-w-[92vw] p-3 rounded-lg overflow-hidden"
        style={{ left: clampedX, top: y }}
      >
        <div className="px-1 pb-2 text-[10px] uppercase tracking-[0.15em] text-subtle flex items-center justify-between">
          <span>Insert math equation</span>
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
            submitMath();
          }}
          className="space-y-2"
        >
          <div className="flex items-center gap-1 text-[11px]">
            {(["display", "inline"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setMathKind(k)}
                className={cn(
                  "h-6 px-2 rounded text-[10.5px] font-mono uppercase tracking-[0.12em] border",
                  mathKind === k
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border bg-surface text-muted hover:text-foreground",
                )}
              >
                {k}
              </button>
            ))}
            <span className="ml-auto text-[10px] font-mono text-subtle">
              LaTeX
            </span>
          </div>
          <textarea
            ref={formInputRef as unknown as React.RefObject<HTMLTextAreaElement>}
            value={mathTex}
            onChange={(e) => setMathTex(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submitMath();
              }
            }}
            placeholder="\\sum_{i=1}^{n} x_i^2"
            rows={3}
            className="w-full bg-background border border-border rounded px-2 py-1.5 text-[12px] font-mono focus:outline-none focus:border-accent resize-none"
          />
          <div className="border border-border rounded bg-surface-2/40 px-3 py-2 min-h-[44px] flex items-center justify-center overflow-x-auto">
            <span ref={mathPreviewRef} className="text-foreground" />
          </div>
          {mathKind === "display" && (
            <input
              value={mathLabel}
              onChange={(e) => setMathLabel(e.target.value)}
              placeholder="Label for cross-ref (optional, e.g. eq:loss)"
              className="w-full bg-background border border-border rounded px-2 h-7 text-[12px] font-mono focus:outline-none focus:border-accent"
            />
          )}
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[10px] text-subtle font-mono">
              <span className="kbd">⌘</span>
              <span className="kbd">↵</span> insert
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onClose}
                className="h-7 px-2 rounded text-[11px] text-muted hover:text-foreground hover:bg-surface-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!mathTex.trim()}
                className="h-7 px-2 rounded text-[11px] bg-accent text-accent-fg disabled:opacity-40"
              >
                Insert
              </button>
            </div>
          </div>
        </form>
      </div>
    );
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
          <div className="flex items-center gap-1.5">
            <input
              value={formUrl}
              onChange={(e) => {
                setFormUrl(e.target.value);
                setCiteVerifyStatus("idle");
                // Clear stale candidate when URL changes — otherwise a user
                // who verified, then edited the URL, would silently register
                // metadata for the old URL.
                setCiteCandidate(null);
              }}
              onBlur={verifyCitation}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  onClose();
                }
              }}
              type="url"
              placeholder="URL or DOI (optional)"
              className="flex-1 bg-background border border-border rounded px-2 h-7 text-[12px] focus:outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={verifyCitation}
              disabled={citeVerifyStatus === "checking"}
              className="h-7 px-2 rounded text-[10.5px] border border-border text-muted hover:text-foreground hover:bg-surface-2 disabled:opacity-50"
              title="Check this against CrossRef / OpenAlex / Semantic Scholar / Nia"
            >
              Verify
            </button>
          </div>
          {citeVerifyStatus !== "idle" && (
            <div
              className={cn(
                "text-[10.5px] rounded px-1.5 py-1 border flex items-start gap-1.5 leading-snug",
                citeVerifyStatus === "ok" &&
                  "border-accent/30 bg-accent-soft/40 text-accent",
                citeVerifyStatus === "unresolved" &&
                  "border-warning/40 bg-warning/5 text-warning",
                citeVerifyStatus === "error" &&
                  "border-warning/40 bg-warning/5 text-warning",
                citeVerifyStatus === "checking" &&
                  "border-border bg-surface-2/40 text-subtle",
              )}
            >
              <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] pt-0.5 shrink-0">
                {citeVerifyStatus === "ok"
                  ? "verified"
                  : citeVerifyStatus === "unresolved"
                    ? "no match"
                    : citeVerifyStatus === "error"
                      ? "error"
                      : "checking…"}
              </span>
              <span className="flex-1">{citeVerifyMsg || "—"}</span>
            </div>
          )}
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
              {citeVerifyStatus === "unresolved" ? "Insert anyway" : "Insert"}
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
