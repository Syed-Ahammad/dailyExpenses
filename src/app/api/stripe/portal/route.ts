// POST /api/stripe/portal — create a Stripe Billing Portal session (FR-27).
//
// Lets subscribers manage their plan, update payment method, and cancel.
// Requires the user to have a stripeCustomerId (only set after first Checkout).
// Returns { url } — the client redirects to it.

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
      stripeCustomerId?: string;
    }>();
    if (!user?.stripeCustomerId) {
      return Response.json(
        { error: "No active subscription found" },
        { status: 400 },
      );
    }

    const origin = request.headers.get("origin") ?? process.env.NEXTAUTH_URL ?? "";

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${origin}/billing`,
    });

    return Response.json({ url: session.url });
  } catch (err) {
    logger.error("POST /api/stripe/portal failed", { err });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
