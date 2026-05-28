// GET/PATCH/DELETE /api/expenses/:id — single transaction operations.
// FR-7 (edit), FR-8 (delete). Phase 1.

import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectMongo } from "@/lib/mongodb";
import { getUserId } from "@/lib/auth";
import { transactionUpdateSchema } from "@/lib/validation";
import { TransactionModel } from "@/models/Transaction";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/expenses/:id
 * Fetch one transaction owned by the current user.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;

    // Guard against malformed ObjectId before hitting MongoDB to avoid a 500.
    if (!mongoose.isValidObjectId(id)) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }

    await connectMongo();
    const userId = await getUserId();

    const doc = await TransactionModel.findOne({ _id: id, userId }).lean();
    if (!doc) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json(doc, { status: 200 });
  } catch (err) {
    logger.error("GET /api/expenses/[id] failed", { err });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/expenses/:id
 * Partially update a transaction owned by the current user.
 * userId can never be overwritten via this route.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;

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

    // All fields optional on an update; dedicated partial schema avoids ZodEffects .partial() limitation.
    const parsed = transactionUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Validation failed" },
        { status: 400 }
      );
    }

    await connectMongo();
    const userId = await getUserId();

    // parsed.data never contains userId (Zod strips unknown keys; schema has no userId field).
    const doc = await TransactionModel.findOneAndUpdate(
      { _id: id, userId },
      { $set: parsed.data },
      { new: true, runValidators: true }
    ).lean();

    if (!doc) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json(doc, { status: 200 });
  } catch (err) {
    logger.error("PATCH /api/expenses/[id] failed", { err });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/expenses/:id
 * Delete a transaction owned by the current user.
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;

    if (!mongoose.isValidObjectId(id)) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }

    await connectMongo();
    const userId = await getUserId();

    const doc = await TransactionModel.findOneAndDelete({
      _id: id,
      userId,
    }).lean();

    if (!doc) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json({ deleted: true }, { status: 200 });
  } catch (err) {
    logger.error("DELETE /api/expenses/[id] failed", { err });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
