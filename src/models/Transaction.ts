import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const transactionSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    type: { type: String, enum: ["expense", "income"], required: true },
    amountMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true },
    rateToBase: { type: Number, required: true, default: 1 },
    category: { type: String, required: true },
    paymentMethod: {
      type: String,
      enum: ["cash", "card", "bank_transfer", "wallet", "cheque", "other"],
    },
    note: { type: String, maxlength: 500 },
    isVatable: { type: Boolean, default: false },
    vatRate: { type: Number, default: 0, min: 0, max: 100 },
    categorySource: {
      type: String,
      enum: ["manual", "ai_suggested", "ai_confirmed"],
      default: "manual",
    },
    receiptUrl: { type: String },
    occurredAt: { type: Date, required: true },
  },
  { timestamps: true },
);

transactionSchema.index({ userId: 1, occurredAt: -1 });

export type Transaction = InferSchemaType<typeof transactionSchema>;

export const TransactionModel: Model<Transaction> =
  (mongoose.models.Transaction as Model<Transaction> | undefined) ??
  mongoose.model<Transaction>("Transaction", transactionSchema);
