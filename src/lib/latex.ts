type VenueTemplate = {
  id: string;
  name: string;
  documentClass: string;
  packages: string[];
  before: string;
  after: string;
};

const TEMPLATES: Record<string, VenueTemplate> = {
  generic: {
    id: "generic",
    name: "Generic article",
    documentClass: "\\documentclass[11pt]{article}",
    packages: [
      "\\usepackage[margin=1in]{geometry}",
      "\\usepackage{microtype}",
      "\\usepackage{graphicx}",
      "\\usepackage{amsmath,amssymb}",
      "\\usepackage[hidelinks]{hyperref}",
      "\\usepackage{natbib}",
    ],
    before: "\\begin{document}\n\\maketitle\n",
    after:
      "\n\\bibliographystyle{plainnat}\n\\bibliography{references}\n\\end{document}\n",
  },
  neurips: {
    id: "neurips",
    name: "NeurIPS (recent template)",
    documentClass: "\\documentclass{article}",
    packages: [
      "% Replace with the venue's official style file before submission",
      "\\usepackage[final]{neurips_2024}",
      "\\usepackage{microtype}",
      "\\usepackage{graphicx}",
      "\\usepackage{amsmath,amssymb}",
      "\\usepackage[hidelinks]{hyperref}",
      "\\usepackage{natbib}",
    ],
    before: "\\begin{document}\n\\maketitle\n",
    after:
      "\n\\bibliographystyle{plainnat}\n\\bibliography{references}\n\\end{document}\n",
  },
  acl: {
    id: "acl",
    name: "ACL / EMNLP (recent template)",
    documentClass: "\\documentclass[11pt]{article}",
    packages: [
      "\\usepackage{acl}",
      "\\usepackage{microtype}",
      "\\usepackage{graphicx}",
      "\\usepackage{amsmath,amssymb}",
      "\\usepackage[hidelinks]{hyperref}",
    ],
    before: "\\begin{document}\n\\maketitle\n",
    after: "\n\\bibliography{custom}\n\\bibliographystyle{acl_natbib}\n\\end{document}\n",
  },
  ieee: {
    id: "ieee",
    name: "IEEE conference (IEEEtran)",
    documentClass: "\\documentclass[conference]{IEEEtran}",
    packages: [
      "\\usepackage{cite}",
      "\\usepackage{amsmath,amssymb}",
      "\\usepackage{graphicx}",
      "\\usepackage[hidelinks]{hyperref}",
    ],
    before: "\\begin{document}\n\\maketitle\n",
    after: "\n\\bibliographystyle{IEEEtran}\n\\bibliography{references}\n\\end{document}\n",
  },
};

export function listVenueTemplates() {
  return Object.values(TEMPLATES).map((t) => ({ id: t.id, name: t.name }));
}

export interface LatexExportProvenance {
  /** Absolute /api/badge?... URL embedded as a header comment so the .tex
   *  file carries proof-of-provenance into arXiv / Overleaf / wherever. */
  badgeUrl: string;
  /** Absolute /verify URL the badge links back to. */
  verifyUrl: string;
  /** Short ledger root hash for a human-readable identifier in the comment. */
  rootHash: string;
}

export function htmlToLaTeX(
  html: string,
  title: string,
  authors: string,
  venue: string = "generic",
  provenance?: LatexExportProvenance,
): { tex: string; bib: string } {
  const tpl = TEMPLATES[venue] ?? TEMPLATES.generic;

  const citations: { key: string; url: string }[] = [];

  // Capture math equations first — both block (display) and inline — and
  // replace with LaTeX delimiters using the preserved tex source. Doing
  // this before the generic tag stripper keeps the LaTeX intact.
  let body = html
    .replace(
      /<div class="math math-display"([^>]*)>[\s\S]*?<\/div>/gi,
      (_m, attrs: string) => {
        const texMatch = /data-tex="([^"]*)"/.exec(attrs);
        const labelMatch = /data-label="([^"]*)"/.exec(attrs);
        const tex = decodeAttr(texMatch?.[1] ?? "");
        if (!tex) return "";
        const label = (labelMatch?.[1] ?? "").replace(/[^A-Za-z0-9_:\-]/g, "");
        // Labeled display-math is promoted to a numbered \begin{equation}
        // block so \ref{eq:foo} resolves to the right "(N)" number.
        // Unlabeled stays unnumbered with \[ … \].
        if (label) {
          return `\n\\begin{equation}\\label{${label}}\n${tex}\n\\end{equation}\n`;
        }
        return `\n\\[${tex}\\]\n`;
      },
    )
    .replace(
      /<span class="math math-inline"\s+data-tex="([^"]*)"[^>]*>[\s\S]*?<\/span>/gi,
      (_m, t) => `$${decodeAttr(t)}$`,
    )
    // Cross-references: <span class="atlas-xref" data-target="fig:foo">
    // Figure 3</span> → \ref{fig:foo}. We trust the label spelling and
    // strip the visible text — pdflatex will substitute the real number
    // from the \label that the figure block emits.
    .replace(
      /<span class="atlas-xref"\s+data-target="([^"]*)"[^>]*>[\s\S]*?<\/span>/gi,
      (_m, target) => {
        const safe = (target ?? "").replace(/[^A-Za-z0-9_:\-]/g, "");
        return safe ? `\\ref{${safe}}` : "??";
      },
    )
    // Captioned tables: an Atlas TableCaption immediately follows a table.
    // We rewrite the pair into a \begin{table}\centering ... \caption \label
    // \end{table} block. The tabular body comes from a regex over the
    // table's rows because the venue template already includes the
    // `tabular` environment; we don't need to invent column specs here
    // (default to `l*` based on column count).
    .replace(
      /<table[^>]*>([\s\S]*?)<\/table>\s*<div class="atlas-table-caption"\s*([^>]*)>([\s\S]*?)<\/div>/gi,
      (_m, tableInner: string, captionAttrs: string, captionInner: string) => {
        const labelMatch = /data-table-caption-label="([^"]*)"/.exec(
          captionAttrs,
        );
        const captionDataMatch = /data-caption="([^"]*)"/.exec(captionAttrs);
        // Strip the auto-numbered "Table N." prefix span and any other
        // tags from the visible caption; prefer data-caption when present.
        const rawCaption = (
          captionDataMatch?.[1] ??
          captionInner
            .replace(
              /<span class="atlas-table-caption-prefix"[^>]*>[\s\S]*?<\/span>/i,
              "",
            )
            .replace(/<[^>]+>/g, "")
        )
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .trim();
        const safeLabel =
          (labelMatch?.[1] ?? "").replace(/[^A-Za-z0-9_:\-]/g, "");
        const labelLine = safeLabel ? `\\label{${safeLabel}}\n` : "";
        const tabular = htmlTableToTabular(tableInner);
        return `\n\\begin{table}[t]\n\\centering\n${tabular}\n\\caption{${tex(rawCaption)}}\n${labelLine}\\end{table}\n`;
      },
    )
    // Figures: <figure class="atlas-figure" data-label="…">
    //   <img src="…" alt="…" /><figcaption>…</figcaption>
    // </figure>
    //
    // We extract src + alt + caption + optional data-label, slugify the
    // label for \label{fig:slug}, and emit a centered figure block. The
    // graphic placeholder uses `\includegraphics` which compiles cleanly
    // against arXiv-friendly preambles (graphicx is already included by
    // every venue template). For remote URLs we fall back to a comment
    // pointing at the URL so the author knows to download + relink.
    .replace(
      /<figure\s+class="atlas-figure"[\s\S]*?<\/figure>/gi,
      (block: string) => {
        const src = extractAttr(block, "data-src") ?? extractAttr(block, "src") ?? "";
        const alt = extractAttr(block, "alt") ?? "";
        const captionMatch = /<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i.exec(
          block,
        );
        // Strip the auto-numbered "Figure N." prefix the NodeView injects
        // before the user-typed caption text — the LaTeX \caption will
        // re-add the numbering via \begin{figure}.
        const rawCaption = (captionMatch?.[1] ?? "")
          .replace(/<span class="atlas-figure-prefix"[^>]*>[\s\S]*?<\/span>/i, "")
          .replace(/<[^>]+>/g, "")
          .trim();
        const label = extractAttr(block, "data-label");
        const width = extractAttr(block, "data-width");
        const isRemote = /^https?:\/\//i.test(src);
        const widthOpt =
          width && Number(width) < 1
            ? `[width=${Math.round(Number(width) * 100)}%\\linewidth]`
            : "[width=\\linewidth]";
        const graphic = isRemote
          ? `% Atlas: remote image — download and relink before submission\n% Source: ${src}\n\\includegraphics${widthOpt}{${slugifyKey(alt || rawCaption || "figure")}}`
          : `\\includegraphics${widthOpt}{${src}}`;
        // LaTeX accepts colons / dashes / underscores in \label{…}; we
        // preserve those so the conventional "fig:overview" form survives
        // the round-trip. Drop anything else (whitespace, punctuation).
        const safeLabel = (label ?? "").replace(/[^A-Za-z0-9_:\-]/g, "");
        const labelLine = safeLabel ? `\\label{${safeLabel}}\n` : "";
        return `\n\\begin{figure}[t]\n\\centering\n${graphic}\n\\caption{${tex(rawCaption)}}\n${labelLine}\\end{figure}\n`;
      },
    )
    .replace(/<span class="citation"[^>]*>\[(.*?)\]<\/span>\s*/gi, (_m, key) => {
      const url = extractAttr(_m, "data-url");
      if (key && !citations.find((c) => c.key === key)) {
        citations.push({ key, url: url ?? "" });
      }
      return ` \\cite{${slugifyKey(key)}} `;
    })
    .replace(/<span class="comment-mark"[^>]*>([\s\S]*?)<\/span>/gi, "$1")
    // Heading rewrites — capture optional `data-label` attr and emit
    // `\label{…}` after the section command so cross-refs resolve. h1 is
    // conventionally the paper title in our editor (kept inside the doc);
    // we don't re-emit \title here because the wrapping header logic does
    // that — just drop it from the body so we don't duplicate it.
    .replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, () => "")
    .replace(/<h2([^>]*)>([\s\S]*?)<\/h2>/gi, (_m, attrs: string, t: string) => {
      const label = labelFromAttrs(attrs);
      return `\\section{${tex(t)}}${label ? `\\label{${label}}` : ""}\n`;
    })
    .replace(/<h3([^>]*)>([\s\S]*?)<\/h3>/gi, (_m, attrs: string, t: string) => {
      const label = labelFromAttrs(attrs);
      return `\\subsection{${tex(t)}}${label ? `\\label{${label}}` : ""}\n`;
    })
    .replace(/<strong>([\s\S]*?)<\/strong>/gi, "\\textbf{$1}")
    .replace(/<b>([\s\S]*?)<\/b>/gi, "\\textbf{$1}")
    .replace(/<em>([\s\S]*?)<\/em>/gi, "\\emph{$1}")
    .replace(/<i>([\s\S]*?)<\/i>/gi, "\\emph{$1}")
    .replace(/<code>([\s\S]*?)<\/code>/gi, "\\texttt{$1}")
    .replace(
      /<pre><code>([\s\S]*?)<\/code><\/pre>/gi,
      (_m, c) => `\n\\begin{verbatim}\n${c}\n\\end{verbatim}\n`,
    )
    .replace(
      /<blockquote>([\s\S]*?)<\/blockquote>/gi,
      (_m, q) => `\n\\begin{quote}\n${stripTags(q)}\n\\end{quote}\n`,
    )
    .replace(/<ul>([\s\S]*?)<\/ul>/gi, (_m, inner) => {
      const items = (inner.match(/<li>([\s\S]*?)<\/li>/gi) ?? [])
        .map((li: string) => `  \\item ${stripTags(li.replace(/<\/?li>/gi, ""))}`)
        .join("\n");
      return `\n\\begin{itemize}\n${items}\n\\end{itemize}\n`;
    })
    .replace(/<ol>([\s\S]*?)<\/ol>/gi, (_m, inner) => {
      const items = (inner.match(/<li>([\s\S]*?)<\/li>/gi) ?? [])
        .map((li: string) => `  \\item ${stripTags(li.replace(/<\/?li>/gi, ""))}`)
        .join("\n");
      return `\n\\begin{enumerate}\n${items}\n\\end{enumerate}\n`;
    })
    .replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "\\href{$1}{$2}")
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_m, t) => `\n${tex(t)}\n`)
    .replace(/<br\s*\/?>/gi, " \\\\ ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "\\&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

  const titleLine = title ? `\\title{${tex(title)}}\n` : "";
  const authorLine = `\\author{${tex(authors || "Anonymous Authors")}}\n`;

  // Provenance header — a 5-line LaTeX comment block at the top of the .tex
  // so anyone who reads the source (arXiv, reviewers, collaborators) sees
  // the verifiable Atlas link without a single visible change to the rendered
  // PDF. Stripped if no provenance is supplied so anonymous submissions stay
  // anonymous.
  const provHeader = provenance
    ? [
        "% ── Atlas Honesty Badge ──────────────────────────────────────────",
        `% Live provenance: ${provenance.verifyUrl}`,
        `% Badge SVG:       ${provenance.badgeUrl}`,
        `% Ledger root:     ${provenance.rootHash}`,
        "% Every AI-assisted edit in this paper is hash-chained and signed.",
        "% ─────────────────────────────────────────────────────────────────",
        "",
      ].join("\n")
    : "";

  const sections: string[] = [];
  if (provHeader) sections.push(provHeader.trimEnd());
  sections.push(
    tpl.documentClass,
    tpl.packages.join("\n"),
    "",
    titleLine,
    authorLine,
    tpl.before,
    body.trim(),
    tpl.after,
  );
  const tex_doc = sections.join("\n");

  const bib = citations
    .map(
      (c) =>
        `@misc{${slugifyKey(c.key)},\n  title  = {${escapeBibTex(c.key)}},\n  howpublished = {${c.url ? `\\url{${c.url}}` : "—"}},\n  year   = {${new Date().getFullYear()}}\n}`,
    )
    .join("\n\n");

  return { tex: tex_doc, bib };
}

function tex(s: string) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "\\&")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/\$/g, "\\$")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\^/g, "\\^{}")
    .replace(/~/g, "\\~{}")
    .replace(/</g, "\\textless{}")
    .replace(/>/g, "\\textgreater{}");
}

function stripTags(s: string) {
  return tex(s.replace(/<[^>]+>/g, ""));
}

function slugifyKey(s: string) {
  return s.replace(/[^A-Za-z0-9]/g, "").slice(0, 32) || "ref";
}

function escapeBibTex(s: string) {
  return s.replace(/[{}]/g, "");
}

function extractAttr(html: string, name: string): string | null {
  const m = new RegExp(`${name}="([^"]*)"`).exec(html);
  return m ? m[1] : null;
}

/**
 * Convert an HTML <table>'s inner rows/cells into a LaTeX tabular block.
 *
 * We pick the column count from the first row (the most reliable signal
 * we have without parsing column-specs), default to left-aligned `l`
 * for every column, and emit cells separated by `&` with `\\` line
 * terminators. Cell content is run through `tex()` to escape special
 * characters; embedded paragraph / list / span markup is reduced via
 * stripTags.
 */
/** Extract a sanitised label attribute value from a raw HTML attribute
 *  string. Returns "" when no `data-label` is present or it doesn't survive
 *  the slug allow-list. */
function labelFromAttrs(attrs: string): string {
  const m = /data-label="([^"]*)"/.exec(attrs);
  if (!m) return "";
  return m[1].replace(/[^A-Za-z0-9_:\-]/g, "");
}

function htmlTableToTabular(html: string): string {
  // Pull every <tr>…</tr> in order. We handle both <th> and <td> cells.
  const rowMatches = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  if (rowMatches.length === 0) {
    return "\\begin{tabular}{l}\n\\end{tabular}";
  }
  const rows: string[][] = rowMatches.map((row) => {
    const cells = (row.match(/<t[hd][^>]*>[\s\S]*?<\/t[hd]>/gi) ?? []).map(
      (cell) =>
        tex(
          cell
            .replace(/<[^>]+>/g, "")
            .replace(/&nbsp;/g, " ")
            .replace(/\s+/g, " ")
            .trim(),
        ),
    );
    return cells;
  });
  const cols = Math.max(1, ...rows.map((r) => r.length));
  const spec = "l".repeat(cols);
  const lines = rows.map((r) => {
    // Pad short rows with empty cells so column alignment stays consistent.
    while (r.length < cols) r.push("");
    return r.slice(0, cols).join(" & ") + " \\\\";
  });
  return `\\begin{tabular}{${spec}}\n\\hline\n${lines.join("\n")}\n\\hline\n\\end{tabular}`;
}

/** Decode `data-tex` HTML entities back to LaTeX source. The Tiptap
 *  serialiser writes `data-tex="a &amp; b"`; we want the literal `a & b`
 *  for the LaTeX output. */
function decodeAttr(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'");
}
