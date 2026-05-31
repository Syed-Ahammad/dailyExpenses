// POST /api/recurring/process — generate transactions for all overdue templates.
// Called daily by Vercel Cron (see vercel.json) and optionally by the UI.
// FR-31 (auto-generate on due date).
//
// Vercel Cron sends: Authorization: Bearer {CRON_SECRET}
// When CRON_SECRET is set, the header is required. Omit it in local dev by
// leaving CRON_SECRET unset — the route then accepts unauthenticated calls
// (only reachable from your own machine anyway).

import { generateDueTransactions } from "@/lib/recurring";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const auth = request.headers.get("authorization");
      if (auth !== `Bearer ${cronSecret}`) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const generated = await generateDueTransactions();
    logger.info("Recurring process completed", { generated });
    return Response.json({ generated }, { status: 200 });
  } catch (err) {
    logger.error("POST /api/recurring/process failed", { err });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
