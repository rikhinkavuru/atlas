import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

// Inline ProvenanceMark/Citation/BindingMark already decorate individual text
// runs. This extension lifts that signal up one level: each top-level block
// (paragraph, heading, blockquote, list-item) gets a `data-block-prov`
// attribute reflecting the dominant provenance state of its descendants. CSS
// in globals.css paints a 2px left border keyed off that attribute.
//
// State values:
//   "sourced"    — block contains AI text with sources OR explicit citations
//                  AND no unsupported AI claims
//   "unsourced"  — block contains AI text with unsourcedCount > 0
//   "binding"    — block contains a data binding but no AI marks (a passage
//                  bound to a W&B run / GitHub commit / dataset)
//   (absent)     — pure author content; no border
//
// Mixed states (sourced AI + unsourced AI in the same block) resolve to
// "unsourced" — caution wins. That mirrors how reviewers would read it: one
// unsupported claim taints the paragraph until it's addressed.

type BlockState = "sourced" | "unsourced" | "binding";

const BLOCK_NODES = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "listItem",
  "codeBlock",
]);

export const BlockProvenance = Extension.create({
  name: "blockProvenance",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("blockProvenance"),
        props: {
          decorations(state) {
            const decos: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (!BLOCK_NODES.has(node.type.name)) return;

              let hasSourced = false;
              let hasUnsourced = false;
              let hasBinding = false;

              node.descendants((inline) => {
                if (!inline.isText && inline.type.name !== "text") return;
                for (const mark of inline.marks) {
                  if (mark.type.name === "citation") {
                    hasSourced = true;
                  } else if (mark.type.name === "binding") {
                    hasBinding = true;
                  } else if (mark.type.name === "provenance") {
                    const src = Number(mark.attrs.sourceCount ?? 0);
                    const unsrc = Number(mark.attrs.unsourcedCount ?? 0);
                    if (unsrc > 0) hasUnsourced = true;
                    if (src > 0 || mark.attrs.kind === "ai-cite") {
                      hasSourced = true;
                    } else if (mark.attrs.kind === "ai-edit" && unsrc === 0) {
                      // AI-edit with no source signal still counts as
                      // unsourced — it's AI provenance without verification.
                      hasUnsourced = true;
                    }
                  }
                }
              });

              let blockState: BlockState | null = null;
              if (hasUnsourced) blockState = "unsourced";
              else if (hasSourced) blockState = "sourced";
              else if (hasBinding) blockState = "binding";

              if (!blockState) return;

              decos.push(
                Decoration.node(pos, pos + node.nodeSize, {
                  "data-block-prov": blockState,
                }),
              );
              // Don't recurse into already-decorated blocks; nested lists are
              // handled by the listItem walk separately.
              return false;
            });
            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },
});
