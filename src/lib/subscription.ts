// Subscription helpers — server-only.
// Routes call getUserPlan() to read the current tier and requirePro() to gate
// features that are only available on the paid plan.

import { connectMongo } from "@/lib/mongodb";
import { SubscriptionModel } from "@/models/Subscription";
import type { Plan } from "@/lib/plans";

/** Returns the user's active plan tier, defaulting to "free" when no active subscription exists. */
export async function getUserPlan(userId: string): Promise<Plan> {
  await connectMongo();
  const sub = await SubscriptionModel.findOne({ userId }).lean();
  if (sub && sub.status === "active" && sub.plan === "pro") return "pro";
  return "free";
}

/** Thrown by requirePro() when the user is not on the Pro plan. */
export class PlanError extends Error {
  readonly status = 403;
  constructor(message = "This feature requires a Pro subscription.") {
    super(message);
    this.name = "PlanError";
  }
}

/**
 * Asserts that userId is on the Pro plan. Throws PlanError (status 403) if not.
 * Routes that call this should catch PlanError and return the appropriate response.
 */
export async function requirePro(userId: string): Promise<void> {
  const plan = await getUserPlan(userId);
  if (plan !== "pro") throw new PlanError();
}
