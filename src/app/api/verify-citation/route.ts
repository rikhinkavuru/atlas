import { NextRequest } from "next/server";
import type { CitationCandidate, VerificationResult } from "@/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { query } = (await req.json()) as { query: string };
  const niaKey = req.headers.get("x-nia-key") || process.env.NIA_API_KEY || "";
  const q = (query ?? "").trim();
  if (!q) {
    return Response.json({
      query: q,
      resolved: false,
      best: null,
      candidates: [],
    } satisfies VerificationResult);
  }

  const looksLikeDoi = /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i.test(q);

  const tasks = [
    crossref(q, looksLikeDoi),
    openalex(q, looksLikeDoi),
    semanticScholar(q),
  ];
  if (niaKey) tasks.push(niaSearch(q, niaKey));

  const settled = await Promise.allSettled(tasks);
  const candidates: CitationCandidate[] = [];
  for (const s of settled) {
    if (s.status === "fulfilled") candidates.push(...s.value);
  }

  // Score candidates by token overlap with query. Cap the boost so a query
  // dominated by common words can't artificially saturate confidence.
  const qTokens = new Set(tokens(q));
  for (const c of candidates) {
    const tt = tokens(`${c.title} ${c.authors.join(" ")}`);
    const overlap = tt.filter((t) => qTokens.has(t)).length;
    const boost = Math.min(0.25, overlap / Math.max(qTokens.size, 4));
    c.confidence = Math.min(1, c.confidence + boost);
  }
  candidates.sort((a, b) => b.confidence - a.confidence);

  // Dedup by DOI then by normalised title
  const seen = new Set<string>();
  const dedup = candidates.filter((c) => {
    const key = c.doi || normTitle(c.title);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const best = dedup[0] ?? null;
  const resolved = !!best && best.confidence >= 0.55;

  return Response.json({
    query: q,
    resolved,
    best,
    candidates: dedup.slice(0, 8),
    warning: resolved
      ? undefined
      : "Low-confidence match. Verify before inserting.",
  } satisfies VerificationResult);
}

async function crossref(q: string, isDoi: boolean): Promise<CitationCandidate[]> {
  try {
    const url = isDoi
      ? `https://api.crossref.org/works/${encodeURIComponent(q)}`
      : `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(q)}&rows=5`;
    const r = await fetch(url, {
      headers: { "User-Agent": "Atlas/1.0 (mailto:atlas@example.com)" },
    });
    if (!r.ok) return [];
    const json = (await r.json()) as any;
    const items = isDoi ? [json.message] : (json.message?.items ?? []);
    return items.map((m: any): CitationCandidate => ({
      title: Array.isArray(m.title) ? m.title[0] : (m.title ?? ""),
      authors: (m.author ?? []).map(
        (a: any) => `${a.given ?? ""} ${a.family ?? ""}`.trim(),
      ),
      year:
        m.issued?.["date-parts"]?.[0]?.[0] ??
        m.published?.["date-parts"]?.[0]?.[0] ??
        null,
      doi: m.DOI ?? null,
      url: m.URL ?? (m.DOI ? `https://doi.org/${m.DOI}` : ""),
      source: "crossref",
      confidence: 0.45,
    }));
  } catch {
    return [];
  }
}

async function openalex(q: string, isDoi: boolean): Promise<CitationCandidate[]> {
  try {
    const url = isDoi
      ? `https://api.openalex.org/works/doi:${encodeURIComponent(q)}`
      : `https://api.openalex.org/works?search=${encodeURIComponent(q)}&per_page=5&select=id,doi,title,publication_year,authorships,primary_location`;
    const r = await fetch(url);
    if (!r.ok) return [];
    const json = (await r.json()) as any;
    const items = isDoi ? [json] : (json.results ?? []);
    return items.map((m: any): CitationCandidate => ({
      title: m.title ?? m.display_name ?? "",
      authors: (m.authorships ?? []).map(
        (a: any) => a.author?.display_name ?? "",
      ),
      year: m.publication_year ?? null,
      doi: m.doi?.replace("https://doi.org/", "") ?? null,
      url:
        m.primary_location?.landing_page_url ??
        (m.doi ? m.doi : m.id ?? ""),
      source: "openalex",
      confidence: 0.5,
    }));
  } catch {
    return [];
  }
}

async function semanticScholar(q: string): Promise<CitationCandidate[]> {
  try {
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(q)}&limit=5&fields=title,authors,year,externalIds,url`;
    const r = await fetch(url);
    if (!r.ok) return [];
    const json = (await r.json()) as any;
    return (json.data ?? []).map((m: any): CitationCandidate => ({
      title: m.title ?? "",
      authors: (m.authors ?? []).map((a: any) => a.name ?? ""),
      year: m.year ?? null,
      doi: m.externalIds?.DOI ?? null,
      url:
        m.url ??
        (m.externalIds?.DOI
          ? `https://doi.org/${m.externalIds.DOI}`
          : m.externalIds?.ArXiv
            ? `https://arxiv.org/abs/${m.externalIds.ArXiv}`
            : ""),
      source: "semanticscholar",
      confidence: 0.5,
    }));
  } catch {
    return [];
  }
}

async function niaSearch(q: string, key: string): Promise<CitationCandidate[]> {
  try {
    const r = await fetch("https://apigcp.trynia.ai/v2/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "universal",
        query: q,
        top_k: 6,
        include_docs: true,
        include_repos: false,
      }),
    });
    if (!r.ok) return [];
    const json = (await r.json()) as any;
    const results: any[] = json.results ?? [];
    return results.map((res: any): CitationCandidate => ({
      title: res.metadata?.title ?? res.title ?? res.source_id ?? "Indexed source",
      authors: res.metadata?.authors ?? [],
      year: res.metadata?.year ?? null,
      doi: res.metadata?.doi ?? null,
      url: res.metadata?.url ?? res.url ?? "",
      source: "nia",
      confidence: Math.min(0.95, 0.6 + (res.score ?? 0) * 0.3),
      snippet:
        typeof res.chunk === "string"
          ? res.chunk.slice(0, 280)
          : res.metadata?.snippet,
    }));
  } catch {
    return [];
  }
}

function tokens(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function normTitle(t: string) {
  return t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 100);
}
