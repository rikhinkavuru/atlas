import type { Tier } from "./tier";

/**
 * Stripe billing helpers. Atlas treats Stripe as optional infrastructure —
 * if STRIPE_SECRET_KEY is unset, billing endpoints return 503 and the
 * Settings UI shows a "not configured" fallback. The product still runs at
 * the user's currently-resolved tier (override env / Clerk metadata).
 *
 * Price IDs come from env vars so the same code runs against test mode
 * (sk_test_…) and production (sk_live_…) without rebuilding.
 *
 * The webhook handler is responsible for updating Clerk publicMetadata.tier
 * after a successful checkout — that's the source of truth tier.ts reads.
 */

export const billingEnabled =
  typeof process !== "undefined" && !!process.env.STRIPE_SECRET_KEY;

export type BillableTier = Exclude<Tier, "free" | "enterprise">;

/** Price-id env mapping. Set these in your Stripe dashboard → Products →
 * Prices, then paste the price IDs here. Lab is per-seat metered; price
 * created with `recurring.usage_type=licensed` and quantity at checkout. */
export function priceIdForTier(t: BillableTier): string | null {
  if (t === "pro") return process.env.STRIPE_PRICE_PRO ?? null;
  if (t === "lab") return process.env.STRIPE_PRICE_LAB ?? null;
  return null;
}

/** Reverse map — given a Stripe price id from a webhook payload, what tier
 * is the customer now on? Returns null when the price isn't one we
 * recognise (could be a deleted experiment, etc.). */
export function tierFromPriceId(priceId: string): BillableTier | null {
  if (priceId && priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId && priceId === process.env.STRIPE_PRICE_LAB) return "lab";
  return null;
}

/** Lazy client factory — dynamic import keeps stripe out of bundles that
 * never call billing routes. */
export async function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  const Stripe = (await import("stripe")).default;
  // Use the SDK's bundled default API version. Pinning here was producing
  // a runtime mismatch with the installed Stripe client (v22 expects
  // a 2026 dashboard version). The SDK itself pins per-release, so the
  // default is the safer choice — when we bump the package, the bump is
  // the deliberate change.
  return new Stripe(key);
}

/** Webhook secret for signature verification. Required to accept any
 * incoming webhook in production. */
export function webhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET ?? null;
}
