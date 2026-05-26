import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const subscriptionSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true },
    plan: { type: String, required: true },
    status: {
      type: String,
      enum: ["active", "past_due", "cancelled"],
      required: true,
    },
    providerId: { type: String },
    currentPeriodEnd: { type: Date },
  },
  { timestamps: true },
);

export type Subscription = InferSchemaType<typeof subscriptionSchema>;

export const SubscriptionModel: Model<Subscription> =
  (mongoose.models.Subscription as Model<Subscription> | undefined) ??
  mongoose.model<Subscription>("Subscription", subscriptionSchema);
