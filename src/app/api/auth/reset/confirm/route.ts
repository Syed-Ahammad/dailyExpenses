// POST /api/auth/reset/confirm — complete a password reset (FR-4).
// Body: { token, newPassword }. See docs/auth.md "Password reset".

import { NextRequest } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { connectMongo } from "@/lib/mongodb";
import { resetConfirmSchema } from "@/lib/validation";
import { UserModel } from "@/models/User";
import { PasswordResetTokenModel } from "@/models/PasswordResetToken";
import { logger } from "@/lib/logger";

const BCRYPT_COST = 12;
const INVALID = { error: "Invalid or expired reset link" };

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = resetConfirmSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Validation failed" },
        { status: 400 },
      );
    }
    const { token, newPassword } = parsed.data;

    await connectMongo();

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const record = await PasswordResetTokenModel.findOne({ tokenHash });

    // Reject missing, already-used, or expired tokens with one opaque message.
    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      return Response.json(INVALID, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);

    const updated = await UserModel.findByIdAndUpdate(record.userId, {
      $set: { passwordHash },
    });
    if (!updated) {
      // User vanished between issue and confirm — treat as invalid.
      return Response.json(INVALID, { status: 400 });
    }

    // Mark this token used and invalidate any other live tokens for the user.
    record.usedAt = new Date();
    await record.save();
    await PasswordResetTokenModel.updateMany(
      { userId: record.userId, usedAt: null },
      { $set: { usedAt: new Date() } },
    );

    return Response.json({ ok: true }, { status: 200 });
  } catch (err) {
    logger.error("POST /api/auth/reset/confirm failed", { err });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
