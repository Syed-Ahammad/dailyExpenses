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

export type TransactionInput = z.infer<typeof transactionInputSchema>;
export type TransactionUpdate = z.infer<typeof transactionUpdateSchema>;
export type BudgetInput = z.infer<typeof budgetInputSchema>;
export type BudgetUpdate = z.infer<typeof budgetUpdateSchema>;
