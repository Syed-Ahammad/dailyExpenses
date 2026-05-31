import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Optional: not set for OAuth-only accounts (Google, etc.)
    passwordHash: { type: String },
    name: { type: String },
    baseCurrency: {
      type: String,
      required: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
    },
  },
  { timestamps: true },
);

export type User = InferSchemaType<typeof userSchema>;

export const UserModel: Model<User> =
  (mongoose.models.User as Model<User> | undefined) ??
  mongoose.model<User>("User", userSchema);
