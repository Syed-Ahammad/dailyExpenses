/**
 * Read-only shared view — FR-33.
 * Shown to a viewer who has been granted access by the owner.
 * Verifies permission server-side, then renders dashboard + export panel.
 */

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { connectMongo } from "@/lib/mongodb";
import { auth } from "@/lib/auth";
import { verifyViewerAccess } from "@/lib/sharing";
import { getDashboard } from "@/lib/dashboard";
import { TransactionModel } from "@/models/Transaction";
import type { Transaction } from "@/models/Transaction";
import { UserModel } from "@/models/User";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currencies";
import SharedExportPanel from "./SharedExportPanel";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ ownerId: string }> };

function formatMoney(minor: number, currency: string): string {
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-AE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function SharedPage({ params }: Props) {
  const { ownerId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  await connectMongo();

  const hasAccess = await verifyViewerAccess(session.user.id, ownerId);
  if (!hasAccess) notFound();

  const owner = await UserModel.findById(ownerId)
    .select("email name baseCurrency")
    .lean<{ email: string; name?: string; baseCurrency?: string } | null>();
  if (!owner) notFound();

  const baseCurrency = owner.baseCurrency ?? DEFAULT_BASE_CURRENCY;
  const ownerLabel = owner.name ?? owner.email;

  const [dashboard, recentTxs] = await Promise.all([
    getDashboard(ownerId),
    TransactionModel.find({ userId: ownerId })
      .sort({ occurredAt: -1 })
      .limit(30)
      .lean<Transaction[]>(),
  ]);

  const { totals, byCategory, warnings } = dashboard;

  return (
    <main className="min-h-dvh bg-paper px-4 py-10">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <Link
              href="/dashboard"
              className="text-sm text-muted hover:text-ink"
            >
              ← Your dashboard
            </Link>
            <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">
              {ownerLabel}
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sand px-2.5 py-0.5 text-xs text-muted">
              <svg
                className="h-3 w-3"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M8 1a4 4 0 1 1 0 8A4 4 0 0 1 8 1zm0 9c-4 0-6 1.5-6 3v1h12v-1c0-1.5-2-3-6-3z"
                  stroke="currentColor"
                  strokeWidth="1.25"
                  strokeLinejoin="round"
                />
              </svg>
              Read-only view
            </span>
          </div>
        </div>

        {/* Budget warnings */}
        {warnings.length > 0 && (
          <section className="mb-6">
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

        {/* Summary cards */}
        <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Today", value: formatMoney(totals.expenseToday, baseCurrency), sub: "expenses" },
            { label: "This week", value: formatMoney(totals.expenseWeek, baseCurrency), sub: "expenses" },
            { label: "This month", value: formatMoney(totals.expenseMonth, baseCurrency), sub: "expenses" },
            { label: "Income", value: formatMoney(totals.incomeMonth, baseCurrency), sub: "this month" },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-lg border border-sand bg-card p-4 shadow-sm"
            >
              <p className="text-xs text-muted">{card.label}</p>
              <p className="font-display text-base font-semibold text-ink">
                {card.value}
              </p>
              <p className="text-xs text-muted">{card.sub}</p>
            </div>
          ))}
        </section>

        {/* Balance */}
        <div className="mb-8 rounded-lg border border-green/30 bg-card p-4 shadow-sm">
          <p className="text-xs text-muted">Balance this month</p>
          <p
            className={`font-display text-2xl font-bold ${
              totals.balanceMonth >= 0 ? "text-green" : "text-red-ink"
            }`}
          >
            {formatMoney(totals.balanceMonth, baseCurrency)}
          </p>
        </div>

        {/* Category breakdown */}
        {byCategory.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-base font-semibold text-ink">
              This month by category
            </h2>
            <ul className="divide-y divide-sand rounded-lg border border-sand bg-card shadow-sm">
              {byCategory.map((c) => (
                <li
                  key={c.category}
                  className="flex items-center justify-between px-4 py-2.5"
                >
                  <span className="text-sm text-ink">{c.category}</span>
                  <span className="font-display text-sm font-medium text-ink">
                    {formatMoney(c.spent, baseCurrency)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Recent transactions */}
        {recentTxs.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-base font-semibold text-ink">
              Recent transactions
            </h2>
            <ul className="divide-y divide-sand rounded-lg border border-sand bg-card shadow-sm">
              {recentTxs.map((tx) => (
                <li
                  key={String((tx as { _id?: unknown })._id ?? "")}
                  className="flex items-start justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {tx.note ?? tx.category}
                    </p>
                    <p className="text-xs text-muted">
                      {tx.category} · {formatDate(tx.occurredAt)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 font-display text-sm font-semibold ${
                      tx.type === "income" ? "text-green" : "text-ink"
                    }`}
                  >
                    {tx.type === "income" ? "+" : "−"}
                    {formatMoney(tx.amountMinor, tx.currency)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Export panel */}
        <SharedExportPanel ownerId={ownerId} baseCurrency={baseCurrency} />
      </div>
    </main>
  );
}
