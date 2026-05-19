import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * Style coach — lightweight inline writing-quality decoration.
 *
 * Scans every text node in the doc on each state change, runs a small
 * set of rules (filler, weasel, passive-voice, double-space), and adds
 * an inline decoration with a yellow dotted underline + tooltip
 * carrying the rule message + suggested fix.
 *
 * Browser-native spell-check is already on by default (contenteditable
 * inherits it), so this layer focuses on academic-writing issues that
 * spell-check doesn't catch.
 *
 * Designed for cheap synchronous evaluation — no LLM call, no network.
 * The full rubric-graded review still lives in the Paper Critic
 * (⌘⇧A); this is the always-on lightweight pass.
 *
 * Toggle via the `.atlas-style-coach` class on the editor DOM — CSS
 * controls visibility. The plugin runs unconditionally because the
 * decoration pass is cheap; turning it off via class avoids re-mounting
 * the editor.
 */
export const StyleCoach = Extension.create({
  name: "styleCoach",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("atlasStyleCoach"),
        props: {
          decorations(state) {
            const decos: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return true;
              for (const rule of RULES) {
                rule.regex.lastIndex = 0;
                let m: RegExpExecArray | null;
                while ((m = rule.regex.exec(node.text)) !== null) {
                  const from = pos + m.index;
                  const to = from + m[0].length;
                  decos.push(
                    Decoration.inline(from, to, {
                      class: `atlas-style atlas-style-${rule.severity}`,
                      "data-style-rule": rule.id,
                      "data-style-message": rule.message(m[0]),
                      "data-style-fix": rule.fix(m[0]),
                      // Stash absolute positions so the hover popover can
                      // replace the *specific* matched span when the user
                      // clicks Apply — without this, a doc-wide search by
                      // matched text would rewrite the wrong instance when
                      // the same phrase occurs multiple times.
                      "data-style-from": String(from),
                      "data-style-to": String(to),
                      title: `${rule.message(m[0])}${rule.fix(m[0]) ? ` → ${rule.fix(m[0])}` : ""}`,
                    }),
                  );
                  // Defensive: empty-match guard (regex with * quantifier
                  // could match length 0 and infinite-loop).
                  if (m.index === rule.regex.lastIndex) rule.regex.lastIndex++;
                }
              }
              return true;
            });
            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },
});

interface StyleRule {
  id: string;
  regex: RegExp;
  severity: "suggestion" | "warning";
  message: (match: string) => string;
  fix: (match: string) => string;
}

const RULES: StyleRule[] = [
  {
    id: "filler-in-order-to",
    regex: /\bin order to\b/gi,
    severity: "suggestion",
    message: () => "Filler phrasing.",
    fix: () => "to",
  },
  {
    id: "filler-due-to-the-fact-that",
    regex: /\bdue to the fact that\b/gi,
    severity: "suggestion",
    message: () => "Filler phrasing.",
    fix: () => "because",
  },
  {
    id: "filler-utilize",
    regex: /\butili[sz]es?\b/gi,
    severity: "suggestion",
    message: (m) => `"${m}" is jargon for "use".`,
    fix: (m) => (m.endsWith("s") ? "uses" : "use"),
  },
  {
    id: "filler-the-fact-that",
    regex: /\bthe fact that\b/gi,
    severity: "suggestion",
    message: () => "Almost always droppable.",
    fix: () => "that",
  },
  {
    id: "weasel-very",
    regex: /\bvery\s+(\w+)/gi,
    severity: "suggestion",
    message: () => "Weasel intensifier — pick a stronger word.",
    fix: (_) => "(remove or replace)",
  },
  {
    id: "weasel-really",
    regex: /\breally\s+(\w+)/gi,
    severity: "suggestion",
    message: () => "Weasel intensifier — pick a stronger word.",
    fix: (_) => "(remove or replace)",
  },
  {
    id: "weasel-essentially",
    regex: /\bessentially\b/gi,
    severity: "suggestion",
    message: () => "Hedge word — does it add meaning?",
    fix: () => "(drop if not load-bearing)",
  },
  {
    id: "weasel-basically",
    regex: /\bbasically\b/gi,
    severity: "suggestion",
    message: () => "Hedge word — does it add meaning?",
    fix: () => "(drop if not load-bearing)",
  },
  {
    id: "weasel-quite",
    regex: /\bquite\b/gi,
    severity: "suggestion",
    message: () => "Hedge word — does it add meaning?",
    fix: () => "(drop if not load-bearing)",
  },
  {
    id: "passive-voice",
    // Naive passive heuristic: "was/were/is/are/be/been/being" + word ending
    // in -ed (or known irregular past participles). This regex over-matches
    // copula+adjective constructions ("was tired", "is excited") and a few
    // intransitive past tenses ("it happened" → won't match because of the
    // \w+ed alternation needing transitive forms, but borderline cases
    // exist). We keep severity at "suggestion" rather than "warning" so the
    // underline is dotted yellow (advisory) rather than wavy amber
    // (corrective) — passive-voice flagging is genuinely a heuristic, not a
    // rule violation.
    regex:
      /\b(was|were|is|are|be|been|being)\s+(\w+ed|done|seen|made|given|taken|shown|known|written|held)\b/gi,
    severity: "suggestion",
    message: () =>
      "Possible passive — active voice is usually clearer (heuristic; may flag adjectives).",
    fix: () => "(consider rewriting in active voice)",
  },
  {
    id: "double-space",
    regex: /(?<!\s) {2,}(?!\s)/g,
    severity: "suggestion",
    message: () => "Multiple spaces.",
    fix: () => " ",
  },
];
