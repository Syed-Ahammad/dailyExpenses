// POST /api/sharing/accept — accept a share invite via a one-time token (FR-32).
// The grantee must be signed in. The token is validated against its SHA-256 hash.

import { NextRequest } from "next/server";
import crypto from "crypto";
import { connectMongo } from "@/lib/mongodb";
import { getUserId } from "@/lib/auth";
import { auth } from "@/lib/auth";
import { SharedAccessModel } from "@/models/SharedAccess";
import { logger } from "@/lib/logger";
import { z } from "zod";

const acceptSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

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

    const parsed = acceptSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Validation failed" },
        { status: 400 },
      );
    }
    const { token } = parsed.data;

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const access = await SharedAccessModel.findOne({
      tokenHash,
      status: "pending",
    }).lean();

    if (!access) {
      return Response.json(
        { error: "Invalid or already-used invite link." },
        { status: 400 },
      );
    }

    if (new Date() > new Date(access.expiresAt)) {
      return Response.json(
        { error: "This invite link has expired." },
        { status: 410 },
      );
    }

    // Guard: grantee cannot be the same as the owner.
    if (String(access.ownerId) === userId) {
      return Response.json(
        { error: "You cannot accept your own invite." },
        { status: 400 },
      );
    }

    // Verify the session email matches the intended granteeEmail.
    const session = await auth();
    const sessionEmail = session?.user?.email?.toLowerCase();
    if (sessionEmail && sessionEmail !== access.granteeEmail) {
      return Response.json(
        {
          error: `This invite was sent to ${access.granteeEmail}. Sign in with that account to accept it.`,
        },
        { status: 403 },
      );
    }

    await SharedAccessModel.updateOne(
      { _id: access._id },
      { $set: { status: "active", granteeId: userId } },
    );

    return Response.json(
      { ownerId: String(access.ownerId) },
      { status: 200 },
    );
  } catch (err) {
    logger.error("POST /api/sharing/accept failed", { err });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
