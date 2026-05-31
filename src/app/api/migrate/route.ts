/**
 * POST /api/migrate — migrate guest localStorage data to the authenticated user's account.
 *
 * Called immediately after sign-up + sign-in. Accepts arrays of guest
 * transactions and budgets. Deduplicates on clientId so retrying is safe.
 * Returns counts of newly inserted records.
 *
 * FR-guest (14-day trial migration).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserId } from "@/lib/auth";
import { connectMongo } from "@/lib/mongodb";
import { TransactionModel } from "@/models/Transaction";
import { BudgetModel } from "@/models/Budget";
import { isSupportedCurrency } from "@/lib/currencies";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/categories";

const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES] as readonly string[];

const guestTransactionSchema = z.object({
  clientId: z.string().min(1),
  type: z.enum(["expense", "income"]),
  amountMinor: z.number().int().nonnegative(),
  currency: z.string().length(3).toUpperCase().refine(isSupportedCurrency, "Unsupported currency"),
  rateToBase: z.number().positive().default(1),
  category: z.string().refine((v) => ALL_CATEGORIES.includes(v), "Invalid category"),
  note: z.string().max(500).optional().default(""),
  isVatable: z.boolean().default(false),
  vatRate: z.number().min(0).max(100).default(0),
  occurredAt: z.coerce.date(),
  receiptUrl: z.null().or(z.string().url()).optional().default(null),
});

const guestBudgetSchema = z.object({
  clientId: z.string().min(1),
  category: z.enum(EXPENSE_CATEGORIES),
  limitMinorBase: z.number().int().positive(),
  warnAtPercent: z.number().int().min(1).max(100).default(80),
});

const migrateSchema = z.object({
  transactions: z.array(guestTransactionSchema).max(500),
  budgets: z.array(guestBudgetSchema).max(100).optional().default([]),
});

export async function POST(req: Request): Promise<NextResponse> {
  let userId: string;
  try {
    userId = await getUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = migrateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { transactions, budgets } = parsed.data;

  await connectMongo();

  // Transactions — dedupe on clientId per user
  let migratedTransactions = 0;
  if (transactions.length > 0) {
    const existingClientIds = new Set(
      (
        await TransactionModel.find(
          { userId, clientId: { $in: transactions.map((t) => t.clientId) } },
          { clientId: 1, _id: 0 },
        ).lean()
      ).map((t) => (t as { clientId: string }).clientId),
    );

    const newTransactions = transactions
      .filter((t) => !existingClientIds.has(t.clientId))
      .map((t) => ({
        userId,
        clientId: t.clientId,
        type: t.type,
        amountMinor: t.amountMinor,
        currency: t.currency,
        rateToBase: t.rateToBase,
        category: t.category,
        paymentMethod: "other" as const,
        note: t.note,
        isVatable: t.isVatable,
        vatRate: t.vatRate,
        categorySource: "manual" as const,
        receiptUrl: t.receiptUrl ?? undefined,
        occurredAt: t.occurredAt,
      }));

    if (newTransactions.length > 0) {
      await TransactionModel.insertMany(newTransactions, { ordered: false });
      migratedTransactions = newTransactions.length;
    }
  }

  // Budgets — dedupe on clientId per user
  let migratedBudgets = 0;
  if (budgets.length > 0) {
    const existingClientIds = new Set(
      (
        await BudgetModel.find(
          { userId, clientId: { $in: budgets.map((b) => b.clientId) } },
          { clientId: 1, _id: 0 },
        ).lean()
      ).map((b) => (b as { clientId: string }).clientId),
    );

    const newBudgets = budgets
      .filter((b) => !existingClientIds.has(b.clientId))
      .map((b) => ({
        userId,
        clientId: b.clientId,
        category: b.category,
        limitMinorBase: b.limitMinorBase,
        warnAtPercent: b.warnAtPercent,
      }));

    if (newBudgets.length > 0) {
      await BudgetModel.insertMany(newBudgets, { ordered: false });
      migratedBudgets = newBudgets.length;
    }
  }

  return NextResponse.json({ migratedTransactions, migratedBudgets }, { status: 200 });
}
