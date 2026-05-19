import { Node, mergeAttributes } from "@tiptap/core";

/**
 * Figure node — image with required caption + optional label.
 *
 * Why a dedicated node instead of the built-in Image: papers rely on
 * captioned figures with stable numbering ("Figure 3 shows ..."). The
 * built-in image is just an inline media element; figures are atomic
 * block-level structures that own their caption + a label for cross-ref.
 *
 * Auto-numbering: each Figure node renders a "Figure N" prefix where N is
 * computed at render time from its position among siblings (handled in the
 * NodeView so insertions / deletions update labels live). When the LaTeX
 * exporter runs, it rebuilds the same numbering from DOM order.
 *
 *   {
 *     src: "https://...",
 *     alt: "Optional alt text",
 *     caption: "Required caption text",
 *     label: "fig:overview",  // optional, for cross-refs
 *     width: 0.8,             // optional, fraction 0..1 of column width
 *   }
 */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    figure: {
      insertFigure: (attrs: {
        src: string;
        caption: string;
        alt?: string;
        label?: string;
        width?: number;
      }) => ReturnType;
    };
  }
}

export const Figure = Node.create({
  name: "figure",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: "",
        parseHTML: (el) => el.querySelector("img")?.getAttribute("src") ?? "",
        renderHTML: (attrs) => ({ "data-src": attrs.src }),
      },
      alt: {
        default: "",
        parseHTML: (el) => el.querySelector("img")?.getAttribute("alt") ?? "",
      },
      caption: {
        default: "",
        parseHTML: (el) =>
          el.querySelector("figcaption")?.textContent?.trim() ?? "",
        renderHTML: () => ({}),
      },
      label: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-label") ?? "",
        renderHTML: (attrs) =>
          attrs.label ? { "data-label": attrs.label } : {},
      },
      width: {
        default: 1,
        parseHTML: (el) => {
          const raw = el.getAttribute("data-width");
          const n = raw ? parseFloat(raw) : 1;
          return Number.isFinite(n) ? Math.max(0.1, Math.min(1, n)) : 1;
        },
        renderHTML: (attrs) =>
          attrs.width && attrs.width < 1
            ? { "data-width": String(attrs.width) }
            : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "figure.atlas-figure" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    // Static HTML output — used by getHTML() for persistence + LaTeX export.
    // The interactive label ("Figure N") is added by the NodeView at render
    // time; the persisted HTML keeps src + caption + label + width so
    // re-import is fully lossless. HTMLAttributes carries the
    // data-src/data-label/data-width values our `renderHTML` attr emitters
    // produced; merging them here is what stitches them onto the <figure>.
    const src = String(node.attrs.src ?? "");
    const alt = String(node.attrs.alt ?? "");
    const caption = String(node.attrs.caption ?? "");
    return [
      "figure",
      mergeAttributes(HTMLAttributes, { class: "atlas-figure" }),
      ["img", { src, alt }],
      ["figcaption", {}, caption],
    ];
  },

  addCommands() {
    return {
      insertFigure:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              src: attrs.src,
              caption: attrs.caption,
              alt: attrs.alt ?? "",
              label: attrs.label ?? "",
              width: attrs.width ?? 1,
            },
          }),
    };
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement("figure");
      dom.className = "atlas-figure";
      dom.contentEditable = "false";

      const img = document.createElement("img");
      img.src = String(node.attrs.src ?? "");
      img.alt = String(node.attrs.alt ?? "");
      if (node.attrs.width && Number(node.attrs.width) < 1) {
        img.style.width = `${Math.round(Number(node.attrs.width) * 100)}%`;
      }

      const caption = document.createElement("figcaption");
      caption.dataset.label = String(node.attrs.label ?? "");

      let currentCaptionText = String(node.attrs.caption ?? "");
      const refreshCaption = () => {
        writeCaption(
          caption,
          currentCaptionText,
          indexOfFigure(editor, getPos),
        );
      };
      refreshCaption();

      dom.appendChild(img);
      dom.appendChild(caption);

      // Tiptap only calls update() when THIS node's attrs change — so a
      // figure inserted before us doesn't refresh our number. Subscribe to
      // editor-wide transactions and re-derive the index on every change
      // that mutated the document. Cheap (figures are sparse) and keeps
      // labels live without a separate decorations plugin.
      const onTx = ({ transaction }: { transaction: { docChanged: boolean } }) => {
        if (transaction.docChanged) refreshCaption();
      };
      editor.on("transaction", onTx);

      return {
        dom,
        update(updated) {
          if (updated.type.name !== "figure") return false;
          img.src = String(updated.attrs.src ?? "");
          img.alt = String(updated.attrs.alt ?? "");
          if (updated.attrs.width && Number(updated.attrs.width) < 1) {
            img.style.width = `${Math.round(Number(updated.attrs.width) * 100)}%`;
          } else {
            img.style.removeProperty("width");
          }
          caption.dataset.label = String(updated.attrs.label ?? "");
          currentCaptionText = String(updated.attrs.caption ?? "");
          refreshCaption();
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
 * Compute the 1-based index of a Figure node by walking the document and
 * counting Figure nodes that appear before (or at) the given position.
 * Live-updates because the NodeView re-runs `update()` whenever the
 * surrounding document changes.
 */
function indexOfFigure(
  editor: { state: { doc: { descendants: (fn: (node: any, pos: number) => boolean | void) => void } } },
  getPos: (() => number | undefined) | boolean | undefined,
): number {
  if (typeof getPos !== "function") return 1;
  const target = getPos();
  if (typeof target !== "number") return 1;
  let n = 0;
  editor.state.doc.descendants((node: { type: { name: string } }, pos: number) => {
    if (node.type.name === "figure") {
      n++;
      if (pos === target) {
        // Stop early — we have our answer.
        return false;
      }
    }
    return true;
  });
  return Math.max(1, n);
}

/** Render "Figure N. <caption text>" into the figcaption element. We split
 *  the prefix from the user text so screen readers + future i18n can
 *  re-style the prefix without re-stringing the caption. */
function writeCaption(el: HTMLElement, text: string, n: number) {
  el.innerHTML = "";
  const prefix = document.createElement("span");
  prefix.className = "atlas-figure-prefix";
  prefix.textContent = `Figure ${n}.`;
  const body = document.createTextNode(` ${text}`);
  el.appendChild(prefix);
  el.appendChild(body);
}
