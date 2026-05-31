// Recurring template helpers — server-only.
// advanceNextDue: compute the next fire date given a frequency.
// generateDueTransactions: create Transaction docs for all overdue templates.

import { connectMongo } from "@/lib/mongodb";
import { RecurringTemplateModel } from "@/models/RecurringTemplate";
import { TransactionModel } from "@/models/Transaction";
import { UserModel } from "@/models/User";
import { getRate } from "@/lib/rates";
import { logger } from "@/lib/logger";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currencies";

export type Frequency = "daily" | "weekly" | "monthly" | "yearly";

/**
 * Returns the next due date after `date` for the given frequency.
 * Month-rollover (e.g. Jan 31 → Mar 3) follows JavaScript's native Date
 * semantics — acceptable for a first implementation.
 */
export function advanceNextDue(date: Date, frequency: Frequency): Date {
  const next = new Date(date);
  switch (frequency) {
    case "daily":
      next.setUTCDate(next.getUTCDate() + 1);
      break;
    case "weekly":
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case "monthly":
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
    case "yearly":
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      break;
  }
  return next;
}

/**
 * Finds every active template whose nextDueAt is in the past (or now) and
 * creates a Transaction for each. Advances nextDueAt and records
 * lastGeneratedAt. Deactivates templates past their endsAt.
 *
 * Returns the number of transactions created.
 */
export async function generateDueTransactions(): Promise<number> {
  await connectMongo();
  const now = new Date();

  const due = await RecurringTemplateModel.find({
    isActive: true,
    nextDueAt: { $lte: now },
  }).lean();

  if (due.length === 0) return 0;

  // Pre-fetch base currencies for every distinct userId in one query.
  const userIds = [...new Set(due.map((t) => t.userId))];
  const users = await UserModel.find({ _id: { $in: userIds } })
    .select("baseCurrency")
    .lean<{ _id: unknown; baseCurrency?: string }[]>();

  const baseCurrencyMap = new Map<string, string>(
    users.map((u) => [String(u._id), u.baseCurrency ?? DEFAULT_BASE_CURRENCY]),
  );

  let created = 0;

  for (const template of due) {
    try {
      const baseCurrency =
        baseCurrencyMap.get(template.userId) ?? DEFAULT_BASE_CURRENCY;

      // Fetch current exchange rate; default 1 on failure (same-currency or
      // provider unavailable — transaction is still recorded, rate may be off).
      let rateToBase = 1;
      if (template.currency !== baseCurrency) {
        const fetched = await getRate(template.currency, baseCurrency);
        if (fetched !== null) rateToBase = fetched;
      }

      await TransactionModel.create({
        userId: template.userId,
        type: template.type,
        amountMinor: template.amountMinor,
        currency: template.currency,
        rateToBase,
        category: template.category,
        paymentMethod: template.paymentMethod,
        note: template.note,
        isVatable: template.isVatable,
        vatRate: template.vatRate,
        categorySource: "manual",
        occurredAt: template.nextDueAt,
      });

      created += 1;

      const nextDue = advanceNextDue(
        template.nextDueAt as Date,
        template.frequency as Frequency,
      );

      // Deactivate if the next occurrence falls past endsAt.
      const shouldDeactivate =
        template.endsAt != null && nextDue > (template.endsAt as Date);

      await RecurringTemplateModel.updateOne(
        { _id: template._id },
        {
          $set: {
            nextDueAt: nextDue,
            lastGeneratedAt: now,
            ...(shouldDeactivate ? { isActive: false } : {}),
          },
        },
      );
    } catch (err) {
      logger.error("Failed to generate transaction for template", {
        templateId: String(template._id),
        err,
      });
    }
  }

  return created;
}
