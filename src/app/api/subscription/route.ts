// GET /api/subscription — current plan info for the logged-in user (FR-27).
// Returns { plan, status, currentPeriodEnd } so the billing page can render
// the right state without re-fetching Stripe.

import { getUserId } from "@/lib/auth";
import { connectMongo } from "@/lib/mongodb";
import { SubscriptionModel } from "@/models/Subscription";
import { logger } from "@/lib/logger";

export async function GET(): Promise<Response> {
  try {
    const userId = await getUserId();
    await connectMongo();

    const sub = await SubscriptionModel.findOne({ userId }).lean();

    if (!sub || sub.status !== "active") {
      return Response.json({ plan: "free", status: null, currentPeriodEnd: null });
    }

    return Response.json({
      plan: sub.plan,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd ?? null,
    });
  } catch (err) {
    logger.error("GET /api/subscription failed", { err });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
