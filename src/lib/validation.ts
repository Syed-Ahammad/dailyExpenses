// Shared Zod schemas for API request validation.
// Category validation is type-aware (expense vs income) via superRefine.

import { z } from "zod";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "./categories";

const PAYMENT_METHODS = [
  "cash",
  "card",
  "bank_transfer",
  "wallet",
  "cheque",
  "other",
] as const;

const CATEGORY_SOURCES = ["manual", "ai_suggested", "ai_confirmed"] as const;

export const transactionInputSchema = z
  .object({
    type: z.enum(["expense", "income"]),
    amountMinor: z.number().int().nonnegative(),
    currency: z.string().length(3).toUpperCase(),
    rateToBase: z.number().positive().default(1),
    category: z.string(),
    paymentMethod: z.enum(PAYMENT_METHODS).optional(),
    note: z.string().max(500).optional(),
    isVatable: z.boolean().default(false),
    vatRate: z.number().min(0).max(100).default(0),
    categorySource: z.enum(CATEGORY_SOURCES).default("manual"),
    occurredAt: z.coerce.date(),
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
  });

export const budgetInputSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  limitMinorBase: z.number().int().positive(),
  warnAtPercent: z.number().int().min(1).max(100).default(80),
});

export type TransactionInput = z.infer<typeof transactionInputSchema>;
export type BudgetInput = z.infer<typeof budgetInputSchema>;
