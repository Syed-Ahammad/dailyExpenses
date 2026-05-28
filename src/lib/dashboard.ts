/**
 * Dashboard aggregation logic (FR-10 through FR-14, FR-17, FR-18).
 *
 * DATE / TIMEZONE NOTE: all date boundaries are computed in UTC.
 * The app targets UAE (UTC+4), so "today" and "this week" will lag
 * real local time by 4 hours. This is a known Phase-1 simplification.
 * Week start is Monday (ISO 8601). Both assumptions should be confirmed
 * before shipping to real users and replaced with a proper user-timezone
 * offset if needed.
 *
 * MONEY NOTE: every transaction's base-currency contribution is
 *   amountMinor * rateToBase
 * rateToBase was captured at entry time — no live rate lookup is needed.
 * We sum the raw floating-point products and call Math.round() ONCE per
 * bucket to keep integer minor-unit output without per-transaction rounding
 * drift.
 */

import { TransactionModel } from "@/models/Transaction";
import { BudgetModel } from "@/models/Budget";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CategorySpend {
  category: string;
  spent: number; // integer, base-currency minor units
}

/** Budget usage status relative to its limit and warning threshold. */
export type BudgetLevel = "ok" | "near" | "over";

export interface BudgetWarning {
  category: string;
  level: "near" | "over";
  percent: number; // integer
}

/**
 * Single source of truth for the budget threshold rule (FR-17/FR-18).
 * Given current-month spend and a budget's limit + warning percent, returns
 * the integer usage percent and the status level.
 *
 * Shared by getDashboard()'s warnings and the /budgets management page so the
 * over/near/ok boundaries can never drift apart. A zero/negative limit yields
 * { percent: 0, level: "ok" } to avoid division by zero.
 *
 * @param spent          Current-month spend, base-currency minor units.
 * @param limitMinorBase Budget limit, base-currency minor units.
 * @param warnAtPercent  Threshold (1–100) at which the budget is "near".
 */
export function evaluateBudget(
  spent: number,
  limitMinorBase: number,
  warnAtPercent: number,
): { percent: number; level: BudgetLevel } {
  if (limitMinorBase <= 0) {
    return { percent: 0, level: "ok" };
  }
  const percent = Math.round((spent / limitMinorBase) * 100);
  const level: BudgetLevel =
    percent >= 100 ? "over" : percent >= warnAtPercent ? "near" : "ok";
  return { percent, level };
}

export interface DashboardTotals {
  expenseToday: number;
  expenseWeek: number;
  expenseMonth: number;
  incomeMonth: number;
  balanceMonth: number;
}

export interface DashboardResponse {
  totals: DashboardTotals;
  byCategory: CategorySpend[];
  warnings: BudgetWarning[];
}

// ---------------------------------------------------------------------------
// Internal aggregation interfaces (typed pipeline outputs)
// ---------------------------------------------------------------------------

interface FacetSumResult {
  total: number;
}

interface FacetCategoryResult {
  _id: string;
  total: number;
}

interface FacetOutput {
  expenseToday: FacetSumResult[];
  expenseWeek: FacetSumResult[];
  expenseMonth: FacetSumResult[];
  incomeMonth: FacetSumResult[];
  byCategoryMonth: FacetCategoryResult[];
}

// ---------------------------------------------------------------------------
// Date boundary helpers (all UTC)
// ---------------------------------------------------------------------------

/** Returns the UTC midnight that starts the current calendar day. */
function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/**
 * Returns the UTC midnight of the most recent Monday (ISO week start).
 * If today is Monday, returns today's midnight.
 */
function startOfCurrentWeekUtc(): Date {
  const now = new Date();
  // getUTCDay(): 0=Sun, 1=Mon, …, 6=Sat. We want Monday=0.
  const dayOfWeek = now.getUTCDay(); // 0–6
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - daysFromMonday,
    ),
  );
}

/** Returns UTC midnight of the 1st of the current month. */
function startOfCurrentMonthUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

/**
 * Computes dashboard aggregations for the given user.
 *
 * Uses a single $facet aggregation so the Transaction collection is
 * scanned once per request (NFR-2). Budgets are fetched in parallel.
 * All amounts in the response are integer base-currency minor units.
 *
 * @param userId - The authenticated user's ID (from getUserId()).
 */
export async function getDashboard(userId: string): Promise<DashboardResponse> {
  const today = startOfTodayUtc();
  const weekStart = startOfCurrentWeekUtc();
  const monthStart = startOfCurrentMonthUtc();

  // -------------------------------------------------------------------------
  // Single $facet aggregation over the Transaction collection.
  // Each facet is a sub-pipeline that filters and sums
  //   amountMinor * rateToBase
  // to get base-currency totals in one round trip.
  // -------------------------------------------------------------------------
  const [facetResult, budgets] = await Promise.all([
    TransactionModel.aggregate<FacetOutput>([
      // Pre-filter to the current user and current month at minimum
      // (all facets operate within [monthStart, now]; today/week are subsets).
      // This lets MongoDB use the { userId, occurredAt } index for the scan.
      {
        $match: {
          userId,
          occurredAt: { $gte: monthStart },
        },
      },
      {
        $facet: {
          // Total expense for today (UTC day)
          expenseToday: [
            {
              $match: {
                type: "expense",
                occurredAt: { $gte: today },
              },
            },
            {
              $group: {
                _id: null,
                // Sum the floating products; we round once after aggregation.
                total: { $sum: { $multiply: ["$amountMinor", "$rateToBase"] } },
              },
            },
          ],

          // Total expense for the current ISO week (Monday–now)
          expenseWeek: [
            {
              $match: {
                type: "expense",
                occurredAt: { $gte: weekStart },
              },
            },
            {
              $group: {
                _id: null,
                total: { $sum: { $multiply: ["$amountMinor", "$rateToBase"] } },
              },
            },
          ],

          // Total expense for the current month
          expenseMonth: [
            {
              $match: { type: "expense" },
            },
            {
              $group: {
                _id: null,
                total: { $sum: { $multiply: ["$amountMinor", "$rateToBase"] } },
              },
            },
          ],

          // Total income for the current month
          incomeMonth: [
            {
              $match: { type: "income" },
            },
            {
              $group: {
                _id: null,
                total: { $sum: { $multiply: ["$amountMinor", "$rateToBase"] } },
              },
            },
          ],

          // Per-category expense breakdown for the current month
          byCategoryMonth: [
            {
              $match: { type: "expense" },
            },
            {
              $group: {
                _id: "$category",
                total: { $sum: { $multiply: ["$amountMinor", "$rateToBase"] } },
              },
            },
          ],
        },
      },
    ]),

    // Fetch all budgets for this user in parallel with the aggregation
    BudgetModel.find({ userId }).lean<
      Array<{
        category: string;
        limitMinorBase: number;
        warnAtPercent: number;
      }>
    >(),
  ]);

  // -------------------------------------------------------------------------
  // Extract totals. A facet bucket is an empty array when no documents match,
  // so we default to 0 with optional chaining.
  // $facet always returns exactly one document (even when its sub-pipelines
  // match nothing), but the array type is T[] so we defensively fall back to
  // a zero-filled structure to satisfy strict null checks.
  // Round ONCE here — not per-transaction — to minimise accumulated drift.
  // -------------------------------------------------------------------------
  const emptyFacet: FacetOutput = {
    expenseToday: [],
    expenseWeek: [],
    expenseMonth: [],
    incomeMonth: [],
    byCategoryMonth: [],
  };
  const raw: FacetOutput = facetResult[0] ?? emptyFacet;

  const expenseMonth = Math.round(raw.expenseMonth[0]?.total ?? 0);
  const incomeMonth = Math.round(raw.incomeMonth[0]?.total ?? 0);

  const totals: DashboardTotals = {
    expenseToday: Math.round(raw.expenseToday[0]?.total ?? 0),
    expenseWeek: Math.round(raw.expenseWeek[0]?.total ?? 0),
    expenseMonth,
    incomeMonth,
    // FR-12: balance = income − expense for the month
    balanceMonth: incomeMonth - expenseMonth,
  };

  // -------------------------------------------------------------------------
  // byCategory: current-month expense spend per category, sorted desc.
  // Round each category total independently (not cumulative).
  // -------------------------------------------------------------------------
  const byCategory: CategorySpend[] = raw.byCategoryMonth
    .map((row) => ({
      category: row._id,
      spent: Math.round(row.total),
    }))
    .filter((row) => row.spent > 0) // exclude zero-spend categories
    .sort((a, b) => b.spent - a.spent);

  // -------------------------------------------------------------------------
  // Warnings (FR-17, FR-18): computed server-side for every budget.
  // Build a lookup map from byCategory for O(1) access.
  // -------------------------------------------------------------------------
  const spendByCategory = new Map<string, number>(
    byCategory.map((row) => [row.category, row.spent]),
  );

  const warnings: BudgetWarning[] = [];

  for (const budget of budgets) {
    const { percent, level } = evaluateBudget(
      spendByCategory.get(budget.category) ?? 0,
      budget.limitMinorBase,
      budget.warnAtPercent,
    );
    // FR-17 (near) / FR-18 (over): only surface budgets that crossed a threshold.
    if (level !== "ok") {
      warnings.push({ category: budget.category, level, percent });
    }
  }

  return { totals, byCategory, warnings };
}
