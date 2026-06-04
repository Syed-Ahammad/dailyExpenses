// Shared-access helpers — server-only.

import { connectMongo } from "@/lib/mongodb";
import { SharedAccessModel } from "@/models/SharedAccess";
import { Resend } from "resend";
import { logger } from "@/lib/logger";

/**
 * Returns true when `viewerId` has an active viewer grant for `ownerId`.
 * Every shared-view route must call this before serving owner data.
 */
export async function verifyViewerAccess(
  viewerId: string,
  ownerId: string,
): Promise<boolean> {
  await connectMongo();
  const access = await SharedAccessModel.findOne({
    granteeId: viewerId,
    ownerId,
    status: "active",
  }).lean();
  return !!access;
}

/**
 * Send a share-invite email. Falls back to logging the link when
 * RESEND_API_KEY is not set so the flow is testable locally.
 */
export async function sendShareInviteEmail(
  to: string,
  ownerName: string,
  inviteUrl: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    logger.warn("RESEND_API_KEY unset; share invite link (dev only)", {
      to,
      inviteUrl,
    });
    return;
  }

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: process.env.RESEND_FROM ?? "Daily Expenses <onboarding@resend.dev>",
      to,
      subject: `${ownerName} shared their Daily Expenses account with you`,
      text:
        `${ownerName} has invited you to view their Daily Expenses account as a read-only viewer.\n\n` +
        `Accept the invite here (link expires in 7 days):\n${inviteUrl}\n\n` +
        `You'll need a Daily Expenses account to accept. If you don't have one, sign up first.`,
    });
  } catch (err) {
    logger.error("Share invite email send failed", { err });
  }
}
