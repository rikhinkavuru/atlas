import { Node, mergeAttributes } from "@tiptap/core";
import katex from "katex";

// Two Tiptap nodes for math:
//   InlineMath  — `<span class="math math-inline" data-tex="...">`
//   BlockMath   — `<div class="math math-display" data-tex="...">`
//
// KaTeX renders into the node's view; the source LaTeX is preserved in the
// `tex` attribute so exports (HTML / Markdown / LaTeX) round-trip cleanly.
//
// Editing UX: clicking a math node opens an inline edit popover wired in
// PaperEditor; here we just register the node + render.

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    inlineMath: {
      insertInlineMath: (tex: string) => ReturnType;
    };
    blockMath: {
      insertBlockMath: (tex: string) => ReturnType;
    };
  }
}

function renderInto(el: HTMLElement, tex: string, displayMode: boolean) {
  try {
    katex.render(tex, el, {
      displayMode,
      throwOnError: false,
      // Match the muted error styling used elsewhere in the editor.
      errorColor: "var(--color-danger, #f88)",
      strict: "ignore",
      output: "html",
    });
  } catch {
    el.textContent = tex;
  }
}

export const InlineMath = Node.create({
  name: "inlineMath",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      tex: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-tex") ?? "",
        renderHTML: (attrs) => ({ "data-tex": attrs.tex }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span.math-inline[data-tex]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: "math math-inline",
        "data-math-kind": "inline",
      }),
    ];
  },

  addCommands() {
    return {
      insertInlineMath:
        (tex: string) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { tex },
          }),
    };
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("span");
      dom.className = "math math-inline";
      dom.contentEditable = "false";
      dom.dataset.mathKind = "inline";
      dom.dataset.tex = String(node.attrs.tex ?? "");
      renderInto(dom, String(node.attrs.tex ?? ""), false);
      return {
        dom,
        update(updated) {
          if (updated.type.name !== "inlineMath") return false;
          const next = String(updated.attrs.tex ?? "");
          if (dom.dataset.tex === next) return true;
          dom.dataset.tex = next;
          dom.innerHTML = "";
          renderInto(dom, next, false);
          return true;
        },
      };
    };
  },
});

export const BlockMath = Node.create({
  name: "blockMath",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      tex: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-tex") ?? "",
        renderHTML: (attrs) => ({ "data-tex": attrs.tex }),
      },
      // Optional label for cross-referencing. When set, the equation gets
      // an auto-numbered "(N)" badge on the right side and LaTeX export
      // promotes it from `\[ ... \]` to `\begin{equation}\label{}…
      // \end{equation}`. Unlabeled equations stay unnumbered, matching
      // standard LaTeX conventions.
      label: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-label") ?? "",
        renderHTML: (attrs) =>
          attrs.label ? { "data-label": String(attrs.label) } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div.math-display[data-tex]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        class: "math math-display",
        "data-math-kind": "display",
      }),
    ];
  },

  addCommands() {
    return {
      insertBlockMath:
        (tex: string, label?: string) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { tex, label: label ?? "" },
          }),
    };
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const wrap = document.createElement("div");
      wrap.className = "math math-display";
      wrap.contentEditable = "false";
      wrap.dataset.mathKind = "display";
      wrap.dataset.tex = String(node.attrs.tex ?? "");
      if (node.attrs.label) wrap.dataset.label = String(node.attrs.label);

      const body = document.createElement("span");
      body.className = "math-display-body";
      renderInto(body, String(node.attrs.tex ?? ""), true);

      const tag = document.createElement("span");
      tag.className = "math-display-tag";

      const refresh = () => {
        if (node.attrs.label) {
          tag.textContent = `(${indexOfLabeledEquation(editor, getPos)})`;
          tag.style.display = "";
        } else {
          tag.textContent = "";
          tag.style.display = "none";
        }
      };
      refresh();
      wrap.appendChild(body);
      wrap.appendChild(tag);

      const onTx = ({
        transaction,
      }: {
        transaction: { docChanged: boolean };
      }) => {
        if (transaction.docChanged) refresh();
      };
      editor.on("transaction", onTx);

      return {
        dom: wrap,
        update(updated) {
          if (updated.type.name !== "blockMath") return false;
          const next = String(updated.attrs.tex ?? "");
          const prev = wrap.dataset.tex ?? "";
          if (next !== prev) {
            wrap.dataset.tex = next;
            body.innerHTML = "";
            renderInto(body, next, true);
          }
          if (updated.attrs.label) {
            wrap.dataset.label = String(updated.attrs.label);
          } else {
            delete wrap.dataset.label;
          }
          refresh();
          return true;
        },
        destroy() {
          editor.off("transaction", onTx);
        },
      };
    };
  },
});

/** 1-based index of THIS labeled equation among all labeled display-math
 *  nodes in the document, by position. Unlabeled equations don't count. */
function indexOfLabeledEquation(
  editor: {
    state: { doc: { descendants: (fn: (node: any, pos: number) => boolean | void) => void } };
  },
  getPos: (() => number | undefined) | boolean | undefined,
): number {
  if (typeof getPos !== "function") return 1;
  const target = getPos();
  if (typeof target !== "number") return 1;
  let n = 0;
  editor.state.doc.descendants(
    (node: { type: { name: string }; attrs?: Record<string, unknown> }, pos: number) => {
      if (
        node.type.name === "blockMath" &&
        String(node.attrs?.label ?? "").trim()
      ) {
        n++;
        if (pos === target) return false;
      }
      return true;
    },
  );
  return Math.max(1, n);
}

// Convenience: parse markdown-style math from plain text. Used by the input
// rule + slash menu so users can type `$x^2$` and have it become an InlineMath
// node without leaving the keyboard.
export function parseMarkdownMath(text: string): { kind: "inline" | "block"; tex: string }[] {
  const out: { kind: "inline" | "block"; tex: string }[] = [];
  const re = /\$\$([\s\S]+?)\$\$|\$([^$]+?)\$/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[1] !== undefined) out.push({ kind: "block", tex: m[1].trim() });
    else if (m[2] !== undefined) out.push({ kind: "inline", tex: m[2].trim() });
  }
  return out;
}
