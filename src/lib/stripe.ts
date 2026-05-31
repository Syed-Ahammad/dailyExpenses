// Stripe SDK singleton — server-only.
// Never import this from client components or Edge middleware.

import Stripe from "stripe";

declare global {
  // eslint-disable-next-line no-var
  var _stripeInstance: Stripe | undefined;
}

function createStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to .env.local (and Vercel project settings for production).",
    );
  }
  return new Stripe(key, { apiVersion: "2025-02-24.acacia" });
}

// Cache across hot-reloads in dev; create fresh in production serverless.
export const stripe: Stripe =
  globalThis._stripeInstance ?? (globalThis._stripeInstance = createStripeClient());
