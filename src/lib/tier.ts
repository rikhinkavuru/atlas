import type { NextRequest } from "next/server";

/**
 * Atlas tier resolution.
 *
 * Source of truth (in order):
 *   1. ATLAS_FORCE_TIER env var (dev / staging override; never set in prod)
 *   2. Clerk publicMetadata.tier (production billing → user record)
 *   3. "free" (default)
 *
 * Today nothing actually charges money — the gating routes still return
 * the correct 402 / 403 status when tier is insufficient, so the wiring
 * exists for the billing backend to flip on later without further code
 * changes in route handlers.
 */

export type Tier = "free" | "pro" | "lab" | "enterprise";

const TIER_ORDER: Record<Tier, number> = {
  free: 0,
  pro: 1,
  lab: 2,
  enterprise: 3,
};

export function tierAtLeast(actual: Tier, min: Tier): boolean {
  return TIER_ORDER[actual] >= TIER_ORDER[min];
}

function parseTier(raw: unknown): Tier {
  if (raw === "pro" || raw === "lab" || raw === "enterprise" || raw === "free")
    return raw;
  return "free";
}

/**
 * Resolve the tier for the current request. We read from Clerk's auth() if
 * available, falling back to env-var override for local development.
 *
 * Pure-server function — call from API routes only. Clerk is dynamically
 * imported so this lib doesn't bring Clerk into the bundle when collab /
 * publish routes are the only consumers.
 */
export async function userTier(_req: NextRequest): Promise<Tier> {
  const override = process.env.ATLAS_FORCE_TIER;
  if (override) return parseTier(override.toLowerCase());

  try {
    // Dynamic import keeps Clerk out of routes that haven't opted in.
    const { auth } = await import("@clerk/nextjs/server");
    const { sessionClaims } = await auth();
    if (sessionClaims && typeof sessionClaims === "object") {
      // Clerk lets the dashboard expose publicMetadata on the session claim.
      const meta = (sessionClaims as { publicMetadata?: unknown })
        .publicMetadata;
      if (meta && typeof meta === "object" && "tier" in meta) {
        return parseTier((meta as { tier: unknown }).tier);
      }
    }
  } catch {
    /* Clerk not configured → fall through to free */
  }
  return "free";
}

/**
 * Helper for route handlers. Returns null when the user has at least `min`
 * tier; otherwise returns a JSON Response the handler should return verbatim.
 *
 * Usage:
 *   const block = await requireTier(req, "pro");
 *   if (block) return block;
 *   // ...proceed with the gated action
 */
export async function requireTier(
  req: NextRequest,
  min: Tier,
): Promise<Response | null> {
  const tier = await userTier(req);
  if (tierAtLeast(tier, min)) return null;
  return Response.json(
    {
      ok: false,
      error: "tier_insufficient",
      tier,
      required: min,
      message:
        min === "pro"
          ? "This action requires the Pro tier. Open Settings to upgrade."
          : min === "lab"
            ? "This action requires the Lab tier (multi-author workspace)."
            : "This action requires the Enterprise tier.",
    },
    { status: 402 },
  );
}
