import { Extension, InputRule } from "@tiptap/core";

// Markdown-style math input rules. Adds two patterns:
//   $$ tex $$  → block math node
//   $ tex $    → inline math node
//
// Both fire on the moment the user types the closing delimiter — the captured
// LaTeX becomes the `tex` attribute of the math node.

export const MathInputRules = Extension.create({
  name: "mathInputRules",

  addInputRules() {
    return [
      // Block: typing the closing `$$` after some captured content.
      new InputRule({
        find: /\$\$([^$\n]+?)\$\$$/,
        handler: ({ range, match, state, chain }) => {
          const tex = (match[1] ?? "").trim();
          if (!tex) return;
          chain()
            .deleteRange({ from: range.from, to: range.to })
            .insertContent({ type: "blockMath", attrs: { tex } })
            .run();
        },
      }),
      // Inline: typing the closing `$` after some captured content. We forbid
      // newlines and inner `$` so this doesn't fire mid-edit on long stretches
      // of dollar-quoted prose.
      new InputRule({
        find: /\$([^$\n]+?)\$$/,
        handler: ({ range, match, chain }) => {
          const tex = (match[1] ?? "").trim();
          if (!tex) return;
          chain()
            .deleteRange({ from: range.from, to: range.to })
            .insertContent({ type: "inlineMath", attrs: { tex } })
            .run();
        },
      }),
    ];
  },
});
