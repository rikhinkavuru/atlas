import { NextRequest } from "next/server";
import { Liveblocks } from "@liveblocks/node";
import { requireTier } from "@/lib/tier";

export const runtime = "nodejs";

/**
 * Mint a Liveblocks access token for the current user.
 *
 * Today we treat every browser as its own anonymous user: a stable id is
 * derived from a header the client sends (the workspaceId, which itself
 * comes from the per-browser crypto keypair). When Clerk is wired in
 * production, we replace the body's `userId` with `auth().userId`.
 *
 * Rooms are namespaced as `atlas:<workspace>:<paperId>` so a single token
 * scope of `atlas:<workspace>:*` admits a user to all of their own papers
 * without leaking access to other workspaces.
 *
 * If LIVEBLOCKS_SECRET_KEY is not set, the route returns 503 so the client
 * can fall back to single-user mode cleanly.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.LIVEBLOCKS_SECRET_KEY;
  if (!secret) {
    return Response.json(
      { ok: false, error: "collab_disabled" },
      { status: 503 },
    );
  }

  // Real-time co-authoring is a Lab tier feature — see /pricing.
  // We check tier BEFORE issuing a Liveblocks token so a free-tier user
  // can't burn through the project's Liveblocks quota.
  const tierBlock = await requireTier(req, "lab");
  if (tierBlock) return tierBlock;

  let body: { userId?: string; name?: string; workspaceId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const userId = (body.userId ?? "").trim();
  const workspaceId = (body.workspaceId ?? "").trim();
  if (!/^[a-zA-Z0-9_-]{4,64}$/.test(userId)) {
    return Response.json(
      { ok: false, error: "userId_invalid" },
      { status: 400 },
    );
  }
  if (!/^[a-zA-Z0-9_-]{4,64}$/.test(workspaceId)) {
    return Response.json(
      { ok: false, error: "workspaceId_invalid" },
      { status: 400 },
    );
  }

  const liveblocks = new Liveblocks({ secret });
  const session = liveblocks.prepareSession(userId, {
    userInfo: {
      name: (body.name ?? "Anonymous").slice(0, 60),
    },
  });
  // Scope token to all rooms within the user's workspace. Liveblocks
  // pattern-matches on the prefix; `*` is the wildcard.
  session.allow(`atlas:${workspaceId}:*`, session.FULL_ACCESS);

  const { status, body: tokenBody } = await session.authorize();
  return new Response(tokenBody, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
