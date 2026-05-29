import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

// Password reset tokens (docs/auth.md "Password reset"). We store only the
// SHA-256 hash of the token — the plain token lives only in the emailed link.
const passwordResetTokenSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// TTL: let MongoDB auto-purge tokens once they expire (defense-in-depth; the
// confirm route also rejects expired tokens explicitly).
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type PasswordResetToken = InferSchemaType<
  typeof passwordResetTokenSchema
>;

export const PasswordResetTokenModel: Model<PasswordResetToken> =
  (mongoose.models.PasswordResetToken as
    | Model<PasswordResetToken>
    | undefined) ??
  mongoose.model<PasswordResetToken>(
    "PasswordResetToken",
    passwordResetTokenSchema,
  );
