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
      const dom = document.createElement("div");
      dom.className = "math math-display";
      dom.contentEditable = "false";
      dom.dataset.mathKind = "display";
      dom.dataset.tex = String(node.attrs.tex ?? "");
      renderInto(dom, String(node.attrs.tex ?? ""), true);
      return {
        dom,
        update(updated) {
          if (updated.type.name !== "blockMath") return false;
          const next = String(updated.attrs.tex ?? "");
          if (dom.dataset.tex === next) return true;
          dom.dataset.tex = next;
          dom.innerHTML = "";
          renderInto(dom, next, true);
          return true;
        },
      };
    };
  },
});

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
