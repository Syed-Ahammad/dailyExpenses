// PATCH/DELETE /api/budgets/:id — single budget operations.
// FR-16 (edit, remove). Phase 2.

import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectMongo } from "@/lib/mongodb";
import { getUserId } from "@/lib/auth";
import { budgetUpdateSchema } from "@/lib/validation";
import { BudgetModel } from "@/models/Budget";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/budgets/:id
 * Update a budget's limit or warning threshold.
 * category is immutable — it is not accepted by budgetUpdateSchema.
 * userId can never be overwritten via this route.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;

    // Guard against malformed ObjectId before hitting MongoDB to avoid a 500.
    if (!mongoose.isValidObjectId(id)) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Reject completely empty updates.
    if (
      body === null ||
      typeof body !== "object" ||
      Object.keys(body).length === 0
    ) {
      return Response.json({ error: "Request body is empty" }, { status: 400 });
    }

    const parsed = budgetUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Validation failed" },
        { status: 400 }
      );
    }

    await connectMongo();
    const userId = await getUserId();

    // parsed.data never contains userId or category (Zod strips unknown keys;
    // schema only exposes limitMinorBase and warnAtPercent).
    const doc = await BudgetModel.findOneAndUpdate(
      { _id: id, userId },
      { $set: parsed.data },
      { new: true, runValidators: true }
    ).lean();

    if (!doc) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json(doc, { status: 200 });
  } catch (err) {
    logger.error("PATCH /api/budgets/[id] failed", { err });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/budgets/:id
 * Remove a budget owned by the current user.
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;

    if (!mongoose.isValidObjectId(id)) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }

    await connectMongo();
    const userId = await getUserId();

    const doc = await BudgetModel.findOneAndDelete({
      _id: id,
      userId,
    }).lean();

    if (!doc) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json({ deleted: true }, { status: 200 });
  } catch (err) {
    logger.error("DELETE /api/budgets/[id] failed", { err });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
