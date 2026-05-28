// GET /api/expenses — list transactions, POST /api/expenses — create transaction.
// FR-5, FR-6, FR-9 (Phase 1).

import { NextRequest } from "next/server";
import { connectMongo } from "@/lib/mongodb";
import { getUserId } from "@/lib/auth";
import { transactionInputSchema } from "@/lib/validation";
import { TransactionModel } from "@/models/Transaction";
import { logger } from "@/lib/logger";

/**
 * GET /api/expenses
 * List the current user's transactions, most-recent first, limit 500.
 * Accepts optional `from` and `to` ISO date query params.
 */
export async function GET(request: NextRequest) {
  try {
    await connectMongo();
    const userId = await getUserId();

    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    // Validate date params when present — invalid ISO strings produce NaN timestamps.
    const filter: Record<string, unknown> = { userId };
    if (fromParam !== null || toParam !== null) {
      const dateRange: Record<string, Date> = {};
      if (fromParam !== null) {
        const d = new Date(fromParam);
        if (isNaN(d.getTime())) {
          return Response.json(
            { error: "Invalid `from` date" },
            { status: 400 }
          );
        }
        dateRange.$gte = d;
      }
      if (toParam !== null) {
        const d = new Date(toParam);
        if (isNaN(d.getTime())) {
          return Response.json(
            { error: "Invalid `to` date" },
            { status: 400 }
          );
        }
        dateRange.$lte = d;
      }
      filter.occurredAt = dateRange;
    }

    const items = await TransactionModel.find(filter)
      .sort({ occurredAt: -1 })
      .limit(500)
      .lean();

    return Response.json({ items }, { status: 200 });
  } catch (err) {
    logger.error("GET /api/expenses failed", { err });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/expenses
 * Create a new transaction. Money fields must be integer minor units.
 * userId is derived from the server-side session — never from the request body.
 */
export async function POST(request: NextRequest) {
  try {
    await connectMongo();
    const userId = await getUserId();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = transactionInputSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Validation failed" },
        { status: 400 }
      );
    }

    const doc = await TransactionModel.create({
      ...parsed.data,
      userId, // always server-side; never from the client body
    });

    return Response.json(doc.toObject(), { status: 201 });
  } catch (err) {
    logger.error("POST /api/expenses failed", { err });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
