import { NextRequest } from "next/server";
import { billingEnabled, priceIdForTier, stripeClient } from "@/lib/billing";
import type { BillableTier } from "@/lib/billing";

export const runtime = "nodejs";

/**
 * Create a Stripe Checkout Session for the requested tier and return the
 * hosted URL. The client redirects the browser to that URL; Stripe handles
 * payment + sends a webhook to /api/billing/webhook on success.
 *
 * We attach `clientReferenceId` and `metadata.tier` to the session so the
 * webhook can match the payment back to the originating user + tier.
 *
 * Without STRIPE_SECRET_KEY this route returns 503 so the client falls
 * back to the "billing not configured" UI.
 */
export async function POST(req: NextRequest) {
  if (!billingEnabled) {
    return Response.json(
      { ok: false, error: "billing_disabled" },
      { status: 503 },
    );
  }

  let body: { tier?: BillableTier; seats?: number; returnTo?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const tier = body.tier;
  if (tier !== "pro" && tier !== "lab") {
    return Response.json(
      { ok: false, error: "tier_invalid", supported: ["pro", "lab"] },
      { status: 400 },
    );
  }
  const priceId = priceIdForTier(tier);
  if (!priceId) {
    return Response.json(
      {
        ok: false,
        error: "price_unconfigured",
        message: `STRIPE_PRICE_${tier.toUpperCase()} env var is not set. Configure it in Stripe → Products → Prices.`,
      },
      { status: 503 },
    );
  }
  const seats =
    tier === "lab"
      ? Math.min(50, Math.max(1, Math.floor(body.seats ?? 1)))
      : 1;

  // Resolve the Clerk user id so the webhook can identify them. We dynamic-
  // import Clerk so the route still builds in Atlas-without-Clerk setups.
  let userId: string | undefined;
  let customerEmail: string | undefined;
  try {
    const { auth, currentUser } = await import("@clerk/nextjs/server");
    const a = await auth();
    userId = a.userId ?? undefined;
    if (userId) {
      const user = await currentUser();
      customerEmail = user?.primaryEmailAddress?.emailAddress;
    }
  } catch {
    /* Clerk not configured → checkout will run as anonymous */
  }

  const origin = new URL(req.url).origin;
  const returnPath = (body.returnTo ?? "/app").replace(/[^a-zA-Z0-9/_?&=#-]/g, "");

  const stripe = await stripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: seats }],
    success_url: `${origin}${returnPath}?billing=success&tier=${tier}`,
    cancel_url: `${origin}${returnPath}?billing=cancelled`,
    client_reference_id: userId,
    customer_email: customerEmail,
    metadata: {
      atlasTier: tier,
      atlasUserId: userId ?? "anonymous",
      atlasSeats: String(seats),
    },
    // Capture billing address for tax + a clean invoice — opt-in basic
    // requirements only, no extra address questions for the user.
    billing_address_collection: "auto",
    // Per-tier reasonable trial. The pricing page says 14-day trial on Pro.
    subscription_data: {
      trial_period_days: tier === "pro" ? 14 : undefined,
      metadata: {
        atlasTier: tier,
        atlasUserId: userId ?? "anonymous",
      },
    },
    // Lets returning customers reuse a saved card without a second flow.
    allow_promotion_codes: true,
  });

  return Response.json({
    ok: true,
    sessionId: session.id,
    url: session.url,
  });
}
