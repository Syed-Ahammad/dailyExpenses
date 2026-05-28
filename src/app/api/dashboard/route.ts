/**
 * GET /api/dashboard
 *
 * Returns aggregated totals for today / week / month, a per-category
 * expense breakdown, and budget warnings — all in the user's base currency
 * as integer minor units. See src/lib/dashboard.ts for the aggregation logic.
 *
 * FR-10 through FR-14, FR-17, FR-18.
 */

import { connectMongo } from "@/lib/mongodb";
import { getUserId } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getDashboard } from "@/lib/dashboard";

export async function GET() {
  try {
    await connectMongo();
    const userId = await getUserId();
    const result = await getDashboard(userId);
    return Response.json(result, { status: 200 });
  } catch (err) {
    logger.error("GET /api/dashboard failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
