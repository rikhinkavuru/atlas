import type { ReviewSession, ReviewerItem } from "@/types";

/**
 * Response-to-reviewers letter formatters.
 *
 * One ReviewSession + an optional paper title → a properly-structured
 * response letter in markdown, LaTeX, or HTML. Each format groups items
 * by reviewer label (e.g. "Reviewer 1") and renders each as a
 * comment-and-response block.
 *
 * Schema-driven rather than vibes-driven: headers come from a templates
 * dict so a venue-specific opening/closing block can be swapped in without
 * editing the formatter. The default opening thanks the reviewers and
 * names the paper; the default closing thanks them again and offers to
 * answer questions.
 *
 * Honesty: items whose status is "todo" or "drafted" (response empty) are
 * rendered with a clear "[Response pending]" stub rather than being
 * silently omitted. The user wants to see what's still missing before they
 * submit. Rejected items can be flagged in the letter with a short note
 * ("We respectfully decline to make this change because...") — we surface
 * them with a marker so the author edits them honestly rather than burying
 * them.
 */

export type ResponseLetterFormat = "markdown" | "latex" | "html";

export interface ResponseLetterOptions {
  paperTitle?: string;
  authorName?: string;
  /** Override the default greeting block. */
  opening?: string;
  /** Override the default closing block. */
  closing?: string;
  /** When true, include rejected items in the letter with a "We did not
   *  adopt this change because..." preface so reviewers see what was
   *  pushed back on. Default true; setting false hides rejected items. */
  includeRejected?: boolean;
  /** When true, include placeholder lines for todo / drafted items so the
   *  author sees missing responses before exporting. Default true. */
  includePending?: boolean;
}

export interface ResponseLetterStats {
  total: number;
  addressed: number;
  drafted: number;
  rejected: number;
  todo: number;
}

export function letterStats(session: ReviewSession): ResponseLetterStats {
  const tally = (s: ReviewerItem["status"]) =>
    session.items.filter((it) => it.status === s).length;
  return {
    total: session.items.length,
    addressed: tally("addressed"),
    drafted: tally("drafted"),
    rejected: tally("rejected"),
    todo: tally("todo"),
  };
}

interface GroupedReviewer {
  label: string;
  items: ReviewerItem[];
}

function groupByReviewer(items: ReviewerItem[]): GroupedReviewer[] {
  const seen = new Map<string, ReviewerItem[]>();
  for (const it of items) {
    const list = seen.get(it.reviewerLabel) ?? [];
    list.push(it);
    seen.set(it.reviewerLabel, list);
  }
  return Array.from(seen.entries()).map(([label, items]) => ({ label, items }));
}

function defaultOpening(paperTitle: string | undefined, authorName: string | undefined): string {
  const title = paperTitle?.trim() || "our manuscript";
  return [
    `We thank the reviewers for their careful reading of ${title} and for the constructive feedback. Below we respond to each comment in turn; revised text in the manuscript is highlighted accordingly.`,
    authorName ? `— ${authorName.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function defaultClosing(): string {
  return `We hope these revisions address the reviewers' concerns. We remain happy to clarify any remaining points.`;
}

// ───────────────────────────────────────────────────────────────────────────
// Markdown

export function formatMarkdown(
  session: ReviewSession,
  opts: ResponseLetterOptions = {},
): string {
  const title = opts.paperTitle?.trim() || session.title || "Response to Reviewers";
  const includeRejected = opts.includeRejected !== false;
  const includePending = opts.includePending !== false;

  const lines: string[] = [];
  lines.push(`# Response to Reviewers — ${title}`);
  lines.push("");
  lines.push(opts.opening ?? defaultOpening(opts.paperTitle, opts.authorName));
  lines.push("");

  for (const group of groupByReviewer(session.items)) {
    lines.push(`## ${group.label}`);
    lines.push("");
    let idx = 0;
    for (const item of group.items) {
      if (item.status === "rejected" && !includeRejected) continue;
      if ((item.status === "todo" || item.status === "drafted") && !includePending && !item.response.trim()) continue;
      idx++;
      lines.push(`### ${group.label} · Comment ${item.number || idx}`);
      lines.push("");
      lines.push(`**Comment.** ${item.comment.trim()}`);
      lines.push("");
      const response = renderResponseText(item, includePending);
      lines.push(`**Response.** ${response}`);
      if (item.linkedQuote) {
        lines.push("");
        lines.push(`> Manuscript edit: “${item.linkedQuote}”`);
      }
      lines.push("");
    }
  }

  lines.push(opts.closing ?? defaultClosing());
  lines.push("");
  return lines.join("\n");
}

// ───────────────────────────────────────────────────────────────────────────
// LaTeX

const LATEX_ESCAPE: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "{": "\\{",
  "}": "\\}",
  "&": "\\&",
  "%": "\\%",
  "$": "\\$",
  "#": "\\#",
  "_": "\\_",
  "^": "\\^{}",
  "~": "\\~{}",
};

function latexEscape(s: string): string {
  return s.replace(/[\\{}&%$#_^~]/g, (c) => LATEX_ESCAPE[c] ?? c);
}

export function formatLatex(
  session: ReviewSession,
  opts: ResponseLetterOptions = {},
): string {
  const title = opts.paperTitle?.trim() || session.title || "Response to Reviewers";
  const includeRejected = opts.includeRejected !== false;
  const includePending = opts.includePending !== false;

  const lines: string[] = [];
  // Self-contained preamble so the output compiles with a plain `pdflatex`
  // run. Authors can splice the body into their venue template easily.
  lines.push("\\documentclass[11pt]{article}");
  lines.push("\\usepackage[margin=1in]{geometry}");
  lines.push("\\usepackage{xcolor}");
  lines.push("\\usepackage{hyperref}");
  lines.push("\\usepackage{parskip}");
  lines.push("");
  lines.push(`\\title{Response to Reviewers \\\\ \\large ${latexEscape(title)}}`);
  if (opts.authorName) lines.push(`\\author{${latexEscape(opts.authorName)}}`);
  lines.push("\\date{}");
  lines.push("");
  lines.push("\\begin{document}");
  lines.push("\\maketitle");
  lines.push("");
  lines.push(latexEscape(opts.opening ?? defaultOpening(opts.paperTitle, opts.authorName)));
  lines.push("");

  for (const group of groupByReviewer(session.items)) {
    lines.push(`\\section*{${latexEscape(group.label)}}`);
    let idx = 0;
    for (const item of group.items) {
      if (item.status === "rejected" && !includeRejected) continue;
      if ((item.status === "todo" || item.status === "drafted") && !includePending && !item.response.trim()) continue;
      idx++;
      lines.push(
        `\\subsection*{${latexEscape(group.label)} \\textperiodcentered{} Comment ${latexEscape(item.number || String(idx))}}`,
      );
      lines.push("\\textbf{Comment.}\\ " + latexEscape(item.comment.trim()));
      lines.push("");
      const response = renderResponseText(item, includePending);
      lines.push("\\textbf{Response.}\\ " + latexEscape(response));
      if (item.linkedQuote) {
        lines.push("");
        lines.push(
          `\\textit{Manuscript edit:} \\\`\\\`${latexEscape(item.linkedQuote)}''`,
        );
      }
      lines.push("");
    }
  }

  lines.push(latexEscape(opts.closing ?? defaultClosing()));
  lines.push("");
  lines.push("\\end{document}");
  return lines.join("\n");
}

// ───────────────────────────────────────────────────────────────────────────
// HTML (used by the preview + as the print-to-PDF target)

export function formatHtml(
  session: ReviewSession,
  opts: ResponseLetterOptions = {},
): string {
  const title = opts.paperTitle?.trim() || session.title || "Response to Reviewers";
  const includeRejected = opts.includeRejected !== false;
  const includePending = opts.includePending !== false;

  const groups = groupByReviewer(session.items);
  const sections = groups
    .map((g) => {
      const items = g.items.filter((item) => {
        if (item.status === "rejected" && !includeRejected) return false;
        if (
          (item.status === "todo" || item.status === "drafted") &&
          !includePending &&
          !item.response.trim()
        )
          return false;
        return true;
      });
      const blocks = items
        .map((item, i) => {
          const num = escapeHtml(item.number || String(i + 1));
          const comment = escapeHtml(item.comment.trim());
          const response = escapeHtml(renderResponseText(item, includePending));
          const tag = statusTag(item.status);
          const edit = item.linkedQuote
            ? `<p class="rtr-edit">Manuscript edit: &ldquo;${escapeHtml(item.linkedQuote)}&rdquo;</p>`
            : "";
          return `<article class="rtr-item rtr-item-${item.status}">
  <h3>${escapeHtml(g.label)} · Comment ${num} ${tag}</h3>
  <p class="rtr-comment"><strong>Comment.</strong> ${comment}</p>
  <p class="rtr-response"><strong>Response.</strong> ${response}</p>
  ${edit}
</article>`;
        })
        .join("\n");
      return `<section class="rtr-reviewer">\n  <h2>${escapeHtml(g.label)}</h2>\n  ${blocks}\n</section>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Response to Reviewers — ${escapeHtml(title)}</title>
<style>
  body { font: 14.5px/1.55 ui-sans-serif, system-ui, sans-serif; max-width: 760px; margin: 40px auto; color: #1a1a1a; padding: 0 24px; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 36px 0 12px; padding-bottom: 4px; border-bottom: 1px solid #ddd; }
  h3 { font-size: 13px; margin: 18px 0 4px; color: #444; text-transform: uppercase; letter-spacing: 0.06em; }
  p { margin: 6px 0; }
  .rtr-meta { color: #777; font-size: 12px; margin-bottom: 24px; }
  .rtr-comment { color: #333; }
  .rtr-response { color: #111; }
  .rtr-edit { color: #555; font-style: italic; font-size: 12.5px; margin-top: 4px; padding-left: 12px; border-left: 2px solid #c6f24e; }
  .rtr-item { margin-bottom: 18px; }
  .rtr-item-rejected { opacity: 0.85; }
  .rtr-tag { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 600; vertical-align: 1px; margin-left: 6px; text-transform: uppercase; letter-spacing: 0.06em; }
  .rtr-tag.todo { background: #f0e8d8; color: #885500; }
  .rtr-tag.drafted { background: #dfe9f8; color: #1a4585; }
  .rtr-tag.addressed { background: #e5f3c8; color: #3f6c00; }
  .rtr-tag.rejected { background: #fbe2e2; color: #8b1a1a; }
  @media print {
    body { margin: 24px; }
    .rtr-tag { display: none; }
  }
</style>
</head>
<body>
<h1>Response to Reviewers</h1>
<p class="rtr-meta">${escapeHtml(title)}${opts.authorName ? ` · ${escapeHtml(opts.authorName)}` : ""}</p>
<p>${escapeHtml(opts.opening ?? defaultOpening(opts.paperTitle, opts.authorName))}</p>
${sections}
<p>${escapeHtml(opts.closing ?? defaultClosing())}</p>
</body>
</html>`;
}

function statusTag(status: ReviewerItem["status"]): string {
  return `<span class="rtr-tag ${status}">${status}</span>`;
}

function renderResponseText(item: ReviewerItem, includePending: boolean): string {
  const response = item.response.trim();
  if (response) return response;
  if (item.status === "rejected") {
    return "We respectfully decline to make this change. [Add your reasoning here.]";
  }
  if (includePending) {
    return "[Response pending — draft a reply for this comment before exporting the final letter.]";
  }
  return "";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
