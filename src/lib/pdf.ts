"use client";

// PDF extraction tuned for academic papers. Three behaviours that the naive
// "concatenate textContent items in PDF.js order" path gets wrong:
//
//   1. Two-column layouts interleave columns when read in document order.
//      We sort items into rows by Y-coord, then split each row into columns
//      by detecting wide horizontal gaps, then read column-first.
//
//   2. Titles and section headings are at larger font sizes than body. We
//      use the transform matrix (font height = matrix[3]) to detect them
//      structurally instead of guessing from text length.
//
//   3. Page headers, footers, and page numbers repeat across pages. We
//      drop top- and bottom-band content that's <= 4 words and matches a
//      page-numbering or short-running-header pattern.
//
// Math: we cannot recover authoring-time LaTeX from a typeset PDF without
// OCR + math recognition. As a tractable middle ground, we detect clusters
// of math glyphs (greek letters, operators, sub/superscripts) and wrap
// them in `<span class="math math-inline" data-tex="...">` so the editor
// flags them for human re-entry.

let pdfjsLib: typeof import("pdfjs-dist") | null = null;

async function loadPdfjs() {
  if (pdfjsLib) return pdfjsLib;
  const mod = await import("pdfjs-dist");
  const opts = (
    mod as unknown as {
      GlobalWorkerOptions: { workerSrc: string };
      version: string;
    }
  ).GlobalWorkerOptions;
  if (opts && !opts.workerSrc) {
    opts.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${
      (mod as unknown as { version: string }).version
    }/build/pdf.worker.min.mjs`;
  }
  pdfjsLib = mod;
  return mod;
}

export interface PdfExtractResult {
  title: string;
  authors: string;
  pages: number;
  text: string;
  html: string;
  /** Diagnostics for the UI — surfaces what we extracted and what we lost. */
  stats: {
    blocks: number;
    headings: number;
    columns: 1 | 2;
    mathFragments: number;
    droppedHeaderFooter: number;
    figuresExtracted: number;
    figuresSkipped: number;
  };
}

interface PositionedSpan {
  str: string;
  /** Bottom-left x (PDF coords). */
  x: number;
  /** Bottom-left y (PDF coords; higher = closer to top of page). */
  y: number;
  /** Font height in PDF units (from transform matrix). */
  size: number;
  width: number;
  hasEOL: boolean;
}

interface LineRun {
  y: number;
  size: number;
  text: string;
  /** "left" / "right" column tag in a 2-column page; "full" otherwise. */
  column: "left" | "right" | "full";
}

// Math-glyph detector covering the unicode blocks that show up most often
// in academic PDFs:
//   U+0370–03FF  Greek and Coptic           (α β γ Σ Δ Ω …)
//   U+2070–209F  Superscripts and Subscripts ( ⁰¹² ₀₁₂ )
//   U+2100–214F  Letterlike Symbols          (ℎ ℝ ℕ ℙ ℓ ∂)
//   U+2190–21FF  Arrows                      (← → ⇒ ⇔ ↦)
//   U+2200–22FF  Mathematical Operators      (∀ ∃ ∈ ∉ ∑ ∏ ∫ ∞ ≈ ≤ ≥)
//   U+27C0–27EF  Misc Mathematical Symbols-A (⟨ ⟩ ⟦ ⟧)
//   U+2A00–2AFF  Supplemental Math Operators
//   U+1D400–1D7FF Mathematical Alphanumeric  (𝐀 𝐁 𝐶 𝓘 𝕂)
// Plus the conventional Latin operators (±×÷√) which are scattered.
//
// Why broad: PDF.js gives us only the typeset glyph stream, not source
// LaTeX. Matching widely catches more real math; the density heuristic
// (≥40% math glyphs in a 4+ char run with no whitespace) suppresses the
// stray Greek letter in prose.
const MATH_GLYPH =
  /[Ͱ-Ͽ⁰-₟℀-⅏←-⇿∀-⋿⟀-⟯⨀-⫿\u{1D400}-\u{1D7FF}±×÷√]/u;
const PAGE_NUM = /^(?:\d{1,3}|[ivxlcdm]+)$/i;

export async function extractPdf(file: File): Promise<PdfExtractResult> {
  const pdfjs = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const meta = await doc.getMetadata().catch(() => null);
  const pages = doc.numPages;

  let columnsObserved: 1 | 2 = 1;
  let droppedHeaderFooter = 0;
  let mathFragments = 0;
  let figuresSkipped = 0;
  const extractedFigures: { pageIndex: number; dataUrl: string; index: number }[] = [];
  const pageLines: LineRun[][] = [];

  // Sample of large-font text from page 1 — used for title/author detection.
  const headerCandidates: PositionedSpan[] = [];

  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    const spans: PositionedSpan[] = [];
    for (const item of content.items as unknown[]) {
      const it = item as {
        str?: string;
        transform?: number[];
        width?: number;
        height?: number;
        hasEOL?: boolean;
      };
      if (typeof it.str !== "string" || !it.transform) continue;
      const s = it.str;
      if (!s.trim()) continue;
      // transform[4] = x, transform[5] = y (baseline), transform[3] = font height.
      spans.push({
        str: s,
        x: it.transform[4],
        y: it.transform[5],
        size: Math.abs(it.transform[3]) || it.height || 10,
        width: it.width ?? 0,
        hasEOL: !!it.hasEOL,
      });
    }

    if (i === 1) {
      // Top quarter of page-1, sorted by font size descending — for title.
      // We deliberately keep this band tight (top 25%, was 45%) so a paper
      // whose abstract uses the same font size as the title doesn't collide:
      // the title-detection joiner concatenates anything sharing the max
      // font size, and a band that grabs the abstract would overflow the
      // length sanity check and silently fail.
      const top = spans.filter((s) => s.y > viewport.height * 0.75);
      top.sort((a, b) => b.size - a.size);
      headerCandidates.push(...top);
    }

    // Drop running headers/footers — short text near top/bottom that
    // matches a page-number/journal-name pattern.
    const topBand = viewport.height * 0.95;
    const bottomBand = viewport.height * 0.05;
    const filtered: PositionedSpan[] = [];
    for (const sp of spans) {
      const inFooterBand = sp.y < bottomBand;
      const inHeaderBand = sp.y > topBand;
      if (inFooterBand || inHeaderBand) {
        const t = sp.str.trim();
        if (PAGE_NUM.test(t) || t.split(/\s+/).length <= 4) {
          droppedHeaderFooter++;
          continue;
        }
      }
      filtered.push(sp);
    }

    const { lines, columns } = layoutToLines(filtered, viewport.width);
    if (columns > columnsObserved) columnsObserved = columns as 1 | 2;
    pageLines.push(lines);

    // Figure extraction — walk the page's operator list, find every
    // paintImageXObject call, retrieve the corresponding bitmap, and
    // rasterise it to a base64 data URL. We embed inline so the imported
    // paper is fully self-contained; large bitmaps (over a megabyte
    // encoded) get skipped + counted to avoid bloating localStorage.
    try {
      const opList = await page.getOperatorList();
      const ops = opList.fnArray;
      const args = opList.argsArray;
      const OPS = (pdfjs as unknown as { OPS: Record<string, number> }).OPS;
      const PAINT_IMG = OPS?.paintImageXObject;
      const PAINT_INLINE = OPS?.paintInlineImageXObject;
      // Dedupe within a page — logos and watermarks paint multiple times.
      const seenImages = new Set<string>();
      if (PAINT_IMG != null || PAINT_INLINE != null) {
        for (let opIdx = 0; opIdx < ops.length; opIdx++) {
          const op = ops[opIdx];
          if (op !== PAINT_IMG && op !== PAINT_INLINE) continue;
          const imgName = args[opIdx]?.[0];
          if (typeof imgName !== "string") continue;
          if (seenImages.has(imgName)) continue;
          seenImages.add(imgName);
          try {
            const img = await retrieveImage(page, imgName);
            if (!img) {
              figuresSkipped++;
              continue;
            }
            const dataUrl = imageToDataUrl(img);
            if (!dataUrl || dataUrl.length > 1_500_000) {
              figuresSkipped++;
              continue;
            }
            extractedFigures.push({
              pageIndex: i,
              dataUrl,
              index: extractedFigures.length + 1,
            });
          } catch {
            figuresSkipped++;
          }
        }
      }
    } catch {
      // Operator list unavailable for this page — keep going, the text
      // extraction already succeeded.
    }
  }

  // Flatten + heading-classify. Median body-text size is the baseline; any
  // line >= 1.18× that is a heading candidate.
  const allLines = pageLines.flat();
  const bodySize = medianSize(allLines);
  const headingThreshold = bodySize * 1.18;

  const titleGuess =
    (meta?.info as Record<string, unknown> | null | undefined)?.["Title"] &&
    typeof (meta!.info as Record<string, unknown>)["Title"] === "string"
      ? ((meta!.info as Record<string, unknown>)["Title"] as string).trim()
      : guessTitleFromHeader(headerCandidates);
  const authors = guessAuthors(
    ((meta?.info as Record<string, unknown> | null | undefined)?.[
      "Author"
    ] as string) ?? "",
    headerCandidates,
  );

  // Group consecutive non-heading lines on the same page+column into
  // paragraphs. Break paragraphs on heading lines OR when the next line's
  // size differs by > 25% (commonly footnotes / captions).
  const blocks: { kind: "h2" | "p"; text: string }[] = [];
  for (const lines of pageLines) {
    let current: LineRun[] = [];
    const flushAsPara = () => {
      if (current.length === 0) return;
      const text = mergeLines(current);
      if (!text.trim()) {
        current = [];
        return;
      }
      blocks.push({ kind: "p", text });
      current = [];
    };
    for (const line of lines) {
      const isHeading =
        line.size >= headingThreshold ||
        SECTION_RE.test(line.text.trim()) ||
        NUMBERED_SECTION_RE.test(line.text.trim());
      if (isHeading) {
        flushAsPara();
        blocks.push({
          kind: "h2",
          text: line.text.trim(),
        });
      } else {
        current.push(line);
      }
    }
    flushAsPara();
  }

  // Build HTML. Inline math wrap fires here so we count fragments accurately.
  const headerHtml = [
    `<h1>${escapeHtml(titleGuess || file.name.replace(/\.pdf$/i, ""))}</h1>`,
    authors ? `<p><em>${escapeHtml(authors)}</em></p>` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const bodyParts: string[] = [headerHtml];
  let headingsRendered = 0;
  for (const b of blocks) {
    if (b.kind === "h2") {
      bodyParts.push(`<h2>${escapeHtml(b.text)}</h2>`);
      headingsRendered++;
    } else {
      const { html, mathCount } = paragraphHtml(b.text);
      mathFragments += mathCount;
      bodyParts.push(html);
    }
  }

  // Append any extracted figures at the end with a placeholder caption.
  // We don't try to interleave them with the prose — figure-caption
  // pairing in PDFs needs visual layout reasoning beyond what we have.
  // Authors can drag-and-drop them into position in the editor and
  // edit the caption to match.
  for (const f of extractedFigures) {
    // The Figure NodeView auto-prepends "Figure N." so the figcaption text
    // shouldn't repeat the word "Figure" — otherwise the visible caption
    // reads "Figure 3. Figure imported from page…".
    bodyParts.push(
      `<figure class="atlas-figure" data-src="${f.dataUrl}"><img src="${f.dataUrl}" alt="Imported figure"/><figcaption>Imported from page ${f.pageIndex}. Edit this caption.</figcaption></figure>`,
    );
  }

  const fullText = blocks.map((b) => b.text).join("\n\n");
  return {
    title: titleGuess || file.name.replace(/\.pdf$/i, ""),
    authors,
    pages,
    text: fullText,
    html: bodyParts.join("\n"),
    stats: {
      blocks: blocks.length,
      headings: headingsRendered,
      columns: columnsObserved,
      mathFragments,
      droppedHeaderFooter,
      figuresExtracted: extractedFigures.length,
      figuresSkipped,
    },
  };
}

/**
 * Retrieve an image bitmap by name from a PDF.js page. Image objects can
 * resolve asynchronously (PDF.js streams them), so we wrap the callback-
 * style `objs.get(name, cb)` API in a Promise. Returns null when the image
 * isn't available (e.g. the page didn't actually paint that XObject yet).
 */
async function retrieveImage(
  page: {
    objs: {
      get: (name: string, cb?: (img: unknown) => void) => unknown;
      has?: (name: string) => boolean;
    };
  },
  imgName: string,
): Promise<{
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
  kind?: number;
} | null> {
  return await new Promise((resolve) => {
    let resolved = false;
    const settle = (img: unknown) => {
      if (resolved) return;
      resolved = true;
      const obj = img as {
        width?: number;
        height?: number;
        data?: Uint8ClampedArray | Uint8Array;
        kind?: number;
      } | null;
      if (
        obj &&
        typeof obj.width === "number" &&
        typeof obj.height === "number" &&
        obj.data
      ) {
        resolve({
          width: obj.width,
          height: obj.height,
          data: obj.data,
          kind: obj.kind,
        });
      } else {
        resolve(null);
      }
    };
    // Two-mode get: sometimes the image is already resolved (returns sync);
    // sometimes it's pending and the callback fires later.
    try {
      const sync = page.objs.get(imgName, settle);
      if (sync) settle(sync);
    } catch {
      settle(null);
    }
    // Bail out after 5s so we don't hang the import on a stuck image.
    setTimeout(() => settle(null), 5_000);
  });
}

/**
 * Convert a PDF.js image bitmap to a base64 PNG data URL. PDF.js uses
 * three kinds of image data internally:
 *   1 = GRAYSCALE (single-channel 8-bit)
 *   2 = RGB (3-channel)
 *   3 = RGBA (4-channel)
 * We normalize each to RGBA before writing to a canvas. The encoded size
 * cap is enforced by the caller.
 */
function imageToDataUrl(img: {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
  kind?: number;
}): string | null {
  if (typeof document === "undefined") return null;
  const { width, height, data, kind } = img;
  if (!width || !height) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const imageData = ctx.createImageData(width, height);
  const out = imageData.data;
  const pixels = width * height;
  // kind 1 = GRAYSCALE, kind 2 = RGB, kind 3 = RGBA (current PDF.js
  // ImageKind enum). Older versions used GRAYSCALE_8BPP / RGB_24BPP /
  // RGBA_32BPP — same semantics. We treat absent kind as RGBA if the
  // buffer length matches.
  const inputBytesPerPixel = inferBytesPerPixel(data.length, pixels, kind);
  if (!inputBytesPerPixel) return null;
  for (let i = 0, j = 0; i < pixels; i++) {
    if (inputBytesPerPixel === 1) {
      const v = data[i] ?? 0;
      out[j++] = v;
      out[j++] = v;
      out[j++] = v;
      out[j++] = 255;
    } else if (inputBytesPerPixel === 3) {
      out[j++] = data[i * 3] ?? 0;
      out[j++] = data[i * 3 + 1] ?? 0;
      out[j++] = data[i * 3 + 2] ?? 0;
      out[j++] = 255;
    } else if (inputBytesPerPixel === 4) {
      out[j++] = data[i * 4] ?? 0;
      out[j++] = data[i * 4 + 1] ?? 0;
      out[j++] = data[i * 4 + 2] ?? 0;
      out[j++] = data[i * 4 + 3] ?? 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  // PNG keeps line art crisp; JPEG could be smaller but we'd lose
  // alpha + introduce artefacts on diagrams.
  try {
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

function inferBytesPerPixel(
  byteLength: number,
  pixels: number,
  kind: number | undefined,
): 1 | 3 | 4 | null {
  if (kind === 1) return 1;
  if (kind === 2) return 3;
  if (kind === 3) return 4;
  // No kind hint — try the buffer-length heuristic.
  if (byteLength === pixels) return 1;
  if (byteLength === pixels * 3) return 3;
  if (byteLength === pixels * 4) return 4;
  return null;
}

// ───────────────────────────────────────────────────────────────────────────

const SECTION_RE =
  /^(?:abstract|introduction|background|related work|preliminaries|method(?:s|ology)?|approach|results?|experiments?|evaluation|discussion|limitations?|conclusions?|acknowledg(?:e)?ments?|references|bibliography)\s*:?$/i;
const NUMBERED_SECTION_RE = /^\d+(?:\.\d+){0,3}\.?\s+[A-Z][\w\s\-–:]{2,80}$/;

/**
 * Layout a page's positioned spans into linear lines + detect 2-column.
 *
 * Algorithm:
 *  1. Sort spans top-down by y, then left-to-right by x.
 *  2. Group spans into rows: spans within ~half a font-height of each other
 *     vertically belong to the same row.
 *  3. For each row, check if there's a wide horizontal gap (> 8% of page
 *     width) somewhere — if so, treat the page as 2-column for this row
 *     and tag left/right halves accordingly.
 *  4. Read all left-column lines first, then all right-column lines.
 */
function layoutToLines(
  spans: PositionedSpan[],
  pageWidth: number,
): { lines: LineRun[]; columns: 1 | 2 } {
  if (spans.length === 0) return { lines: [], columns: 1 };
  // PDF y increases upward; we want top-down so flip via -y.
  spans.sort((a, b) => b.y - a.y || a.x - b.x);

  // Row-grouping tolerance. We use 1.2× the median font size: anything closer
  // than that vertically belongs to the same row. (Previous 0.6× value was
  // too tight for papers with non-standard leading — short consecutive lines
  // at the same baseline could spuriously split.)
  const rowGap =
    medianSize(spans.map((s) => ({ size: s.size }) as unknown as LineRun)) *
    1.2;
  const rows: PositionedSpan[][] = [];
  let current: PositionedSpan[] = [];
  let currentY = spans[0].y;
  for (const sp of spans) {
    if (Math.abs(sp.y - currentY) > rowGap) {
      if (current.length > 0) rows.push(current);
      current = [sp];
      currentY = sp.y;
    } else {
      current.push(sp);
    }
  }
  if (current.length > 0) rows.push(current);

  const colGapThreshold = pageWidth * 0.08;
  let twoCol = 0;
  const leftLines: LineRun[] = [];
  const rightLines: LineRun[] = [];
  const fullLines: LineRun[] = [];

  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    let split = -1;
    for (let i = 1; i < row.length; i++) {
      const gap = row[i].x - (row[i - 1].x + row[i - 1].width);
      if (gap > colGapThreshold) {
        split = i;
        break;
      }
    }
    const meanSize =
      row.reduce((acc, s) => acc + s.size, 0) / Math.max(1, row.length);
    if (split > 0) {
      twoCol++;
      const leftStr = row
        .slice(0, split)
        .map((s) => s.str)
        .join("")
        .trim();
      const rightStr = row
        .slice(split)
        .map((s) => s.str)
        .join("")
        .trim();
      if (leftStr)
        leftLines.push({ y: row[0].y, size: meanSize, text: leftStr, column: "left" });
      if (rightStr)
        rightLines.push({
          y: row[split].y,
          size: meanSize,
          text: rightStr,
          column: "right",
        });
    } else {
      const txt = row
        .map((s) => s.str)
        .join("")
        .trim();
      if (txt)
        fullLines.push({ y: row[0].y, size: meanSize, text: txt, column: "full" });
    }
  }

  // 2-column flag requires the majority of rows to show a column split — a
  // single 2-column figure in an otherwise 1-column paper shouldn't flip the
  // whole document. 0.55 is empirically a good cut-off across NeurIPS / Cell
  // / Nature samples without over-claiming.
  const isTwoCol = twoCol > rows.length * 0.55;
  if (isTwoCol) {
    // Read left column then right column, dropping the full-width lines that
    // weren't column-split (typically wide headings/footers we already
    // filtered, or page-spanning equations).
    return {
      lines: [...fullLines, ...leftLines, ...rightLines],
      columns: 2,
    };
  }
  // 1-column: merge everything in y-order.
  const all = [...leftLines, ...rightLines, ...fullLines];
  all.sort((a, b) => b.y - a.y);
  return { lines: all, columns: 1 };
}

function medianSize(arr: { size: number }[]): number {
  if (arr.length === 0) return 10;
  const sizes = arr.map((a) => a.size).sort((a, b) => a - b);
  return sizes[Math.floor(sizes.length / 2)];
}

function mergeLines(lines: LineRun[]): string {
  // Re-glue lines into a paragraph. Trailing-hyphen joins should drop the
  // hyphen (commonly inserted by PDF justification): "tomo-" + "graphy"
  // → "tomography".
  const parts: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].text;
    if (i > 0) {
      const prev = parts[parts.length - 1];
      if (prev && /[a-z]-$/.test(prev)) {
        parts[parts.length - 1] = prev.slice(0, -1) + t;
        continue;
      }
      parts.push(" ");
    }
    parts.push(t);
  }
  return parts.join("").replace(/\s{2,}/g, " ").trim();
}

function paragraphHtml(text: string): { html: string; mathCount: number } {
  // Wrap dense math-glyph runs in inline math placeholders. A run is any
  // sequence of 4+ non-whitespace characters using a math-friendly
  // alphabet (alnum + the math unicode blocks + common math punctuation).
  // We wrap when ≥40% of the run is dedicated math glyphs — that filters
  // casual single-Greek-letters-in-prose ("α-helix"), while still catching
  // mid-sentence equations like "x ≥ y² + z".
  let mathCount = 0;
  const re =
    /[A-Za-z0-9Ͱ-Ͽ⁰-₟℀-⅏←-⇿∀-⋿⟀-⟯⨀-⫿\u{1D400}-\u{1D7FF}±×÷√()\[\]{}+\-=^_.\\/,]{4,}/gu;
  const escaped = escapeHtml(text);
  const wrapped = escaped.replace(re, (m) => {
    const mathCharCount = countMatches(m, MATH_GLYPH_GLOBAL);
    if (mathCharCount / m.length < 0.4) return m;
    if (m.split(/\s+/).length > 1) return m; // multi-word — probably prose
    mathCount++;
    return `<span class="math math-inline" data-tex="${escapeAttr(m)}"></span>`;
  });
  return { html: `<p>${wrapped}</p>`, mathCount };
}

const MATH_GLYPH_GLOBAL =
  /[Ͱ-Ͽ⁰-₟℀-⅏←-⇿∀-⋿⟀-⟯⨀-⫿\u{1D400}-\u{1D7FF}±×÷√]/gu;

function countMatches(s: string, re: RegExp): number {
  let n = 0;
  re.lastIndex = 0;
  while (re.exec(s) !== null) n++;
  return n;
}

function guessTitleFromHeader(spans: PositionedSpan[]): string {
  // Largest-font text near the top of page 1, joined if multiple adjacent
  // spans share the same font size.
  if (spans.length === 0) return "";
  const maxSize = spans[0].size;
  const titleSpans = spans
    .filter((s) => Math.abs(s.size - maxSize) < 0.5)
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const joined = titleSpans
    .map((s) => s.str.trim())
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (joined.length < 6 || joined.length > 240) return "";
  return joined;
}

function guessAuthors(metaAuthor: string, headerSpans: PositionedSpan[]): string {
  const trimmed = metaAuthor.trim();
  if (trimmed && trimmed.length < 200 && /[A-Za-z]/.test(trimmed)) {
    return trimmed;
  }
  // Look for a line just below the title font-size cluster that contains a
  // name-list pattern (capitalized words, possibly separated by commas, with
  // optional superscripts that we strip).
  if (headerSpans.length === 0) return "";
  const maxSize = headerSpans[0].size;
  const subTitle = headerSpans.filter(
    (s) => s.size < maxSize && s.size > maxSize * 0.55,
  );
  if (subTitle.length === 0) return "";
  // Take the top 3 sub-title lines by y, join, and look for the names.
  subTitle.sort((a, b) => b.y - a.y);
  const candidate = subTitle
    .slice(0, 8)
    .map((s) => s.str.trim())
    .join(" ")
    .replace(/[\d†‡§∗*]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (
    /\b[A-Z][a-z]+ [A-Z][a-z]+(?:[,\s]+[A-Z][a-z]+\s+[A-Z][a-z]+)+/.test(
      candidate,
    )
  ) {
    return candidate.slice(0, 200);
  }
  return "";
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
