import { NextRequest } from "next/server";
import { getStore } from "@/lib/ledger-store";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ shareKey: string }> },
) {
  const { shareKey } = await ctx.params;
  if (!/^[a-zA-Z0-9_-]+$/.test(shareKey)) {
    return Response.json({ ok: false, error: "bad_key" }, { status: 400 });
  }
  const record = await getStore().get(shareKey);
  if (!record) {
    return Response.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  return Response.json({ ok: true, record });
}
