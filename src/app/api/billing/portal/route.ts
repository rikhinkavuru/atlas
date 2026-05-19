import { NextRequest } from "next/server";
import { billingEnabled, stripeClient } from "@/lib/billing";

export const runtime = "nodejs";

/**
 * Returns a Stripe-hosted Customer Portal URL for the signed-in user. The
 * portal lets the customer update payment method, change quantity (seats),
 * download invoices, cancel — without us building any of that.
 *
 * We look up the customer id via the Clerk user record. If we don't yet
 * know it (user finished checkout but Clerk metadata isn't populated), we
 * fall through with a 404 and tell the client to open Settings → Billing
 * → Upgrade to start a fresh checkout.
 */
export async function POST(req: NextRequest) {
  if (!billingEnabled) {
    return Response.json(
      { ok: false, error: "billing_disabled" },
      { status: 503 },
    );
  }

  let userId: string | undefined;
  let customerId: string | undefined;
  try {
    const { auth, clerkClient } = await import("@clerk/nextjs/server");
    const a = await auth();
    userId = a.userId ?? undefined;
    if (userId) {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      const priv = (user.privateMetadata ?? {}) as Record<string, unknown>;
      if (typeof priv.stripeCustomerId === "string") {
        customerId = priv.stripeCustomerId;
      }
    }
  } catch {
    /* clerk not configured */
  }
  if (!userId) {
    return Response.json(
      { ok: false, error: "auth_required" },
      { status: 401 },
    );
  }
  if (!customerId) {
    // We don't have a customer id yet. The webhook stores it on
    // checkout.session.completed; if a user hits the portal before then,
    // we let them start a new checkout instead.
    return Response.json(
      {
        ok: false,
        error: "no_customer",
        message:
          "No Stripe customer record yet — start with the Upgrade flow first.",
      },
      { status: 404 },
    );
  }

  const stripe = await stripeClient();
  const origin = new URL(req.url).origin;
  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/app?billing=portal-return`,
  });
  return Response.json({ ok: true, url: portal.url });
}
