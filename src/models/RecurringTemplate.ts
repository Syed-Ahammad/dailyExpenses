import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const recurringTemplateSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    type: { type: String, enum: ["expense", "income"], required: true },
    amountMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true },
    category: { type: String, required: true },
    paymentMethod: {
      type: String,
      enum: ["cash", "card", "bank_transfer", "wallet", "cheque", "other"],
    },
    note: { type: String, maxlength: 500 },
    isVatable: { type: Boolean, default: false },
    vatRate: { type: Number, default: 0, min: 0, max: 100 },
    frequency: {
      type: String,
      enum: ["daily", "weekly", "monthly", "yearly"],
      required: true,
    },
    // When the next transaction should be generated.
    nextDueAt: { type: Date, required: true },
    // When the last transaction was generated (null = never fired yet).
    lastGeneratedAt: { type: Date },
    isActive: { type: Boolean, default: true },
    // Optional: stop generating after this date.
    endsAt: { type: Date },
  },
  { timestamps: true },
);

recurringTemplateSchema.index({ userId: 1, nextDueAt: 1 });

export type RecurringTemplate = InferSchemaType<typeof recurringTemplateSchema>;

export const RecurringTemplateModel: Model<RecurringTemplate> =
  (mongoose.models.RecurringTemplate as Model<RecurringTemplate> | undefined) ??
  mongoose.model<RecurringTemplate>("RecurringTemplate", recurringTemplateSchema);
