// Transactional email (docs/decisions/providers.md → Resend).
//
// Graceful degradation: when RESEND_API_KEY is absent (local/dev), we log the
// link instead of sending, so the reset flow is testable without an email
// provider. Production must set RESEND_API_KEY + RESEND_FROM.

import { Resend } from "resend";
import { logger } from "./logger";

/**
 * Sends a password-reset link. Falls back to logging the link when no Resend
 * key is configured. Never throws to the caller's critical path — a failed
 * send must not reveal (via a 500) whether the email exists.
 */
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // Dev fallback — the link is logged so the flow can be exercised locally.
    logger.warn("RESEND_API_KEY unset; password-reset link (dev only)", {
      resetUrl,
    });
    return;
  }

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: process.env.RESEND_FROM ?? "Daily Expenses <onboarding@resend.dev>",
      to,
      subject: "Reset your Daily Expenses password",
      text:
        `Someone requested a password reset for your Daily Expenses account.\n\n` +
        `Reset it here (link expires in 1 hour):\n${resetUrl}\n\n` +
        `If you didn't request this, you can safely ignore this email.`,
    });
  } catch (err) {
    // Log and swallow — the request endpoint always returns 200 regardless.
    logger.error("Password-reset email send failed", { err });
  }
}
