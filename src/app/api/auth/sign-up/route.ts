// POST /api/auth/sign-up — create a user account (FR-1). The client then calls
// NextAuth signIn() to establish a session. See docs/auth.md "Sign-up".

import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { connectMongo } from "@/lib/mongodb";
import { signUpSchema } from "@/lib/validation";
import { UserModel } from "@/models/User";
import { logger } from "@/lib/logger";

const BCRYPT_COST = 12;

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = signUpSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Validation failed" },
        { status: 400 },
      );
    }
    const { email, password, baseCurrency, name } = parsed.data;

    await connectMongo();

    // Pre-check for a friendly 409; the unique index is the real guarantee.
    const existing = await UserModel.findOne({ email }).lean();
    if (existing) {
      return Response.json({ error: "email already in use" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

    try {
      const user = await UserModel.create({
        email,
        passwordHash,
        baseCurrency,
        ...(name ? { name } : {}),
      });
      // Never return the password hash.
      return Response.json(
        { id: String(user._id), email: user.email },
        { status: 201 },
      );
    } catch (err) {
      // Lost the race against the unique { email } index.
      if (
        typeof err === "object" &&
        err !== null &&
        (err as { code?: number }).code === 11000
      ) {
        return Response.json({ error: "email already in use" }, { status: 409 });
      }
      throw err;
    }
  } catch (err) {
    logger.error("POST /api/auth/sign-up failed", { err });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
