// DELETE /api/sharing/:id — revoke an invite or active access (FR-32).

import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectMongo } from "@/lib/mongodb";
import { getUserId } from "@/lib/auth";
import { SharedAccessModel } from "@/models/SharedAccess";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;

    if (!mongoose.isValidObjectId(id)) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }

    await connectMongo();
    const userId = await getUserId();

    // Only the owner can revoke.
    const doc = await SharedAccessModel.findOneAndUpdate(
      { _id: id, ownerId: userId },
      { $set: { status: "revoked" } },
      { new: true },
    ).lean();

    if (!doc) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json({ revoked: true }, { status: 200 });
  } catch (err) {
    logger.error("DELETE /api/sharing/[id] failed", { err });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
