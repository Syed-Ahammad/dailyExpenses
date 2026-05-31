// POST /api/stripe/checkout — create a Stripe Checkout Session for the Pro plan (FR-27).
//
// 1. Resolves the user's Stripe customer ID (creates one if absent, stores it on User).
// 2. Creates a Checkout Session in subscription mode.
// 3. Returns { url } — the client redirects to it.
//
// Auth is enforced by middleware (401 if no session). Rate-limited via stripeCheckout rule.

import { getUserId } from "@/lib/auth";
import { connectMongo } from "@/lib/mongodb";
import { UserModel } from "@/models/User";
import { stripe } from "@/lib/stripe";
import { logger } from "@/lib/logger";

export async function POST(request: Request): Promise<Response> {
  try {
    const userId = await getUserId();
    await connectMongo();

    const user = await UserModel.findById(userId).lean<{
      email: string;
      stripeCustomerId?: string;
    }>();
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const priceId = process.env.STRIPE_PRO_PRICE_ID;
    if (!priceId) {
      logger.error("STRIPE_PRO_PRICE_ID is not set");
      return Response.json({ error: "Billing not configured" }, { status: 503 });
    }

    // Resolve or create Stripe customer so portal works later.
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId },
      });
      customerId = customer.id;
      await UserModel.updateOne({ _id: userId }, { stripeCustomerId: customerId });
    }

    const origin = request.headers.get("origin") ?? process.env.NEXTAUTH_URL ?? "";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/billing?success=1`,
      cancel_url: `${origin}/billing`,
      metadata: { userId },
    });

    return Response.json({ url: session.url });
  } catch (err) {
    logger.error("POST /api/stripe/checkout failed", { err });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
