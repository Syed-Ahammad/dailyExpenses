// POST /api/stripe/webhook — Stripe subscription lifecycle events.
//
// Stripe sends raw (non-JSON-parsed) bodies — we MUST read text() and verify
// the signature before touching any data. This route is explicitly exempted from
// the auth middleware's 401 guard (see src/middleware.ts) because Stripe sends
// no session cookie.
//
// Events handled:
//   checkout.session.completed  → link Stripe customer → user, upsert Subscription
//   customer.subscription.created / updated → upsert Subscription active/past_due
//   customer.subscription.deleted            → mark Subscription cancelled

import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { connectMongo } from "@/lib/mongodb";
import { SubscriptionModel } from "@/models/Subscription";
import { UserModel } from "@/models/User";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

// Disable Next.js body parsing so we get the raw bytes for signature verification.
export const dynamic = "force-dynamic";

async function upsertSubscription(
  sub: Stripe.Subscription,
  userIdOverride?: string,
): Promise<void> {
  await connectMongo();

  // Resolve userId: prefer the explicit override (from checkout metadata),
  // fall back to looking up via Stripe customer ID stored on the User record.
  let userId = userIdOverride;
  if (!userId) {
    const customerId =
      typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const user = await UserModel.findOne({ stripeCustomerId: customerId }).lean<{ _id: unknown }>();
    if (user) userId = String(user._id);
  }

  if (!userId) {
    logger.warn("stripe webhook: could not resolve userId for subscription", {
      subscriptionId: sub.id,
    });
    return;
  }

  const status: "active" | "past_due" | "cancelled" =
    sub.status === "active"
      ? "active"
      : sub.status === "past_due"
        ? "past_due"
        : "cancelled";

  await SubscriptionModel.findOneAndUpdate(
    { userId },
    {
      userId,
      plan: "pro",
      status,
      providerId: sub.id,
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
    },
    { upsert: true, new: true },
  );
}

export async function POST(request: Request): Promise<Response> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error("STRIPE_WEBHOOK_SECRET is not set");
    return Response.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return Response.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    logger.warn("Stripe webhook signature verification failed", { err });
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        // Store the customer ID on the User record if not already set.
        const userId = session.metadata?.userId;
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;

        if (userId && customerId) {
          await connectMongo();
          await UserModel.updateOne(
            { _id: userId },
            { $set: { stripeCustomerId: customerId } },
          );
        }

        // The subscription may not be active yet — wait for the
        // customer.subscription.created event which fires right after.
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = (sub.metadata as Record<string, string>)?.userId;
        await upsertSubscription(sub, userId);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        await connectMongo();
        const user = await UserModel.findOne({ stripeCustomerId: customerId }).lean<{ _id: unknown }>();
        if (user) {
          await SubscriptionModel.findOneAndUpdate(
            { userId: String(user._id) },
            { status: "cancelled" },
          );
        }
        break;
      }
    }

    return Response.json({ received: true });
  } catch (err) {
    logger.error("Stripe webhook handler error", { err, type: event.type });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
