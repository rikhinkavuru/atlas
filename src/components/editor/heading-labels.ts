import { Extension } from "@tiptap/core";

/**
 * Adds an optional `label` attribute to Tiptap's built-in Heading node so a
 * section can carry an xref target (e.g. `sec:method`). We use the global-
 * attributes extension hook rather than swapping out StarterKit's heading
 * — that keeps the existing toggle/configuration semantics intact and just
 * augments the schema with one new attribute.
 *
 * Visible inline section numbering ("1.2.3") is a separate concern: with
 * this attribute in place, collectXRefTargets can already enumerate
 * sections, but the heading renders unchanged in the document. Section-
 * number prefixes would require a decorations plugin and are deferred.
 *
 * LaTeX export reads the label off the rendered <h1/h2/h3 data-label="…">
 * and emits `\label{sec:method}` immediately after the `\section{...}`.
 */
export const HeadingLabels = Extension.create({
  name: "headingLabels",

  addGlobalAttributes() {
    return [
      {
        types: ["heading"],
        attributes: {
          label: {
            default: "",
            parseHTML: (el) => el.getAttribute("data-label") ?? "",
            renderHTML: (attrs) =>
              attrs.label ? { "data-label": String(attrs.label) } : {},
          },
        },
      },
    ];
  },
});
