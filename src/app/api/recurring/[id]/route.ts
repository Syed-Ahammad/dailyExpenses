// PATCH /api/recurring/:id — update a recurring template.
// DELETE /api/recurring/:id — delete a recurring template.
// FR-30 (manage templates).

import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectMongo } from "@/lib/mongodb";
import { getUserId } from "@/lib/auth";
import { recurringTemplateUpdateSchema } from "@/lib/validation";
import { RecurringTemplateModel } from "@/models/RecurringTemplate";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

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

    if (
      body === null ||
      typeof body !== "object" ||
      Object.keys(body).length === 0
    ) {
      return Response.json({ error: "Request body is empty" }, { status: 400 });
    }

    const parsed = recurringTemplateUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Validation failed" },
        { status: 400 },
      );
    }

    await connectMongo();
    const userId = await getUserId();

    // Handle endsAt: null explicitly to allow clearing the field.
    const update: Record<string, unknown> = {};
    const unset: Record<string, 1> = {};

    for (const [k, v] of Object.entries(parsed.data)) {
      if (v === null) {
        unset[k] = 1;
      } else {
        update[k] = v;
      }
    }

    const doc = await RecurringTemplateModel.findOneAndUpdate(
      { _id: id, userId },
      {
        ...(Object.keys(update).length > 0 ? { $set: update } : {}),
        ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
      },
      { new: true, runValidators: true },
    ).lean();

    if (!doc) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json(doc, { status: 200 });
  } catch (err) {
    logger.error("PATCH /api/recurring/[id] failed", { err });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;

    if (!mongoose.isValidObjectId(id)) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }

    await connectMongo();
    const userId = await getUserId();

    const doc = await RecurringTemplateModel.findOneAndDelete({
      _id: id,
      userId,
    }).lean();

    if (!doc) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json({ deleted: true }, { status: 200 });
  } catch (err) {
    logger.error("DELETE /api/recurring/[id] failed", { err });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
