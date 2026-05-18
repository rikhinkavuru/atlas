import { NextRequest } from "next/server";

export const runtime = "nodejs";

const NIA_BASE = "https://apigcp.trynia.ai/v2";

export async function GET(req: NextRequest) {
  const key = req.headers.get("x-nia-key") || process.env.NIA_API_KEY || "";
  const id = new URL(req.url).searchParams.get("id");
  if (!key || !id) {
    return Response.json({ error: "no_key_or_id" }, { status: 400 });
  }
  try {
    const r = await fetch(`${NIA_BASE}/sources/${id}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!r.ok) {
      const text = await r.text();
      return Response.json(
        { error: "nia_error", status: r.status, body: text.slice(0, 240) },
        { status: 200 },
      );
    }
    const data = (await r.json()) as any;
    return Response.json({
      id: data.id,
      status: data.status ?? "unknown",
      type: data.type,
      title:
        data.display_name ??
        data.metadata?.title ??
        data.identifier ??
        data.url,
      url: data.url ?? data.identifier ?? "",
    });
  } catch (err) {
    return Response.json(
      { error: "nia_network", message: String(err) },
      { status: 200 },
    );
  }
}
