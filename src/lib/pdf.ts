"use client";

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
}

export async function extractPdf(file: File): Promise<PdfExtractResult> {
  const pdfjs = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const meta = await doc.getMetadata().catch(() => null);
  const pages = doc.numPages;
  const pageTexts: string[] = [];
  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((it: any) =>
        typeof it.str === "string" ? it.str + (it.hasEOL ? "\n" : " ") : "",
      )
      .join("");
    pageTexts.push(text.replace(/\s+\n/g, "\n").replace(/ {2,}/g, " "));
  }

  const info = (meta?.info ?? null) as Record<string, unknown> | null;
  const title =
    (info?.["Title"] as string) ||
    deriveTitleFromText(pageTexts[0] ?? "") ||
    file.name.replace(/\.pdf$/i, "");
  const authors =
    (info?.["Author"] as string) ||
    deriveAuthors(pageTexts[0] ?? "") ||
    "";

  const fullText = pageTexts.join("\n\n");
  const html = textToHtml(title, authors, fullText);
  return { title, authors, pages, text: fullText, html };
}

function deriveTitleFromText(firstPage: string): string | null {
  const lines = firstPage
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 12 && l.length < 200);
  const candidates = lines.slice(0, 6);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0];
}

function deriveAuthors(firstPage: string): string | null {
  const lines = firstPage.split(/\n+/).map((l) => l.trim());
  for (const l of lines.slice(0, 20)) {
    if (/^[A-Z][a-z]+ [A-Z][a-z]+(?:,\s*[A-Z][a-z]+ [A-Z][a-z]+)+$/.test(l)) {
      return l;
    }
  }
  return null;
}

function textToHtml(title: string, authors: string, text: string): string {
  const headerHtml = [
    `<h1>${escapeHtml(title)}</h1>`,
    authors ? `<p><em>${escapeHtml(authors)}</em></p>` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const blocks = text
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  const sectionRegex =
    /^(?:abstract|introduction|background|related work|method(?:s|ology)?|approach|results?|experiments?|evaluation|discussion|limitations?|conclusion|references)\s*:?$/i;
  const numberedSectionRegex = /^\d+(?:\.\d+)?\.?\s+[A-Z][A-Za-z ]{3,80}$/;

  const out: string[] = [headerHtml];
  for (const b of blocks) {
    const flat = b.replace(/\s+/g, " ").trim();
    if (sectionRegex.test(flat)) {
      out.push(`<h2>${escapeHtml(toTitleCase(flat))}</h2>`);
    } else if (numberedSectionRegex.test(flat)) {
      out.push(`<h2>${escapeHtml(flat)}</h2>`);
    } else {
      out.push(`<p>${escapeHtml(flat)}</p>`);
    }
  }
  return out.join("\n");
}

function toTitleCase(s: string) {
  return s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
