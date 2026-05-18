import { NextRequest } from "next/server";
import type { SearchResult } from "@/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  // Hard-cap query length so a 100KB ?q= can't be forwarded to upstream APIs.
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 600);
  if (!q) return Response.json({ results: [] });

  const results: SearchResult[] = [];

  const tasks = await Promise.allSettled([
    arxivSearch(q),
    semanticScholarSearch(q),
    wikipediaSearch(q),
    duckduckgoInstant(q),
  ]);

  for (const t of tasks) {
    if (t.status === "fulfilled") results.push(...t.value);
  }

  // De-dup by URL, cap at 18
  const seen = new Set<string>();
  const dedup = results.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  return Response.json({ results: dedup.slice(0, 18) });
}

async function arxivSearch(q: string): Promise<SearchResult[]> {
  try {
    const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(
      q,
    )}&start=0&max_results=6&sortBy=relevance`;
    const r = await fetch(url, { headers: { "User-Agent": "Atlas/1.0" } });
    if (!r.ok) return [];
    const xml = await r.text();
    const entries = xml.split("<entry>").slice(1);
    return entries.map((e) => {
      const title = (e.match(/<title>([\s\S]*?)<\/title>/) ?? [, ""])[1]
        .trim()
        .replace(/\s+/g, " ");
      const link = (e.match(/<id>([\s\S]*?)<\/id>/) ?? [, ""])[1].trim();
      const summary = (e.match(/<summary>([\s\S]*?)<\/summary>/) ?? [, ""])[1]
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 280);
      return {
        title,
        url: link,
        snippet: summary,
        source: "arXiv",
      };
    });
  } catch {
    return [];
  }
}

async function semanticScholarSearch(q: string): Promise<SearchResult[]> {
  try {
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(
      q,
    )}&limit=6&fields=title,abstract,url,year,authors`;
    const r = await fetch(url, { headers: { "User-Agent": "Atlas/1.0" } });
    if (!r.ok) return [];
    const data = (await r.json()) as {
      data?: Array<{
        title?: string;
        abstract?: string | null;
        url?: string;
        year?: number;
        authors?: { name: string }[];
      }>;
    };
    return (data.data ?? []).map((p) => ({
      title: p.title ?? "Untitled",
      url: p.url ?? "",
      snippet:
        (p.abstract ?? "").slice(0, 280) ||
        `${(p.authors ?? []).map((a) => a.name).slice(0, 3).join(", ")}${p.year ? ` · ${p.year}` : ""}`,
      source: "Semantic Scholar",
    })).filter((r) => r.url);
  } catch {
    return [];
  }
}

async function wikipediaSearch(q: string): Promise<SearchResult[]> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      q,
    )}&format=json&srlimit=4&origin=*`;
    const r = await fetch(url);
    if (!r.ok) return [];
    const data = (await r.json()) as {
      query?: { search?: Array<{ title: string; snippet: string }> };
    };
    return (data.query?.search ?? []).map((p) => ({
      title: p.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, "_"))}`,
      snippet: p.snippet.replace(/<[^>]+>/g, ""),
      source: "Wikipedia",
    }));
  } catch {
    return [];
  }
}

async function duckduckgoInstant(q: string): Promise<SearchResult[]> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_redirect=1&no_html=1`;
    const r = await fetch(url);
    if (!r.ok) return [];
    const data = (await r.json()) as {
      AbstractText?: string;
      AbstractURL?: string;
      Heading?: string;
      RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
    };
    const results: SearchResult[] = [];
    if (data.AbstractURL && data.AbstractText) {
      results.push({
        title: data.Heading || q,
        url: data.AbstractURL,
        snippet: data.AbstractText,
        source: "DuckDuckGo",
      });
    }
    for (const t of data.RelatedTopics ?? []) {
      if (t.FirstURL && t.Text) {
        results.push({
          title: t.Text.split(" - ")[0],
          url: t.FirstURL,
          snippet: t.Text,
          source: "DuckDuckGo",
        });
      }
      if (results.length >= 4) break;
    }
    return results;
  } catch {
    return [];
  }
}
