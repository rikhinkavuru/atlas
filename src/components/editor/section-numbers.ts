import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * Inline section-number prefix decoration plugin.
 *
 * Walks the doc on every state change, computes hierarchical "1.2.3"
 * numbers from h1/h2/h3 depth, and inserts a tiny widget DOM node
 * before each heading containing the number. The numbering logic
 * mirrors collectXRefTargets in xref.ts so the visible inline number
 * matches what cross-references resolve to and what the LaTeX export
 * produces.
 *
 * Plugin (not NodeView): we want to add a visual prefix to a node
 * type owned by StarterKit without replacing its renderHTML. Widget
 * decorations are the canonical ProseMirror pattern for this — the
 * widget is contentEditable=false so the cursor moves past it
 * cleanly, and ProseMirror redraws it on every transaction.
 *
 * Feature-flagged via a `data-section-numbers` attribute on the
 * editor DOM, which PaperEditor toggles based on the user's
 * showSectionNumbers setting. When the attr is absent, the widget is
 * still computed but CSS hides it (`display: none`) so toggling is
 * cheap — no plugin remount required.
 */
export const SectionNumbers = Extension.create({
  name: "sectionNumbers",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("atlasSectionNumbers"),
        props: {
          decorations(state) {
            const decos: Decoration[] = [];
            let h1 = 0,
              h2 = 0,
              h3 = 0;
            state.doc.descendants((node, pos) => {
              if (node.type.name !== "heading") return true;
              const level = Number(node.attrs.level ?? 1);
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
              const num =
                level <= 1
                  ? `${h1}`
                  : level === 2
                    ? `${h1}.${h2}`
                    : `${h1}.${h2}.${h3}`;
              // pos points to the position *before* the heading node;
              // inserting a widget there places it before the heading
              // content but still attached to the heading block visually.
              decos.push(
                Decoration.widget(
                  pos + 1,
                  () => buildPrefix(num),
                  {
                    side: -1,
                    ignoreSelection: true,
                  },
                ),
              );
              // Don't descend into headings — child nodes (text, marks)
              // don't carry their own heading levels.
              return false;
            });
            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },
});

function buildPrefix(text: string): HTMLElement {
  const el = document.createElement("span");
  el.className = "atlas-section-number";
  el.contentEditable = "false";
  el.textContent = text;
  // The data-atlas-prefix marker lets the CSS hide the widget when
  // section numbering is off without removing the plugin altogether.
  el.setAttribute("data-atlas-prefix", "section");
  return el;
}
