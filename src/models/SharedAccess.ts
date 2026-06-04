import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const sharedAccessSchema = new Schema(
  {
    // The user who owns the data and issued the invite.
    ownerId: { type: String, required: true, index: true },
    // Normalized lowercase email of the person being invited.
    granteeEmail: { type: String, required: true, lowercase: true, trim: true },
    // Populated once the grantee accepts the invite.
    granteeId: { type: String },
    role: { type: String, enum: ["viewer"], default: "viewer" },
    status: {
      type: String,
      enum: ["pending", "active", "revoked"],
      default: "pending",
    },
    // SHA-256 of the plain invite token sent in the link. Never store plain token.
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

sharedAccessSchema.index({ granteeId: 1, status: 1 });
sharedAccessSchema.index({ tokenHash: 1 });
// One pending/active invite per owner+email pair.
sharedAccessSchema.index(
  { ownerId: 1, granteeEmail: 1 },
  {
    partialFilterExpression: { status: { $in: ["pending", "active"] } },
  },
);

export type SharedAccess = InferSchemaType<typeof sharedAccessSchema>;

export const SharedAccessModel: Model<SharedAccess> =
  (mongoose.models.SharedAccess as Model<SharedAccess> | undefined) ??
  mongoose.model<SharedAccess>("SharedAccess", sharedAccessSchema);
