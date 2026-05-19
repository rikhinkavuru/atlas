import { Node, mergeAttributes } from "@tiptap/core";

/**
 * Cross-reference inline node.
 *
 *   {
 *     target: "fig:overview",
 *   }
 *
 * Renders as a clickable text chip showing the live label of whatever node
 * carries the matching `data-label` (or `attrs.label`). Today the resolver
 * walks Figure and TableCaption nodes; when sections grow labels, this is
 * the single point of integration.
 *
 * Live updates: like Figure, the NodeView subscribes to docChanged
 * transactions and refreshes the visible text on every edit so inserting
 * a new Figure 1 before existing ones renumbers all xrefs that point at
 * the moved figures.
 *
 * Click → scrolls to the target node's DOM element. LaTeX export emits
 * `\ref{target}` — see latex.ts.
 */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    xref: {
      insertXRef: (target: string) => ReturnType;
    };
  }
}

export interface XRefTarget {
  /** Label as written by the user (e.g. "fig:overview", "sec:method"). */
  label: string;
  /** Drives the prefix and number format shown by the xref. */
  kind: "figure" | "table" | "section" | "equation";
  /** For figure/table/equation: 1-based document order.
   *  For section: hierarchical "1.2.3" derived from h1/h2/h3 depth. */
  number: string;
}

/**
 * Walk the editor doc once and collect every labeled figure, table-caption,
 * heading, and labeled display-math node. Returned in document order, with
 * per-kind numbering.
 *
 * Section numbering tracks the heading hierarchy: a new h1 resets h2/h3
 * counters, a new h2 resets h3. Unlabeled headings still increment the
 * counters so the numbering reflects what readers see in the rendered
 * document.
 *
 * Equation numbering counts only labeled display-math; unlabeled equations
 * are not numbered (matches LaTeX's `\[ ... \]` vs `\begin{equation}`
 * distinction).
 */
export function collectXRefTargets(
  doc: { descendants: (fn: (node: any, pos: number) => boolean | void) => void },
): XRefTarget[] {
  const out: XRefTarget[] = [];
  let figureIdx = 0;
  let tableIdx = 0;
  let equationIdx = 0;
  let h1 = 0,
    h2 = 0,
    h3 = 0;
  doc.descendants(
    (node: {
      type: { name: string };
      attrs?: Record<string, unknown>;
    }) => {
      if (node.type.name === "figure") {
        figureIdx++;
        const label = String(node.attrs?.label ?? "").trim();
        if (label)
          out.push({ label, kind: "figure", number: String(figureIdx) });
      } else if (node.type.name === "tableCaption") {
        tableIdx++;
        const label = String(node.attrs?.label ?? "").trim();
        if (label)
          out.push({ label, kind: "table", number: String(tableIdx) });
      } else if (node.type.name === "heading") {
        const level = Number(node.attrs?.level ?? 1);
        if (level <= 1) {
          h1++;
          h2 = 0;
          h3 = 0;
        } else if (level === 2) {
          h2++;
          h3 = 0;
        } else {
          h3++;
        }
        const label = String(node.attrs?.label ?? "").trim();
        if (label) {
          const num =
            level <= 1
              ? `${h1}`
              : level === 2
                ? `${h1}.${h2}`
                : `${h1}.${h2}.${h3}`;
          out.push({ label, kind: "section", number: num });
        }
      } else if (node.type.name === "blockMath") {
        const label = String(node.attrs?.label ?? "").trim();
        if (label) {
          equationIdx++;
          out.push({
            label,
            kind: "equation",
            number: String(equationIdx),
          });
        }
      }
      return true;
    },
  );
  return out;
}

function prefixFor(kind: XRefTarget["kind"]): string {
  if (kind === "table") return "Table";
  if (kind === "section") return "§";
  if (kind === "equation") return "Eq.";
  return "Figure";
}

export const XRef = Node.create({
  name: "xref",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      target: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-target") ?? "",
        renderHTML: (attrs) => ({ "data-target": attrs.target }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span.atlas-xref[data-target]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    // Static HTML output for persistence. We render the live label text
    // alongside data-target so a re-import (or paste into another tool)
    // gets a sensible fallback. The NodeView overwrites the text content
    // with the live-resolved label at view time.
    return [
      "span",
      mergeAttributes(HTMLAttributes, { class: "atlas-xref" }),
      `[${String(node.attrs.target ?? "?")}]`,
    ];
  },

  addCommands() {
    return {
      insertXRef:
        (target: string) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { target },
          }),
    };
  },

  addNodeView() {
    return ({ node, editor }) => {
      const dom = document.createElement("span");
      dom.className = "atlas-xref";
      dom.contentEditable = "false";
      dom.dataset.target = String(node.attrs.target ?? "");

      function resolve(): string {
        const target = String(node.attrs.target ?? "").trim();
        if (!target) return "[?]";
        const matches = collectXRefTargets(editor.state.doc).filter(
          (t) => t.label === target,
        );
        if (matches.length === 0) {
          dom.classList.add("atlas-xref-dead");
          return `[?${target}]`;
        }
        dom.classList.remove("atlas-xref-dead");
        const t = matches[0];
        // "§1.2" — no separator. "Figure 3", "Table 2", "Eq. 4" — space.
        const sep = t.kind === "section" ? "" : " ";
        const num =
          t.kind === "equation" ? `(${t.number})` : t.number;
        return `${prefixFor(t.kind)}${sep}${num}`;
      }

      dom.textContent = resolve();
      dom.title = `Cross-reference → ${node.attrs.target}. Click to jump to the target.`;
      dom.addEventListener("click", (e) => {
        e.preventDefault();
        const target = String(node.attrs.target ?? "");
        if (!target) return;
        // Find the corresponding figure/figcaption element by data-label.
        const root = editor.view.dom as HTMLElement;
        const targetEl =
          root.querySelector(`figure[data-label="${cssEscape(target)}"]`) ??
          root.querySelector(`figcaption[data-label="${cssEscape(target)}"]`) ??
          root.querySelector(
            `[data-table-caption-label="${cssEscape(target)}"]`,
          );
        targetEl?.scrollIntoView({ behavior: "smooth", block: "center" });
        if (targetEl instanceof HTMLElement) {
          targetEl.classList.add("atlas-xref-flash");
          window.setTimeout(
            () => targetEl.classList.remove("atlas-xref-flash"),
            1200,
          );
        }
      });

      const onTx = ({ transaction }: { transaction: { docChanged: boolean } }) => {
        if (transaction.docChanged) {
          dom.textContent = resolve();
          dom.dataset.target = String(node.attrs.target ?? "");
        }
      };
      editor.on("transaction", onTx);

      return {
        dom,
        update(updated) {
          if (updated.type.name !== "xref") return false;
          dom.dataset.target = String(updated.attrs.target ?? "");
          dom.textContent = resolve();
          return true;
        },
        destroy() {
          editor.off("transaction", onTx);
        },
      };
    };
  },
});

function cssEscape(s: string): string {
  return s.replace(/[^a-zA-Z0-9_:-]/g, "");
}
