// POST /api/auth/reset/request — start a password reset (FR-4).
// ALWAYS responds 200 with no body, whether or not the email exists, to avoid
// account enumeration. See docs/auth.md "Password reset".

import { NextRequest } from "next/server";
import crypto from "crypto";
import { connectMongo } from "@/lib/mongodb";
import { resetRequestSchema } from "@/lib/validation";
import { UserModel } from "@/models/User";
import { PasswordResetTokenModel } from "@/models/PasswordResetToken";
import { sendPasswordResetEmail } from "@/lib/email";
import { logger } from "@/lib/logger";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function appBaseUrl(request: NextRequest): string {
  return (
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? request.nextUrl.origin
  );
}

export async function POST(request: NextRequest) {
  // The "happy path" and the "no such email" path must be indistinguishable
  // from the outside, so we wrap everything and still return 200.
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(null, { status: 200 });
    }

    const parsed = resetRequestSchema.safeParse(body);
    if (!parsed.success) {
      // Bad email format — still 200 (no enumeration, no validation oracle).
      return new Response(null, { status: 200 });
    }
    const { email } = parsed.data;

    await connectMongo();
    const user = await UserModel.findOne({ email }).lean();

    if (user) {
      // 32 random bytes, base64url for the link; store only the SHA-256 hash.
      const token = crypto.randomBytes(32).toString("base64url");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      await PasswordResetTokenModel.create({
        userId: String(user._id),
        tokenHash,
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      });

      const resetUrl = `${appBaseUrl(request)}/reset?token=${token}`;
      await sendPasswordResetEmail(user.email, resetUrl);
    }

    return new Response(null, { status: 200 });
  } catch (err) {
    // Even on internal failure, don't leak detail. Log and return 200.
    logger.error("POST /api/auth/reset/request failed", { err });
    return new Response(null, { status: 200 });
  }
}
