// Shared Zod schemas for API request validation.
// Category validation is type-aware (expense vs income) via superRefine.

import { z } from "zod";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "./categories";
import { isSupportedCurrency } from "./currencies";

const PAYMENT_METHODS = [
  "cash",
  "card",
  "bank_transfer",
  "wallet",
  "cheque",
  "other",
] as const;

const CATEGORY_SOURCES = ["manual", "ai_suggested", "ai_confirmed"] as const;

/**
 * Base ZodObject for a transaction. Exported separately so callers can call
 * .partial() on the raw object schema (ZodEffects does not expose .partial()).
 */
export const transactionBaseSchema = z.object({
  type: z.enum(["expense", "income"]),
  amountMinor: z.number().int().nonnegative(),
  currency: z
    .string()
    .length(3)
    .toUpperCase()
    .refine(isSupportedCurrency, "Unsupported currency"),
  rateToBase: z.number().positive().default(1),
  category: z.string(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  note: z.string().max(500).optional(),
  isVatable: z.boolean().default(false),
  vatRate: z.number().min(0).max(100).default(0),
  categorySource: z.enum(CATEGORY_SOURCES).default("manual"),
  // Phase 4 (FR-25): optional Cloudinary URL to the attached receipt image.
  // We only validate the shape here — the upload route is what produced it,
  // and that route restricts host/MIME at the boundary.
  receiptUrl: z.string().url().optional(),
  occurredAt: z.coerce.date(),
});

/**
 * Full create schema — adds cross-field category validation via superRefine.
 * Use this for POST (all required fields must be present).
 */
export const transactionInputSchema = transactionBaseSchema.superRefine(
  (val, ctx) => {
    const allowed =
      val.type === "expense"
        ? (EXPENSE_CATEGORIES as readonly string[])
        : (INCOME_CATEGORIES as readonly string[]);
    if (!allowed.includes(val.category)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["category"],
        message: `Invalid ${val.type} category: ${val.category}`,
      });
    }
  }
);

/**
 * Partial update schema for PATCH. All fields optional; cross-field category
 * validation is omitted because type and category may not both be present in a
 * partial update (the DB document already holds the authoritative values).
 */
export const transactionUpdateSchema = transactionBaseSchema.partial();

export const budgetInputSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  limitMinorBase: z.number().int().positive(),
  warnAtPercent: z.number().int().min(1).max(100).default(80),
});

/**
 * Partial update schema for PATCH /api/budgets/:id.
 * category is intentionally excluded — it is immutable after creation.
 */
export const budgetUpdateSchema = budgetInputSchema
  .pick({ limitMinorBase: true, warnAtPercent: true })
  .partial();

// ---------------------------------------------------------------------------
// Auth (Phase 2) — see docs/auth.md
// ---------------------------------------------------------------------------

/**
 * Password rule (docs/auth.md sign-up): min 10 chars, at least one letter and
 * one digit, no maximum. Shared by sign-up and password reset.
 */
const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .regex(/[A-Za-z]/, "Password must contain a letter")
  .regex(/[0-9]/, "Password must contain a digit");

/** Email is lowercased + trimmed at the boundary so storage stays canonical. */
const emailSchema = z.string().trim().toLowerCase().email("Invalid email");

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  baseCurrency: z
    .string()
    .length(3)
    .toUpperCase()
    .refine(isSupportedCurrency, "Unsupported currency"),
  name: z.string().trim().max(100).optional(),
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const resetRequestSchema = z.object({ email: emailSchema });

export const resetConfirmSchema = z.object({
  token: z.string().min(1, "Token is required"),
  newPassword: passwordSchema,
});

// ---------------------------------------------------------------------------
// Recurring templates (Phase 6 — FR-30, FR-31)
// ---------------------------------------------------------------------------

const FREQUENCIES = ["daily", "weekly", "monthly", "yearly"] as const;

export const recurringTemplateInputSchema = z
  .object({
    type: z.enum(["expense", "income"]),
    amountMinor: z.number().int().nonnegative(),
    currency: z
      .string()
      .length(3)
      .toUpperCase()
      .refine(isSupportedCurrency, "Unsupported currency"),
    category: z.string(),
    paymentMethod: z.enum(PAYMENT_METHODS).optional(),
    note: z.string().max(500).optional(),
    isVatable: z.boolean().default(false),
    vatRate: z.number().min(0).max(100).default(0),
    frequency: z.enum(FREQUENCIES),
    nextDueAt: z.coerce.date(),
    endsAt: z.coerce.date().optional(),
  })
  .superRefine((val, ctx) => {
    const allowed =
      val.type === "expense"
        ? (EXPENSE_CATEGORIES as readonly string[])
        : (INCOME_CATEGORIES as readonly string[]);
    if (!allowed.includes(val.category)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["category"],
        message: `Invalid ${val.type} category: ${val.category}`,
      });
    }
    if (val.endsAt && val.endsAt <= val.nextDueAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "`endsAt` must be after `nextDueAt`",
      });
    }
  });

export const recurringTemplateUpdateSchema = z.object({
  amountMinor: z.number().int().nonnegative().optional(),
  currency: z
    .string()
    .length(3)
    .toUpperCase()
    .refine(isSupportedCurrency, "Unsupported currency")
    .optional(),
  category: z.string().optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  note: z.string().max(500).optional(),
  isVatable: z.boolean().optional(),
  vatRate: z.number().min(0).max(100).optional(),
  frequency: z.enum(FREQUENCIES).optional(),
  nextDueAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  isActive: z.boolean().optional(),
});

export type RecurringTemplateInput = z.infer<typeof recurringTemplateInputSchema>;
export type RecurringTemplateUpdate = z.infer<typeof recurringTemplateUpdateSchema>;

export type TransactionInput = z.infer<typeof transactionInputSchema>;
export type TransactionUpdate = z.infer<typeof transactionUpdateSchema>;
export type BudgetInput = z.infer<typeof budgetInputSchema>;
export type BudgetUpdate = z.infer<typeof budgetUpdateSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type ResetRequestInput = z.infer<typeof resetRequestSchema>;
export type ResetConfirmInput = z.infer<typeof resetConfirmSchema>;
