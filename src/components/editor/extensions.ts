import { Mark, mergeAttributes } from "@tiptap/core";

export const Citation = Mark.create({
  name: "citation",
  inclusive: false,
  addAttributes() {
    return {
      key: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-key"),
        renderHTML: (attrs) => ({ "data-key": attrs.key }),
      },
      url: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-url"),
        renderHTML: (attrs) => ({ "data-url": attrs.url }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span.citation" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { class: "citation" }),
      0,
    ];
  },
});

export const CommentMark = Mark.create({
  name: "comment",
  inclusive: false,
  addAttributes() {
    return {
      id: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-comment-id"),
        renderHTML: (attrs) => ({ "data-comment-id": attrs.id }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span.comment-mark" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { class: "comment-mark" }),
      0,
    ];
  },
});

export const BindingMark = Mark.create({
  name: "binding",
  inclusive: false,
  addAttributes() {
    return {
      id: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-binding-id"),
        renderHTML: (attrs) => ({ "data-binding-id": attrs.id }),
      },
      url: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-binding-url"),
        renderHTML: (attrs) => ({ "data-binding-url": attrs.url }),
      },
      kind: {
        default: "url",
        parseHTML: (el) => el.getAttribute("data-binding-kind"),
        renderHTML: (attrs) => ({ "data-binding-kind": attrs.kind }),
      },
      status: {
        default: "unknown",
        parseHTML: (el) => el.getAttribute("data-binding-status"),
        renderHTML: (attrs) => ({ "data-binding-status": attrs.status }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span.binding-mark" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { class: "binding-mark" }),
      0,
    ];
  },
});

/**
 * ProvenanceMark wraps AI-edited text inline so the editor can render a
 * hover popover with the originating ledger event's metadata. The mark
 * carries the event id; ProvenanceTimeline owns the full event data.
 */
export const ProvenanceMark = Mark.create({
  name: "provenance",
  inclusive: false,
  addAttributes() {
    return {
      eventId: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-prov-event"),
        renderHTML: (attrs) => ({ "data-prov-event": attrs.eventId }),
      },
      kind: {
        default: "ai-edit",
        parseHTML: (el) => el.getAttribute("data-prov-kind"),
        renderHTML: (attrs) => ({ "data-prov-kind": attrs.kind }),
      },
      actor: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-prov-actor"),
        renderHTML: (attrs) => ({ "data-prov-actor": attrs.actor }),
      },
      model: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-prov-model"),
        renderHTML: (attrs) => ({ "data-prov-model": attrs.model }),
      },
      sourceCount: {
        default: 0,
        parseHTML: (el) =>
          Number(el.getAttribute("data-prov-sources") ?? "0"),
        renderHTML: (attrs) => ({
          "data-prov-sources": String(attrs.sourceCount ?? 0),
        }),
      },
      unsourcedCount: {
        default: 0,
        parseHTML: (el) =>
          Number(el.getAttribute("data-prov-unsourced") ?? "0"),
        renderHTML: (attrs) => ({
          "data-prov-unsourced": String(attrs.unsourcedCount ?? 0),
        }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span.provenance-mark" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { class: "provenance-mark" }),
      0,
    ];
  },
});
