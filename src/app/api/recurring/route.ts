// GET /api/recurring  — list the current user's recurring templates.
// POST /api/recurring — create a new template (FR-30).

import { NextRequest } from "next/server";
import { connectMongo } from "@/lib/mongodb";
import { getUserId } from "@/lib/auth";
import { recurringTemplateInputSchema } from "@/lib/validation";
import { RecurringTemplateModel } from "@/models/RecurringTemplate";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    await connectMongo();
    const userId = await getUserId();

    const items = await RecurringTemplateModel.find({ userId })
      .sort({ nextDueAt: 1 })
      .lean();

    return Response.json({ items }, { status: 200 });
  } catch (err) {
    logger.error("GET /api/recurring failed", { err });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

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

    const parsed = recurringTemplateInputSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Validation failed" },
        { status: 400 },
      );
    }

    const doc = await RecurringTemplateModel.create({
      ...parsed.data,
      userId,
    });

    return Response.json(doc.toObject(), { status: 201 });
  } catch (err) {
    logger.error("POST /api/recurring failed", { err });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
