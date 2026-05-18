import { NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * Dynamic SVG badge researchers can embed in arXiv comments, README files,
 * PDFs, or wherever else. Reads authorship breakdown from query params and
 * renders a wide, brand-aligned badge that links back to the public verifier.
 *
 * Query params (all 0..100, optional — default to a worked example):
 *   ?author=44&sourced=32&ai=16&imported=8&paper=AtlasRAG&hash=9b27d1
 *   &style=dark|light  (default: dark)
 */

interface Params {
  author: number;
  sourced: number;
  ai: number;
  imported: number;
  paper: string;
  hash: string;
  style: "dark" | "light";
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  // Each segment is clamped to [0, 100], then the four are normalised inside
  // render() so no malicious input can blow up the bar widths or sum.
  const params: Params = {
    author: clamp(parseFloat(sp.get("author") ?? "44")),
    sourced: clamp(parseFloat(sp.get("sourced") ?? "32")),
    ai: clamp(parseFloat(sp.get("ai") ?? "16")),
    imported: clamp(parseFloat(sp.get("imported") ?? "8")),
    paper: sanitizeText(sp.get("paper") ?? "Atlas paper", 40),
    hash: sanitizeText(sp.get("hash") ?? "verified", 14),
    style: sp.get("style") === "light" ? "light" : "dark",
  };
  const svg = render(params);
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=300, s-maxage=600",
    },
  });
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function sanitizeText(s: string, max: number): string {
  // Strip control characters that could break SVG, then truncate.
  return s.replace(/[\u0000-\u001F\u007F]/g, "").slice(0, max);
}

function render({
  author,
  sourced,
  ai,
  imported,
  paper,
  hash,
  style,
}: Params): string {
  const W = 640;
  const H = 88;
  const palette = style === "light"
    ? {
        bg: "#ffffff",
        border: "#e4e4e4",
        fg: "#0a0a0a",
        muted: "#525252",
        subtle: "#8a8a8a",
        accent: "#4d7c0f",
        accentSoft: "#ecfccb",
        info: "#1857B6",
        warning: "#b45309",
      }
    : {
        bg: "#0a0a0a",
        border: "#232323",
        fg: "#f5f5f5",
        muted: "#a1a1a1",
        subtle: "#6b6b6b",
        accent: "#c6f24e",
        accentSoft: "#1e2a0c",
        info: "#38bdf8",
        warning: "#f59e0b",
      };

  // Normalise to 100 in case the four don't sum exactly.
  const total = Math.max(0.0001, author + sourced + ai + imported);
  const a = (author / total) * 100;
  const s = (sourced / total) * 100;
  const u = (ai / total) * 100;
  const i = (imported / total) * 100;

  const barX = 24;
  const barW = W - 48 - 220;
  const barY = 50;
  const barH = 14;

  let cursor = barX;
  const segments: string[] = [];
  const push = (width: number, color: string) => {
    if (width <= 0) return;
    segments.push(
      `<rect x="${cursor.toFixed(2)}" y="${barY}" width="${width.toFixed(2)}" height="${barH}" fill="${color}" />`,
    );
    cursor += width;
  };
  const w = (pct: number) => (pct / 100) * barW;
  push(w(a), palette.fg);
  push(w(s), palette.accent);
  push(w(u), palette.info);
  push(w(i), palette.warning);

  const num = (n: number) => Math.round(n).toString() + "%";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Atlas Honesty Badge: ${num(a)} author, ${num(s)} sourced AI, ${num(u)} unsourced AI, ${num(i)} imported">
  <title>Atlas Honesty Badge · ${escapeXml(paper)}</title>
  <desc>AI disclosure for ${escapeXml(paper)}: ${num(a)} author-written, ${num(s)} AI with source, ${num(u)} AI without source, ${num(i)} imported. Verified by Atlas.</desc>
  <rect x="0" y="0" width="${W}" height="${H}" rx="10" ry="10" fill="${palette.bg}" stroke="${palette.border}" stroke-width="1"/>

  <!-- Atlas mark -->
  <g transform="translate(20 14)">
    <rect x="0" y="0" width="22" height="22" rx="5" fill="${palette.accent}" />
    <text x="11" y="15" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="11" fill="${palette.bg}" font-weight="700">◢◣</text>
  </g>

  <!-- Title row -->
  <text x="54" y="26" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="14" font-weight="600" fill="${palette.fg}">Atlas Honesty Badge</text>
  <text x="54" y="40" font-family="ui-monospace, Menlo, monospace" font-size="10" letter-spacing="2" fill="${palette.subtle}">AI · DISCLOSURE · VERIFIED</text>

  <!-- Title-row right meta -->
  <text x="${W - 24}" y="26" text-anchor="end" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="11" fill="${palette.muted}">${escapeXml(truncate(paper, 38))}</text>
  <text x="${W - 24}" y="40" text-anchor="end" font-family="ui-monospace, Menlo, monospace" font-size="10" fill="${palette.subtle}">root · ${escapeXml(hash)}</text>

  <!-- Bar -->
  <rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="3" fill="${style === "dark" ? "#1c1c1c" : "#f4f4f5"}" />
  ${segments.join("\n  ")}
  <rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="3" fill="none" stroke="${palette.border}" stroke-width="1" />

  <!-- Legend -->
  <g transform="translate(${barX + barW + 20} ${barY - 4})" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" font-size="10">
    <g><rect x="0" y="0" width="8" height="8" rx="1" fill="${palette.fg}"/><text x="12" y="8" fill="${palette.muted}">Author <tspan fill="${palette.fg}" font-weight="600">${num(a)}</tspan></text></g>
    <g transform="translate(0 14)"><rect x="0" y="0" width="8" height="8" rx="1" fill="${palette.accent}"/><text x="12" y="8" fill="${palette.muted}">Sourced <tspan fill="${palette.fg}" font-weight="600">${num(s)}</tspan></text></g>
    <g transform="translate(0 28)"><rect x="0" y="0" width="8" height="8" rx="1" fill="${palette.info}"/><text x="12" y="8" fill="${palette.muted}">Unsourced <tspan fill="${palette.fg}" font-weight="600">${num(u)}</tspan></text></g>
  </g>
</svg>`;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
