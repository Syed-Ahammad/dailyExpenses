// GET /api/sharing  — list invites + active accesses the current user has issued.
// POST /api/sharing — create an invite for another user (FR-32).

import { NextRequest } from "next/server";
import crypto from "crypto";
import { connectMongo } from "@/lib/mongodb";
import { getUserId } from "@/lib/auth";
import { SharedAccessModel } from "@/models/SharedAccess";
import { UserModel } from "@/models/User";
import { sendShareInviteEmail } from "@/lib/sharing";
import { logger } from "@/lib/logger";
import { z } from "zod";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
});

function appOrigin(request: NextRequest): string {
  return (
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? request.nextUrl.origin
  );
}

export async function GET() {
  try {
    await connectMongo();
    const userId = await getUserId();

    const items = await SharedAccessModel.find({
      ownerId: userId,
      status: { $in: ["pending", "active"] },
    })
      .sort({ createdAt: -1 })
      .lean();

    return Response.json({ items }, { status: 200 });
  } catch (err) {
    logger.error("GET /api/sharing failed", { err });
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

    const parsed = inviteSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Validation failed" },
        { status: 400 },
      );
    }
    const { email } = parsed.data;

    // Prevent inviting yourself.
    const self = await UserModel.findById(userId).lean<{ email: string } | null>();
    if (self?.email === email) {
      return Response.json(
        { error: "You cannot invite yourself." },
        { status: 400 },
      );
    }

    // One active/pending invite per owner+email pair (enforced by partial index).
    const existing = await SharedAccessModel.findOne({
      ownerId: userId,
      granteeEmail: email,
      status: { $in: ["pending", "active"] },
    }).lean();
    if (existing) {
      return Response.json(
        { error: "An active invite already exists for that email." },
        { status: 409 },
      );
    }

    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const doc = await SharedAccessModel.create({
      ownerId: userId,
      granteeEmail: email,
      tokenHash,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    });

    const inviteUrl = `${appOrigin(request)}/sharing/accept?token=${token}`;
    const ownerName = self?.email ?? "Someone";
    await sendShareInviteEmail(email, ownerName, inviteUrl);

    return Response.json(
      { item: doc.toObject(), inviteUrl },
      { status: 201 },
    );
  } catch (err) {
    logger.error("POST /api/sharing failed", { err });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
