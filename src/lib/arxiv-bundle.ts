import JSZip from "jszip";
import type { Paper, ProvenanceLedger } from "@/types";
import {
  htmlToLaTeX,
  listVenueTemplates,
  type LatexExportProvenance,
} from "./latex";
import { exportLedgerJsonLd } from "./provenance";

/**
 * arXiv submission bundle assembler.
 *
 * Produces a single .zip that's drag-droppable into the arXiv submission
 * interface. Contents:
 *
 *   paper.tex             — the paper compiled from the workspace HTML,
 *                            with the Atlas honesty badge as a header
 *                            comment when a ledger is present.
 *   references.bib        — every citation captured during drafting.
 *   atlas-ledger.jsonld   — the full signed ledger, in case the venue or
 *                            a reviewer wants the offline copy of what
 *                            /verify would have re-walked.
 *   README.md             — submission notes: which figures need
 *                            manual download/relink, the venue template
 *                            used, the badge URL, and what's intentionally
 *                            NOT included.
 *
 * The bundle is pure client-side — paper text never traverses our server.
 * The user picks Save As… in their browser when the download fires.
 *
 * Remote-URL figures are flagged in the README; arXiv requires graphics to
 * be local files, so the user has to download each remote image, drop it
 * next to paper.tex, and re-point the \includegraphics line. We name the
 * placeholders predictably so a manual relink is straightforward.
 */

export interface ArxivBundleOptions {
  paper: Paper;
  authors: string;
  venueTemplate: string;
  ledger?: ProvenanceLedger;
  /** When true, embed the public ledger badge URL as a .tex header
   *  comment (visible only in the source). Default true when a ledger is
   *  present. */
  embedBadge?: boolean;
}

export interface BundleResult {
  blob: Blob;
  fileName: string;
  warnings: string[];
  filesIncluded: string[];
}

export async function buildArxivBundle(
  opts: ArxivBundleOptions,
): Promise<BundleResult> {
  const { paper, authors, venueTemplate, ledger } = opts;
  const warnings: string[] = [];
  const filesIncluded: string[] = [];

  // Provenance header for the .tex: only embed when a ledger exists AND
  // the user opted in. `embedBadge` defaults to true when ledger present.
  const embedBadge = opts.embedBadge ?? !!ledger;
  let prov: LatexExportProvenance | undefined;
  if (embedBadge && ledger && ledger.events.length > 0) {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const breakdown = summariseAuthorship(ledger);
    const total = Math.max(
      1,
      breakdown.author + breakdown.ai + breakdown.sourced + breakdown.imported,
    );
    const pct = (n: number) => Math.round((n / total) * 100);
    const params = new URLSearchParams({
      paper: paper.title.slice(0, 40),
      author: String(pct(breakdown.author)),
      sourced: String(pct(breakdown.sourced)),
      ai: String(pct(breakdown.ai)),
      imported: String(pct(breakdown.imported)),
      hash: ledger.rootHash.slice(0, 8),
    });
    prov = {
      badgeUrl: `${origin}/api/badge?${params.toString()}`,
      verifyUrl: `${origin}/verify`,
      rootHash: ledger.rootHash.slice(0, 16),
    };
  }

  const { tex, bib } = htmlToLaTeX(
    paper.html,
    paper.title,
    authors,
    venueTemplate,
    prov,
  );

  const remoteFigures = findRemoteFigures(paper.html);
  if (remoteFigures.length > 0) {
    warnings.push(
      `${remoteFigures.length} figure${remoteFigures.length === 1 ? "" : "s"} reference remote URLs (e.g. ${remoteFigures[0].slice(0, 80)}). arXiv requires local graphics — download each into the bundle root, then update the \\includegraphics paths in paper.tex.`,
    );
  }

  // We ship references.bib alongside paper.tex and leave the
  // \bibliography{references} line in the template — arXiv's pipeline
  // handles BibTeX cleanly. Authors who prefer an inline references list
  // can run /command palette → Generate references… and paste the output.
  const zip = new JSZip();
  zip.file("paper.tex", tex);
  filesIncluded.push("paper.tex");

  if (bib.trim()) {
    zip.file("references.bib", bib);
    filesIncluded.push("references.bib");
  }

  if (ledger && ledger.events.length > 0) {
    const ledgerJsonLd = JSON.stringify(exportLedgerJsonLd(ledger), null, 2);
    zip.file("atlas-ledger.jsonld", ledgerJsonLd);
    filesIncluded.push("atlas-ledger.jsonld");
  }

  zip.file(
    "README.md",
    buildReadme({
      paperTitle: paper.title,
      authors,
      venueTemplate,
      filesIncluded,
      remoteFigures,
      ledger,
      prov,
    }),
  );
  filesIncluded.push("README.md");

  const blob = await zip.generateAsync({ type: "blob" });
  return {
    blob,
    fileName: `${slugifyTitle(paper.title)}-arxiv.zip`,
    warnings,
    filesIncluded,
  };
}

export function listVenueTemplateOptions() {
  return listVenueTemplates();
}

// ───────────────────────────────────────────────────────────────────────────

function buildReadme(args: {
  paperTitle: string;
  authors: string;
  venueTemplate: string;
  filesIncluded: string[];
  remoteFigures: string[];
  ledger?: ProvenanceLedger;
  prov?: LatexExportProvenance;
}): string {
  const lines: string[] = [];
  lines.push(`# arXiv submission bundle — ${args.paperTitle}`);
  lines.push("");
  lines.push(`Generated by Atlas. Authors: ${args.authors}`);
  lines.push("");
  lines.push("## What's in this zip");
  lines.push("");
  for (const f of args.filesIncluded) {
    lines.push(`- \`${f}\``);
  }
  lines.push("");
  lines.push(`## Template: ${args.venueTemplate}`);
  lines.push("");
  lines.push(
    "The .tex file uses Atlas's venue template wrapper. If you need a venue-specific class file (e.g. \\documentclass{neurips_2026}), drop it next to paper.tex and adjust the preamble.",
  );
  lines.push("");

  if (args.remoteFigures.length > 0) {
    lines.push("## ⚠️ Remote figures — action required");
    lines.push("");
    lines.push(
      "arXiv requires graphics to be local files included in the bundle. The following remote URLs are referenced in your paper:",
    );
    lines.push("");
    for (const url of args.remoteFigures) {
      lines.push(`- ${url}`);
    }
    lines.push("");
    lines.push(
      "For each, download the image into this directory and update the matching `\\includegraphics{…}` path in paper.tex.",
    );
    lines.push("");
  }

  if (args.prov) {
    lines.push("## Provenance ledger");
    lines.push("");
    lines.push(
      `This paper carries an Atlas provenance ledger. Reviewers can verify it independently at ${args.prov.verifyUrl}.`,
    );
    lines.push("");
    lines.push(`- Live badge: ${args.prov.badgeUrl}`);
    lines.push(`- Ledger root: ${args.prov.rootHash}`);
    if (args.ledger) {
      lines.push(`- Events: ${args.ledger.events.length}`);
    }
    lines.push("");
    lines.push(
      "The signed JSON-LD copy is in `atlas-ledger.jsonld`. The same data can be dropped into /verify to re-walk the chain without trusting any Atlas server.",
    );
    lines.push("");
  }

  lines.push("## Submission steps");
  lines.push("");
  lines.push("1. Compile locally first: `pdflatex paper && bibtex paper && pdflatex paper && pdflatex paper`.");
  lines.push("2. arXiv → New submission → upload this zip (or the files individually).");
  lines.push("3. Pick the right primary subject + cross-list categories.");
  lines.push("4. Paste your title, authors, abstract, and comments fields.");
  lines.push("5. Submit. arXiv generates the PDF; review it before the on-hold timer expires.");
  lines.push("");
  lines.push("## What's NOT in this bundle");
  lines.push("");
  lines.push("- Pre-trained model weights, datasets, raw experiment outputs.");
  lines.push("- arXiv-specific category metadata — pick these in the web UI.");
  lines.push(
    "- A venue-specific class file (NeurIPS, ICML, etc.). Drop yours next to paper.tex.",
  );
  lines.push("");
  return lines.join("\n");
}

function summariseAuthorship(ledger: ProvenanceLedger): {
  author: number;
  ai: number;
  sourced: number;
  imported: number;
} {
  let author = 0;
  let ai = 0;
  let sourced = 0;
  let imported = 0;
  for (const ev of ledger.events) {
    const w = (ev.before?.length ?? 0) + (ev.after?.length ?? 0);
    if (ev.kind === "author") author += Math.max(20, w);
    else if (ev.kind === "import") imported += w;
    else if (ev.kind === "ai-cite" || (ev.sources && ev.sources.length))
      sourced += w;
    else ai += w;
  }
  return { author, ai, sourced, imported };
}

function findRemoteFigures(html: string): string[] {
  const out: string[] = [];
  const re = /<figure[^>]*data-src="(https?:\/\/[^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    out.push(m[1]);
  }
  // Also catch the case where the src attr ended up on the inner img.
  const re2 = /<figure[^>]*atlas-figure[\s\S]*?<img[^>]+src="(https?:\/\/[^"]+)"/gi;
  while ((m = re2.exec(html))) {
    if (!out.includes(m[1])) out.push(m[1]);
  }
  return out;
}

function slugifyTitle(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "paper"
  );
}
