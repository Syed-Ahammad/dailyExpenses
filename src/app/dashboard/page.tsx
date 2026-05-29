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

import Link from "next/link";
import { connectMongo } from "@/lib/mongodb";
import { getUserId, getUserBaseCurrency } from "@/lib/auth";
import { getDashboard } from "@/lib/dashboard";
import type { DashboardResponse } from "@/lib/dashboard";
import { TransactionModel } from "@/models/Transaction";
import type { Transaction } from "@/models/Transaction";
import { logger } from "@/lib/logger";
import AddTransactionForm from "@/components/AddTransactionForm";
import TransactionList from "@/components/TransactionList";
import type { TransactionView } from "@/components/TransactionList";
import SignOutButton from "@/components/SignOutButton";

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
 * Call sites must always pass the user's baseCurrency explicitly.
 */
function formatMoney(minor: number, currency: string): string {
  // minor / 100 is the one and only place we divide by 100 in the UI.
  return `${currency} ${(minor / 100).toFixed(2)}`;
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
 * Base currency comes from the getUserBaseCurrency() seam (default USD). It
 * becomes `user.baseCurrency` once the User model and auth land in Phase 2.
 */
export default async function DashboardPage() {
  // getUserBaseCurrency() is the base-currency seam — Phase 2 makes it
  // return user.baseCurrency from the auth session.
  const baseCurrency = await getUserBaseCurrency();

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

  // Serializable view model for the client TransactionList (Dates → ISO strings,
  // ObjectId → string). Editing/deleting happens client-side against the API.
  const transactionViews: TransactionView[] = recentTransactions.map((tx) => ({
    id: String(tx._id),
    type: tx.type as "expense" | "income",
    amountMinor: tx.amountMinor,
    currency: tx.currency,
    category: tx.category,
    note: tx.note ?? "",
    occurredAt: new Date(tx.occurredAt).toISOString(),
  }));

  // For the proportional bars — find the max spend to normalise widths.
  const maxSpend =
    byCategory.length > 0
      ? Math.max(...byCategory.map((c) => c.spent))
      : 0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink sm:text-[34px]">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted">
            All amounts in {baseCurrency}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Link
            href="/budgets"
            className="rounded-pill px-3 py-1.5 text-sm font-medium text-green transition-colors hover:bg-green-soft focus:outline-none focus:ring-2 focus:ring-green-soft"
          >
            Manage budgets →
          </Link>
          <SignOutButton />
        </div>
      </div>

      {/* DB error banner — non-blocking, layout still renders */}
      {dbError && (
        <div
          role="alert"
          className="mb-6 rounded-md bg-red-bg px-4 py-3 text-sm text-red-ink"
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
            index={0}
            label="Expense Today"
            value={formatMoney(totals.expenseToday, baseCurrency)}
            variant="expense"
          />
          <SummaryCard
            index={1}
            label="Expense This Week"
            value={formatMoney(totals.expenseWeek, baseCurrency)}
            variant="expense"
          />
          <SummaryCard
            index={2}
            label="Expense This Month"
            value={formatMoney(totals.expenseMonth, baseCurrency)}
            variant="expense"
          />
          <SummaryCard
            index={3}
            label="Income This Month"
            value={formatMoney(totals.incomeMonth, baseCurrency)}
            variant="income"
          />
          <SummaryCard
            index={4}
            label="Balance This Month"
            value={formatMoney(totals.balanceMonth, baseCurrency)}
            variant="emphasized"
          />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Budget warnings — FR-17, FR-18                                      */}
      {/* ------------------------------------------------------------------ */}
      {warnings.length > 0 && (
        <section aria-label="Budget warnings" className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-ink">Budget Alerts</h2>
          <ul className="space-y-2">
            {warnings.map((w) => (
              <li
                key={w.category}
                className={`flex items-center justify-between rounded-md px-4 py-3 text-sm ${
                  w.level === "over"
                    ? "bg-red-bg text-red-ink"
                    : "bg-amber-bg text-amber-ink"
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
            <h2 className="mb-3 text-lg font-semibold text-ink">
              Spending by Category
            </h2>
            {byCategory.length === 0 ? (
              <p className="text-sm text-muted">No expenses this month.</p>
            ) : (
              <ul className="space-y-2.5">
                {byCategory.map((row) => {
                  // Proportional bar width — 100% for the top category, others scaled.
                  const widthPct =
                    maxSpend > 0
                      ? Math.round((row.spent / maxSpend) * 100)
                      : 0;
                  return (
                    <li key={row.category}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-ink">{row.category}</span>
                        <span className="font-display font-medium text-ink tabular-nums">
                          {formatMoney(row.spent, baseCurrency)}
                        </span>
                      </div>
                      {/* Proportional bar — width set via inline style for arbitrary % */}
                      <div className="h-2 w-full overflow-hidden rounded-pill bg-sand">
                        <div
                          className="h-full rounded-pill bg-green transition-[width] duration-[400ms] ease-out"
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
            <h2 className="mb-3 text-lg font-semibold text-ink">
              Recent Transactions
            </h2>
            <TransactionList
              baseCurrency={baseCurrency}
              transactions={transactionViews}
            />
          </section>
        </div>

        {/* Right column: add transaction form */}
        <div>
          <AddTransactionForm baseCurrency={baseCurrency} />
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
  /** expense → ink, income → green, emphasized → filled-green hero (balance). */
  variant: "expense" | "income" | "emphasized";
  /** Position in the row, for the staggered entrance delay (~60ms apart). */
  index: number;
}

function SummaryCard({ label, value, variant, index }: SummaryCardProps) {
  const emphasized = variant === "emphasized";

  // Money figures in the display serif; income green, expense ink, balance white
  // on the filled-green hero card (docs/design-system.md §3 color usage, §8).
  const cardClass = emphasized
    ? "bg-green shadow-md"
    : "border border-sand bg-card shadow-sm";
  const labelClass = emphasized ? "text-green-soft" : "text-muted";
  const valueClass =
    variant === "income"
      ? "text-green"
      : emphasized
        ? "text-card"
        : "text-ink";

  return (
    <div
      className={`animate-rise rounded-md p-4 ${cardClass}`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <p
        className={`text-[11px] font-medium uppercase tracking-label ${labelClass}`}
      >
        {label}
      </p>
      <p
        className={`mt-1.5 font-display text-2xl font-semibold leading-tight tabular-nums ${valueClass}`}
      >
        {value}
      </p>
    </div>
  );
}
