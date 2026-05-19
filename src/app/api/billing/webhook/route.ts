import { NextRequest } from "next/server";
import {
  billingEnabled,
  stripeClient,
  tierFromPriceId,
  webhookSecret,
} from "@/lib/billing";

export const runtime = "nodejs";

/**
 * Stripe webhook handler. Verifies the signature, then handles three events:
 *
 *   - checkout.session.completed       — the user just paid; flip their
 *                                          Clerk publicMetadata.tier to
 *                                          the purchased tier.
 *   - customer.subscription.updated    — covers plan changes, trial ends,
 *                                          cancellations-at-period-end.
 *   - customer.subscription.deleted    — subscription actually ended;
 *                                          downgrade tier to "free".
 *
 * Idempotency: Stripe may retry. We use `event.id` as the natural key for
 * de-dup (tracked via Clerk private metadata so the same webhook event
 * applied twice is a no-op).
 *
 * SECURITY: never trust webhook bodies that fail signature verification.
 * Without STRIPE_WEBHOOK_SECRET we refuse all webhooks — that's strictly
 * stricter than fail-open.
 */
export async function POST(req: NextRequest) {
  if (!billingEnabled) {
    return Response.json(
      { ok: false, error: "billing_disabled" },
      { status: 503 },
    );
  }
  const secret = webhookSecret();
  if (!secret) {
    return Response.json(
      { ok: false, error: "webhook_secret_missing" },
      { status: 503 },
    );
  }
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return Response.json(
      { ok: false, error: "signature_missing" },
      { status: 400 },
    );
  }
  // Reading body as text (not json) is required for signature verification —
  // the SDK hashes the exact bytes Stripe sent.
  const payload = await req.text();
  const stripe = await stripeClient();
  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, sig, secret);
  } catch (e) {
    return Response.json(
      {
        ok: false,
        error: "signature_invalid",
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 400 },
    );
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as {
        client_reference_id?: string;
        customer?: string;
        metadata?: Record<string, string>;
        subscription?: string;
      };
      const userId =
        session.client_reference_id ?? session.metadata?.atlasUserId;
      const tier = session.metadata?.atlasTier;
      if (userId && (tier === "pro" || tier === "lab")) {
        // Capture the Stripe customer id so /api/billing/portal can
        // find it next time the user wants to manage their subscription.
        await updateClerkTier(userId, tier, event.id, session.customer);
      }
    } else if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.created"
    ) {
      const sub = event.data.object as {
        status?: string;
        items?: { data: { price: { id: string } }[] };
        metadata?: Record<string, string>;
        customer?: string;
      };
      const priceId = sub.items?.data?.[0]?.price?.id;
      const tier = priceId ? tierFromPriceId(priceId) : null;
      const userId = sub.metadata?.atlasUserId;
      if (
        userId &&
        tier &&
        (sub.status === "active" || sub.status === "trialing")
      ) {
        // Always pass customer id here in case subscription.created
        // fires before checkout.session.completed — otherwise the portal
        // route can't find the customer record on first access.
        await updateClerkTier(userId, tier, event.id, sub.customer);
      }
    } else if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as {
        metadata?: Record<string, string>;
        customer?: string;
      };
      const userId = sub.metadata?.atlasUserId;
      if (userId) {
        await updateClerkTier(userId, "free", event.id, sub.customer);
      }
    }
    // Unhandled event types are explicitly fine — Stripe expects 2xx.
  } catch (e) {
    // 500 makes Stripe retry; 4xx makes them stop. For internal failures
    // we want a retry.
    return Response.json(
      {
        ok: false,
        error: "handler_failed",
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }

  return Response.json({ ok: true, eventId: event.id, type: event.type });
}

/**
 * Update the user's tier via Clerk's Backend API. We also stash the
 * Stripe event id in privateMetadata so a duplicate webhook (Stripe retry
 * after we already applied the change) is a no-op.
 */
async function updateClerkTier(
  userId: string,
  tier: "free" | "pro" | "lab",
  stripeEventId: string,
  stripeCustomerId?: string,
) {
  try {
    const { clerkClient } = await import("@clerk/nextjs/server");
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const priv = (user.privateMetadata ?? {}) as Record<string, unknown>;
    const seen = Array.isArray(priv.appliedStripeEvents)
      ? (priv.appliedStripeEvents as string[])
      : [];
    if (seen.includes(stripeEventId)) return; // idempotent
    await client.users.updateUser(userId, {
      publicMetadata: {
        ...(user.publicMetadata ?? {}),
        tier,
      },
      privateMetadata: {
        ...priv,
        // Stash customer id so /api/billing/portal can resolve it later.
        ...(stripeCustomerId ? { stripeCustomerId } : {}),
        // Cap the seen-events list so it doesn't grow forever.
        appliedStripeEvents: [...seen, stripeEventId].slice(-50),
      },
    });
  } catch (e) {
    // We re-throw so the parent handler returns 500 and Stripe retries.
    throw new Error(
      `Clerk tier update failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}
