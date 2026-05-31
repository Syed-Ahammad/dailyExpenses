import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const budgetSchema = new Schema(
  {
    userId: { type: String, required: true },
    // Idempotency key set by the guest-migration flow (POST /api/migrate).
    clientId: { type: String, sparse: true },
    category: { type: String, required: true },
    limitMinorBase: { type: Number, required: true, min: 0 },
    warnAtPercent: { type: Number, default: 80, min: 1, max: 100 },
  },
  { timestamps: true },
);

budgetSchema.index({ userId: 1, category: 1 }, { unique: true });

export type Budget = InferSchemaType<typeof budgetSchema>;

export const BudgetModel: Model<Budget> =
  (mongoose.models.Budget as Model<Budget> | undefined) ??
  mongoose.model<Budget>("Budget", budgetSchema);
