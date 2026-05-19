import { Node, mergeAttributes } from "@tiptap/core";

/**
 * Caption block that pairs with a table. Lives as a sibling immediately
 * after a Tiptap table — we don't try to embed inside the table node
 * because Tiptap's TableKit owns that schema. This is the conventional
 * scientific-paper pattern anyway: caption above or below the table.
 *
 * The auto-numbered "Table N." prefix is re-derived from document order
 * on every docChanged transaction (same approach as Figure). Atlas
 * numbers captions sequentially; the editor doesn't require captions
 * to be paired with a real table node to render — that pairing is
 * enforced at LaTeX export time so loose captions don't crash the build.
 */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    tableCaption: {
      insertCaptionedTable: (caption: string, label?: string) => ReturnType;
    };
  }
}

export const TableCaption = Node.create({
  name: "tableCaption",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      caption: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-caption") ?? el.textContent ?? "",
        renderHTML: (attrs) => ({ "data-caption": attrs.caption }),
      },
      label: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-table-caption-label") ?? "",
        renderHTML: (attrs) =>
          attrs.label ? { "data-table-caption-label": attrs.label } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "div.atlas-table-caption" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { class: "atlas-table-caption" }),
      String(node.attrs.caption ?? ""),
    ];
  },

  addCommands() {
    return {
      insertCaptionedTable:
        (caption: string, label?: string) =>
        ({ commands, chain }) => {
          // Insert a 3-row × 3-col table first, then drop the caption
          // block below it. Tiptap's TableKit insertTable command is
          // available because we register that extension at the editor
          // level — this command just sequences both inserts.
          return chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .insertContent({
              type: "tableCaption",
              attrs: { caption, label: label ?? "" },
            })
            .run() && commands.focus("end");
        },
    };
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement("div");
      dom.className = "atlas-table-caption";
      dom.contentEditable = "false";
      if (node.attrs.label) {
        dom.dataset.tableCaptionLabel = String(node.attrs.label);
      }

      let currentCaption = String(node.attrs.caption ?? "");
      const refresh = () => {
        write(dom, currentCaption, indexOfTableCaption(editor, getPos));
      };
      refresh();

      const onTx = ({ transaction }: { transaction: { docChanged: boolean } }) => {
        if (transaction.docChanged) refresh();
      };
      editor.on("transaction", onTx);

      return {
        dom,
        update(updated) {
          if (updated.type.name !== "tableCaption") return false;
          currentCaption = String(updated.attrs.caption ?? "");
          if (updated.attrs.label) {
            dom.dataset.tableCaptionLabel = String(updated.attrs.label);
          } else {
            delete dom.dataset.tableCaptionLabel;
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

/**
 * Find the 1-based ordinal of this TableCaption by document position.
 * ProseMirror creates new node objects on each walk, so `node === target`
 * never matches; comparing positions (which ARE stable for a given node
 * across that tree walk) is the correct fix. Mirrors the pattern in
 * src/components/editor/figure.ts:indexOfFigure.
 */
function indexOfTableCaption(
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
    (node: { type: { name: string } }, pos: number) => {
      if (node.type.name === "tableCaption") {
        n++;
        if (pos === target) return false;
      }
      return true;
    },
  );
  return Math.max(1, n);
}

function write(el: HTMLElement, caption: string, n: number) {
  el.innerHTML = "";
  const prefix = document.createElement("span");
  prefix.className = "atlas-table-caption-prefix";
  prefix.textContent = `Table ${n}.`;
  const body = document.createTextNode(` ${caption}`);
  el.appendChild(prefix);
  el.appendChild(body);
}
