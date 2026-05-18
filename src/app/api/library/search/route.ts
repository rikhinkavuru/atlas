import { NextRequest } from "next/server";

export const runtime = "nodejs";

const NIA_BASE = "https://apigcp.trynia.ai/v2";

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-nia-key") || process.env.NIA_API_KEY || "";
  const { query, topK = 8 } = (await req
    .json()
    .catch(() => ({ query: "", topK: 8 }))) as {
    query: string;
    topK?: number;
  };
  const q = (query ?? "").trim().slice(0, 600);
  // Bound topK so a malicious request can't ask Nia for thousands of rows.
  const k = Math.max(1, Math.min(20, Number(topK) || 8));
  if (!key) {
    return Response.json({ error: "no_nia_key", results: [] });
  }
  if (!q) {
    return Response.json({ results: [] });
  }
  try {
    const r = await fetch(`${NIA_BASE}/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "universal",
        query: q,
        top_k: k,
        include_docs: true,
        include_repos: false,
      }),
    });
    if (!r.ok) {
      const text = await r.text();
      return Response.json({
        error: "nia_error",
        status: r.status,
        body: text.slice(0, 240),
        results: [],
      });
    }
    const data = (await r.json()) as any;
    const results = (data.results ?? []).map((res: any) => ({
      title:
        res.metadata?.title ?? res.title ?? res.source_id ?? "Indexed source",
      url: res.metadata?.url ?? res.url ?? "",
      snippet:
        typeof res.chunk === "string"
          ? res.chunk.slice(0, 320)
          : res.metadata?.snippet ?? "",
      sourceId: res.source_id ?? null,
      score: res.score ?? 0,
      authors: res.metadata?.authors ?? [],
      year: res.metadata?.year ?? null,
      doi: res.metadata?.doi ?? null,
    }));
    return Response.json({
      results,
      synthesis: data.synthesis ?? null,
      citations: data.citations ?? null,
    });
  } catch (err) {
    return Response.json(
      { error: "nia_network", message: String(err), results: [] },
      { status: 200 },
    );
  }
}
