/**
 * Budgets page — Phase 1 budget management UI.
 *
 * Lists the user's per-category budgets with live current-month usage
 * (spend vs limit, near/over status) and hosts the add/edit/delete controls.
 *
 * FR-15 (set budget), FR-16 (edit / remove budget). Usage display reuses the
 * dashboard's per-category spend (FR-13) and threshold rule (FR-17/FR-18) via
 * getDashboard() + evaluateBudget(), so the numbers can never drift from the
 * dashboard's budget alerts. NFR-3 (mobile-first).
 */

import Link from "next/link";
import { connectMongo } from "@/lib/mongodb";
import { getUserId, getUserBaseCurrency } from "@/lib/auth";
import { getDashboard, evaluateBudget } from "@/lib/dashboard";
import { BudgetModel } from "@/models/Budget";
import { logger } from "@/lib/logger";
import BudgetManager from "@/components/BudgetManager";
import type { BudgetView } from "@/components/BudgetManager";

// Budgets and their usage are live per-request data — never statically prerender,
// so router.refresh() after a mutation always re-fetches (matches the dashboard).
export const dynamic = "force-dynamic";

// A lean Budget document as returned by .lean().
interface LeanBudget {
  _id: unknown;
  category: string;
  limitMinorBase: number;
  warnAtPercent: number;
}

/**
 * BudgetsPage — async Server Component.
 *
 * Loads the editable budget docs and the current-month per-category spend in
 * parallel, merges them into a view model (with usage percent + level), and
 * passes it to the client BudgetManager. On any DB failure it renders an error
 * banner and an empty list so the page shell always renders.
 */
export default async function BudgetsPage() {
  // Base-currency seam (default USD); Phase 2 makes this user.baseCurrency.
  const baseCurrency = await getUserBaseCurrency();

  let budgetViews: BudgetView[] = [];
  let dbError = false;

  try {
    await connectMongo();
    const userId = await getUserId();

    // Editable budget docs + the dashboard aggregation (reused for spend).
    const [budgets, dashboard] = await Promise.all([
      BudgetModel.find({ userId })
        .sort({ category: 1 })
        .lean<LeanBudget[]>(),
      getDashboard(userId),
    ]);

    // category -> current-month spend (base-currency minor units).
    const spendByCategory = new Map(
      dashboard.byCategory.map((c) => [c.category, c.spent]),
    );

    budgetViews = budgets.map((b) => {
      const spent = spendByCategory.get(b.category) ?? 0;
      const { percent, level } = evaluateBudget(
        spent,
        b.limitMinorBase,
        b.warnAtPercent,
      );
      return {
        id: String(b._id),
        category: b.category,
        limitMinorBase: b.limitMinorBase,
        warnAtPercent: b.warnAtPercent,
        spent,
        percent,
        level,
      };
    });
  } catch (err) {
    // Non-blocking: log and render the shell with an empty list.
    logger.error("BudgetsPage: failed to load data", { err });
    dbError = true;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      {/* Page header with cross-navigation back to the dashboard */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Budgets
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Monthly limits per category, in {baseCurrency}.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="shrink-0 text-sm font-medium text-slate-600 hover:text-slate-900 hover:underline"
        >
          ← Dashboard
        </Link>
      </div>

      {dbError && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          Could not connect to the database. Showing an empty list — your budgets
          are safe. Check your MONGODB_URI and try again.
        </div>
      )}

      <BudgetManager baseCurrency={baseCurrency} budgets={budgetViews} />
    </main>
  );
}
