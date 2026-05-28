// GET /api/budgets — list budgets, POST /api/budgets — create budget.
// FR-15, FR-16 (Phase 2).

import { NextRequest } from "next/server";
import { connectMongo } from "@/lib/mongodb";
import { getUserId } from "@/lib/auth";
import { budgetInputSchema } from "@/lib/validation";
import { BudgetModel } from "@/models/Budget";
import { logger } from "@/lib/logger";

/**
 * GET /api/budgets
 * List the current user's budgets, sorted by category ascending.
 */
export async function GET() {
  try {
    await connectMongo();
    const userId = await getUserId();

    const items = await BudgetModel.find({ userId }).sort({ category: 1 }).lean();

    return Response.json({ items }, { status: 200 });
  } catch (err) {
    logger.error("GET /api/budgets failed", { err });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/budgets
 * Create a budget for a category. limitMinorBase must be a positive integer
 * in the user's base currency minor units. Fails with 400 if a budget for
 * that category already exists (enforced by the unique { userId, category }
 * index — caught atomically from the E11000 duplicate-key error).
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

    const parsed = budgetInputSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Validation failed" },
        { status: 400 }
      );
    }

    try {
      const doc = await BudgetModel.create({
        ...parsed.data,
        userId, // always server-side; never from the client body
      });
      return Response.json(doc.toObject(), { status: 201 });
    } catch (err) {
      // The unique { userId, category } index rejects a duplicate category atomically.
      if (
        typeof err === "object" &&
        err !== null &&
        (err as { code?: number }).code === 11000
      ) {
        return Response.json(
          { error: "A budget for this category already exists" },
          { status: 400 }
        );
      }
      throw err; // unexpected — re-throw so the outer catch logs and returns 500
    }
  } catch (err) {
    logger.error("POST /api/budgets failed", { err });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
