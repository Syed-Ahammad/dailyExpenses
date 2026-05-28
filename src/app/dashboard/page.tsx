/**
 * Dashboard page — Phase 1 core-loop UI.
 *
 * Renders summary totals, budget warnings, per-category spend breakdown,
 * recent transactions, and the AddTransactionForm.
 *
 * FR-5, FR-6 (via AddTransactionForm), FR-9 (rateToBase in recent list),
 * FR-10, FR-11, FR-12 (totals row), FR-13 (category breakdown),
 * FR-14 (base-currency aggregation), FR-17, FR-18 (budget warnings).
 * NFR-3 (mobile-first responsive layout).
 */

import { connectMongo } from "@/lib/mongodb";
import { getUserId } from "@/lib/auth";
import { getDashboard } from "@/lib/dashboard";
import type { DashboardResponse } from "@/lib/dashboard";
import { TransactionModel } from "@/models/Transaction";
import type { Transaction } from "@/models/Transaction";
import { logger } from "@/lib/logger";
import AddTransactionForm from "@/components/AddTransactionForm";

// The dashboard reflects live per-request data, so it must never be statically
// prerendered. Until auth (which reads the session) makes this implicit, force
// dynamic rendering explicitly so router.refresh() and fresh totals work.
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Money display helper
// ---------------------------------------------------------------------------

/**
 * Converts an integer minor-unit amount to a 2-decimal display string.
 * Division by 100 happens ONLY here — the display edge (NFR-1).
 * The currency label is the user's baseCurrency; defaulting to "AED" until
 * the User model and auth are wired in Phase 2.
 */
function formatMoney(minor: number, currency = "AED"): string {
  // minor / 100 is the one and only place we divide by 100 in the UI.
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-AE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Empty / zeroed fallbacks for the no-DB error path
// ---------------------------------------------------------------------------

const EMPTY_DASHBOARD: DashboardResponse = {
  totals: {
    expenseToday: 0,
    expenseWeek: 0,
    expenseMonth: 0,
    incomeMonth: 0,
    balanceMonth: 0,
  },
  byCategory: [],
  warnings: [],
};

// A lean Transaction document returned by .lean() — Mongoose returns plain objects.
type LeanTransaction = Transaction & { _id: unknown };

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

/**
 * DashboardPage — async Server Component.
 *
 * Loads aggregated totals via getDashboard() and up to 20 recent transactions
 * via a direct TransactionModel query. On any DB failure, it renders an error
 * banner and falls back to zeroed data so the page shell always renders.
 *
 * Base currency is currently hard-coded to "AED" as a display label. It will
 * become `user.baseCurrency` once the User model and auth land in Phase 2.
 */
export default async function DashboardPage() {
  // TODO Phase 2: replace "AED" with user.baseCurrency from session.
  const BASE_CURRENCY = "AED";

  let dashboard: DashboardResponse = EMPTY_DASHBOARD;
  let recentTransactions: LeanTransaction[] = [];
  let dbError = false;

  try {
    await connectMongo();
    const userId = await getUserId();

    // Run both queries in parallel — getDashboard already uses Promise.all
    // internally for its $facet + budgets fetch, so this adds a second parallel
    // stream for the recent-transactions list.
    const [dashResult, recentResult] = await Promise.all([
      getDashboard(userId),
      TransactionModel.find({ userId })
        .sort({ occurredAt: -1 })
        .limit(20)
        .lean<LeanTransaction[]>(),
    ]);

    dashboard = dashResult;
    recentTransactions = recentResult;
  } catch (err) {
    // Non-blocking error path: log and render with empty data.
    // The page shell (form, headings, layout) still renders correctly.
    logger.error("DashboardPage: failed to load data", { err });
    dbError = true;
  }

  const { totals, byCategory, warnings } = dashboard;

  // For the proportional bars — find the max spend to normalise widths.
  const maxSpend =
    byCategory.length > 0
      ? Math.max(...byCategory.map((c) => c.spent))
      : 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          All amounts in {BASE_CURRENCY}
        </p>
      </div>

      {/* DB error banner — non-blocking, layout still renders */}
      {dbError && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          Could not connect to the database. Showing empty data — your
          transactions are safe. Check your MONGODB_URI and try again.
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Summary cards — FR-10, FR-11, FR-12                                */}
      {/* ------------------------------------------------------------------ */}
      <section aria-label="Monthly summary" className="mb-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <SummaryCard
            label="Expense Today"
            value={formatMoney(totals.expenseToday, BASE_CURRENCY)}
            accent="red"
          />
          <SummaryCard
            label="Expense This Week"
            value={formatMoney(totals.expenseWeek, BASE_CURRENCY)}
            accent="red"
          />
          <SummaryCard
            label="Expense This Month"
            value={formatMoney(totals.expenseMonth, BASE_CURRENCY)}
            accent="red"
          />
          <SummaryCard
            label="Income This Month"
            value={formatMoney(totals.incomeMonth, BASE_CURRENCY)}
            accent="green"
          />
          <SummaryCard
            label="Balance This Month"
            value={formatMoney(totals.balanceMonth, BASE_CURRENCY)}
            accent={totals.balanceMonth >= 0 ? "green" : "red"}
          />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Budget warnings — FR-17, FR-18                                      */}
      {/* ------------------------------------------------------------------ */}
      {warnings.length > 0 && (
        <section aria-label="Budget warnings" className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-slate-800">
            Budget Alerts
          </h2>
          <ul className="space-y-2">
            {warnings.map((w) => (
              <li
                key={w.category}
                className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${
                  w.level === "over"
                    ? "border-red-200 bg-red-50 text-red-800"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                <span className="font-medium">{w.category}</span>
                <span>
                  {w.level === "over" ? "Over limit" : "Near limit"} —{" "}
                  {w.percent}% used
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column: category breakdown + recent transactions */}
        <div className="space-y-6">
          {/* ---------------------------------------------------------------- */}
          {/* Category breakdown — FR-13                                        */}
          {/* ---------------------------------------------------------------- */}
          <section aria-label="Category breakdown">
            <h2 className="mb-3 text-base font-semibold text-slate-800">
              Spending by Category
            </h2>
            {byCategory.length === 0 ? (
              <p className="text-sm text-slate-500">No expenses this month.</p>
            ) : (
              <ul className="space-y-2">
                {byCategory.map((row) => {
                  // Proportional bar width — 100% for the top category, others scaled.
                  const widthPct =
                    maxSpend > 0
                      ? Math.round((row.spent / maxSpend) * 100)
                      : 0;
                  return (
                    <li key={row.category}>
                      <div className="mb-0.5 flex items-center justify-between text-sm">
                        <span className="text-slate-700">{row.category}</span>
                        <span className="font-medium text-slate-900">
                          {formatMoney(row.spent, BASE_CURRENCY)}
                        </span>
                      </div>
                      {/* Proportional bar — width set via inline style for arbitrary % */}
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-slate-600"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* ---------------------------------------------------------------- */}
          {/* Recent transactions — last 20                                     */}
          {/* ---------------------------------------------------------------- */}
          <section aria-label="Recent transactions">
            <h2 className="mb-3 text-base font-semibold text-slate-800">
              Recent Transactions
            </h2>
            {recentTransactions.length === 0 ? (
              <p className="text-sm text-slate-500">
                No transactions recorded yet.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left">
                      <th className="px-4 py-2.5 font-medium text-slate-600">
                        Date
                      </th>
                      <th className="px-4 py-2.5 font-medium text-slate-600">
                        Category
                      </th>
                      <th className="px-4 py-2.5 font-medium text-slate-600">
                        Note
                      </th>
                      <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentTransactions.map((tx, i) => {
                      // Display amount: currency + major units.
                      // Expenses shown with a leading minus for visual clarity.
                      // Division by 100 is the UI display edge (NFR-1).
                      const majorDisplay = (tx.amountMinor / 100).toFixed(2);
                      const isExpense = tx.type === "expense";
                      return (
                        <tr
                          key={String(tx._id ?? i)}
                          className="hover:bg-slate-50"
                        >
                          <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                            {formatDate(tx.occurredAt)}
                          </td>
                          <td className="px-4 py-2.5 text-slate-700">
                            {tx.category}
                          </td>
                          <td className="max-w-[10rem] truncate px-4 py-2.5 text-slate-500">
                            {tx.note ?? "—"}
                          </td>
                          <td
                            className={`whitespace-nowrap px-4 py-2.5 text-right font-medium ${
                              isExpense
                                ? "text-red-600"
                                : "text-emerald-600"
                            }`}
                          >
                            {isExpense ? "−" : "+"}
                            {tx.currency} {majorDisplay}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Right column: add transaction form */}
        <div>
          <AddTransactionForm />
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Summary card sub-component (file-local, no separate file needed)
// ---------------------------------------------------------------------------

interface SummaryCardProps {
  label: string;
  value: string;
  accent: "green" | "red" | "neutral";
}

function SummaryCard({ label, value, accent }: SummaryCardProps) {
  const valueClass =
    accent === "green"
      ? "text-emerald-700"
      : accent === "red"
        ? "text-red-700"
        : "text-slate-900";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-1.5 text-lg font-semibold tabular-nums ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}
