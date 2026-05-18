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

  let body = html
    .replace(/<span class="citation"[^>]*>\[(.*?)\]<\/span>\s*/gi, (_m, key) => {
      const url = extractAttr(_m, "data-url");
      if (key && !citations.find((c) => c.key === key)) {
        citations.push({ key, url: url ?? "" });
      }
      return ` \\cite{${slugifyKey(key)}} `;
    })
    .replace(/<span class="comment-mark"[^>]*>([\s\S]*?)<\/span>/gi, "$1")
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_m, t) => `\\title{${tex(t)}}\n`)
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_m, t) => `\\section{${tex(t)}}\n`)
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_m, t) => `\\subsection{${tex(t)}}\n`)
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
