import { NextRequest } from "next/server";

export const runtime = "nodejs";

const NIA_BASE = "https://apigcp.trynia.ai/v2";

function getKey(req: NextRequest) {
  return req.headers.get("x-nia-key") || process.env.NIA_API_KEY || "";
}

// GET — list all indexed sources
export async function GET(req: NextRequest) {
  const key = getKey(req);
  if (!key) {
    return Response.json({ error: "no_nia_key", sources: [] }, { status: 200 });
  }
  try {
    const r = await fetch(`${NIA_BASE}/sources?limit=50`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!r.ok) {
      const text = await r.text();
      return Response.json(
        { error: "nia_error", status: r.status, body: text },
        { status: 200 },
      );
    }
    const data = (await r.json()) as any;
    const sources = (data.sources ?? data.data ?? data.items ?? data ?? []).map(
      (s: any) => normaliseSource(s),
    );
    return Response.json({ sources });
  } catch (err) {
    return Response.json(
      { error: "nia_network", message: String(err), sources: [] },
      { status: 200 },
    );
  }
}

// POST — index a new URL
export async function POST(req: NextRequest) {
  const key = getKey(req);
  if (!key) {
    return Response.json(
      { error: "no_nia_key", message: "Add a Nia key in Settings to index sources." },
      { status: 400 },
    );
  }
  const { url, displayName } = (await req.json()) as {
    url: string;
    displayName?: string;
  };
  const u = (url ?? "").trim();
  if (!u) {
    return Response.json({ error: "no_url" }, { status: 400 });
  }
  const type = detectType(u);
  const body: Record<string, any> = {
    type,
    url: u,
    add_as_global_source: false,
  };
  if (displayName) body.display_name = displayName;
  if (type === "documentation") body.only_main_content = true;

  try {
    const r = await fetch(`${NIA_BASE}/sources`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const text = await r.text();
      return Response.json(
        { error: "nia_error", status: r.status, body: text },
        { status: 200 },
      );
    }
    const data = (await r.json()) as any;
    return Response.json({ source: normaliseSource(data) });
  } catch (err) {
    return Response.json(
      { error: "nia_network", message: String(err) },
      { status: 200 },
    );
  }
}

// DELETE — remove an indexed source. ?id=<source_id>
export async function DELETE(req: NextRequest) {
  const key = getKey(req);
  if (!key) {
    return Response.json({ error: "no_nia_key" }, { status: 400 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "no_id" }, { status: 400 });
  try {
    const r = await fetch(`${NIA_BASE}/sources/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${key}` },
    });
    return Response.json({ ok: r.ok });
  } catch (err) {
    return Response.json(
      { error: "nia_network", message: String(err) },
      { status: 200 },
    );
  }
}

function detectType(url: string): "research_paper" | "documentation" | "repository" {
  if (/arxiv\.org\/(abs|pdf)\//i.test(url)) return "research_paper";
  if (/biorxiv\.org|medrxiv\.org|nature\.com|sciencemag\.org|cell\.com|nejm\.org|jamanetwork\.com|sciencedirect\.com|wiley\.com|springer\.com|acm\.org|ieee\.org|openreview\.net/i.test(url)) {
    return "research_paper";
  }
  if (/github\.com\/[^/]+\/[^/]+\/?$/i.test(url)) return "repository";
  return "documentation";
}

function normaliseSource(s: any) {
  return {
    id: s.id ?? s.source_id ?? s.identifier ?? "",
    type: s.type ?? "",
    status: s.status ?? "unknown",
    title:
      s.display_name ??
      s.metadata?.title ??
      s.identifier ??
      s.url ??
      "Indexed source",
    url: s.url ?? s.metadata?.url ?? s.identifier ?? "",
    createdAt: s.created_at ?? null,
    metadata: s.metadata ?? null,
  };
}
