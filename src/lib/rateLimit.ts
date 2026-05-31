// Rate limiting (NFR-5, docs/auth.md "Rate limiting").
//
// Runs in Edge middleware, so everything here must be Edge-safe: Upstash is
// loaded via dynamic import only when configured, and the dev fallback is a
// plain in-memory Map. Fail-open on any limiter error — a limiter outage must
// never lock users out of the app.

import { logger } from "@/lib/logger";

type RuleName =
  | "signIn"
  | "signUp"
  | "reset"
  | "categorize"
  | "expenses"
  | "budgets"
  | "receiptsUpload"
  | "receiptsOcr"
  | "stripeCheckout"
  | "recurringCreate";

// limit = max requests per window; window in seconds. Mirrors docs/auth.md.
const RULES: Record<RuleName, { limit: number; window: number }> = {
  signIn: { limit: 10, window: 60 },
  signUp: { limit: 5, window: 60 },
  reset: { limit: 5, window: 3600 },
  categorize: { limit: 20, window: 60 },
  expenses: { limit: 60, window: 60 },
  budgets: { limit: 30, window: 60 },
  // Receipt uploads + OCR each have real per-call cost (Cloudinary bandwidth,
  // Textract dollars), so they sit lower than expenses on purpose.
  receiptsUpload: { limit: 30, window: 60 },
  receiptsOcr: { limit: 15, window: 60 },
  // Checkout creates a Stripe session which has cost — keep it tight.
  stripeCheckout: { limit: 5, window: 60 },
  recurringCreate: { limit: 30, window: 60 },
};

const upstashConfigured =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

// --- In-memory fixed-window fallback (dev/local only) --------------------
// Not shared across serverless instances; only correct on a single process.
// Production must configure Upstash. We warn once so this is never silent.
const memoryHits = new Map<string, { count: number; resetAt: number }>();
let warnedNoUpstash = false;

function memoryAllow(name: RuleName, key: string): boolean {
  if (!warnedNoUpstash) {
    warnedNoUpstash = true;
    logger.warn(
      "Rate limiting using in-memory fallback (Upstash not configured) — " +
        "not safe across serverless instances; set UPSTASH_REDIS_REST_URL/TOKEN in production.",
    );
  }
  const rule = RULES[name];
  const now = Date.now();
  const windowMs = rule.window * 1000;
  const bucket = memoryHits.get(key);

  if (!bucket || now >= bucket.resetAt) {
    memoryHits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= rule.limit) return false;
  bucket.count += 1;
  return true;
}

// --- Upstash sliding-window (production) ---------------------------------
// One limiter per rule, cached across invocations on the module scope.
type UpstashLimiter = { limit: (key: string) => Promise<{ success: boolean }> };
const upstashLimiters = new Map<RuleName, UpstashLimiter>();
let redisClient: unknown = null;

async function getUpstashLimiter(name: RuleName): Promise<UpstashLimiter> {
  const cached = upstashLimiters.get(name);
  if (cached) return cached;

  const { Ratelimit } = await import("@upstash/ratelimit");
  const { Redis } = await import("@upstash/redis");
  if (!redisClient) redisClient = Redis.fromEnv();

  const rule = RULES[name];
  const limiter = new Ratelimit({
    redis: redisClient as ConstructorParameters<typeof Ratelimit>[0]["redis"],
    limiter: Ratelimit.slidingWindow(rule.limit, `${rule.window} s`),
    prefix: `rl:${name}`,
  });
  upstashLimiters.set(name, limiter);
  return limiter;
}

/** True if the request is allowed, false if it should be rejected (429). */
export async function rateLimitAllow(
  name: RuleName,
  key: string,
): Promise<boolean> {
  if (!upstashConfigured) return memoryAllow(name, key);
  try {
    const limiter = await getUpstashLimiter(name);
    const { success } = await limiter.limit(key);
    return success;
  } catch (err) {
    // Fail open: never lock users out because the limiter is down.
    logger.error("Rate limiter error (failing open)", { err });
    return true;
  }
}

/**
 * Map a request path to its rate-limit rule and check it.
 * Returns true (allow) for paths with no configured limit.
 *
 * Note: `reset` is keyed by IP only (docs/auth.md specifies IP+email, but
 * middleware can't read the request body). Per-email keying would have to move
 * into the reset route handler itself.
 */
export async function rateLimitRequest(
  pathname: string,
  { ip, userId }: { ip: string; userId?: string },
): Promise<boolean> {
  // NextAuth Credentials sign-in posts to its callback route.
  if (pathname === "/api/auth/callback/credentials") {
    return rateLimitAllow("signIn", ip);
  }
  if (pathname === "/api/auth/sign-up") {
    return rateLimitAllow("signUp", ip);
  }
  if (pathname.startsWith("/api/auth/reset/")) {
    return rateLimitAllow("reset", ip);
  }
  if (pathname === "/api/categorize") {
    return rateLimitAllow("categorize", userId ?? ip);
  }
  if (pathname === "/api/expenses") {
    return rateLimitAllow("expenses", userId ?? ip);
  }
  if (pathname === "/api/budgets") {
    return rateLimitAllow("budgets", userId ?? ip);
  }
  if (pathname === "/api/receipts/upload") {
    return rateLimitAllow("receiptsUpload", userId ?? ip);
  }
  if (pathname === "/api/receipts/ocr") {
    return rateLimitAllow("receiptsOcr", userId ?? ip);
  }
  if (pathname === "/api/stripe/checkout") {
    return rateLimitAllow("stripeCheckout", userId ?? ip);
  }
  if (pathname === "/api/recurring") {
    return rateLimitAllow("recurringCreate", userId ?? ip);
  }
  return true;
}
