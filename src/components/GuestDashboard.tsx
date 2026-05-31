"use client";

/**
 * GuestDashboard — full client-side dashboard for unauthenticated visitors.
 * Reads and writes from localStorage via guestStore.
 * Includes trial notice (toast → amber warning → red banner + modal).
 * FR-guest (14-day trial, localStorage persistence, migration-ready data shape).
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as guestStore from "@/lib/guestStore";
import type { GuestTransaction } from "@/lib/guestStore";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/categories";
import { CURRENCIES, DEFAULT_BASE_CURRENCY } from "@/lib/currencies";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatMoney(minor: number, currency: string): string {
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Totals {
  expenseToday: number;
  expenseWeek: number;
  expenseMonth: number;
  incomeMonth: number;
  balanceMonth: number;
}

function computeTotals(txs: GuestTransaction[]): Totals {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // Start of current week (Monday)
  const dayOfWeek = (now.getDay() + 6) % 7; // 0=Mon
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);

  const monthStr = now.toISOString().slice(0, 7); // "YYYY-MM"

  let expenseToday = 0;
  let expenseWeek = 0;
  let expenseMonth = 0;
  let incomeMonth = 0;

  for (const tx of txs) {
    const txDate = new Date(tx.occurredAt);
    const inBase = tx.amountMinor * tx.rateToBase;

    if (tx.type === "expense") {
      const txDateStr = tx.occurredAt.slice(0, 10);
      if (txDateStr === todayStr) expenseToday += inBase;
      if (txDate >= weekStart) expenseWeek += inBase;
      if (tx.occurredAt.slice(0, 7) === monthStr) expenseMonth += inBase;
    } else {
      if (tx.occurredAt.slice(0, 7) === monthStr) incomeMonth += inBase;
    }
  }

  return {
    expenseToday: Math.round(expenseToday),
    expenseWeek: Math.round(expenseWeek),
    expenseMonth: Math.round(expenseMonth),
    incomeMonth: Math.round(incomeMonth),
    balanceMonth: Math.round(incomeMonth - expenseMonth),
  };
}

interface CategoryRow {
  category: string;
  spent: number;
}

function computeByCategory(txs: GuestTransaction[]): CategoryRow[] {
  const monthStr = new Date().toISOString().slice(0, 7);
  const map = new Map<string, number>();
  for (const tx of txs) {
    if (tx.type !== "expense") continue;
    if (tx.occurredAt.slice(0, 7) !== monthStr) continue;
    map.set(tx.category, (map.get(tx.category) ?? 0) + tx.amountMinor * tx.rateToBase);
  }
  return Array.from(map.entries())
    .map(([category, spent]) => ({ category, spent: Math.round(spent) }))
    .sort((a, b) => b.spent - a.spent);
}

// Derive a display currency from transactions (first tx's currency, else default).
function displayCurrencyFrom(txs: GuestTransaction[]): string {
  return txs[0]?.currency ?? DEFAULT_BASE_CURRENCY;
}

// ---------------------------------------------------------------------------
// Trial notice sub-components
// ---------------------------------------------------------------------------

function WelcomeToast({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-rise"
      style={{ animationDuration: "300ms" }}
    >
      <div className="flex items-center gap-3 rounded-full border border-sand bg-card px-5 py-3 shadow-md text-sm text-ink">
        <span>
          You&apos;re using Daily Expenses as a guest. Data is saved on this
          device for 14 days.
        </span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="ml-1 rounded-full p-0.5 text-muted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-green-soft"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function WarningBanner({ daysRemaining }: { daysRemaining: number }) {
  return (
    <div
      role="status"
      className="mb-6 flex items-center justify-between rounded-md bg-amber-bg px-4 py-3 text-sm text-amber-ink"
    >
      <span>
        Trial ends in{" "}
        <strong>
          {daysRemaining} {daysRemaining === 1 ? "day" : "days"}
        </strong>
        . Sign up to keep your data.
      </span>
      <Link
        href="/sign-up"
        className="ml-4 shrink-0 rounded-md border border-amber-ink px-3 py-1 text-xs font-medium hover:bg-amber-ink hover:text-card transition-colors"
      >
        Sign up free
      </Link>
    </div>
  );
}

function ExpiredBanner() {
  return (
    <div
      role="alert"
      className="mb-6 flex items-center justify-between rounded-md bg-red-bg px-4 py-3 text-sm text-red-ink"
    >
      <span>
        Your 14-day trial has ended. Sign up to keep your data.
      </span>
      <Link
        href="/sign-up"
        className="ml-4 shrink-0 rounded-md border border-red-ink px-3 py-1 text-xs font-medium hover:bg-red-ink hover:text-card transition-colors"
      >
        Sign up free
      </Link>
    </div>
  );
}

function SignUpModal({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Trial ended"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"
    >
      <div className="w-full max-w-sm rounded-lg border border-sand bg-card p-7 shadow-xl">
        <h2 className="text-lg font-semibold text-ink">Your trial has ended</h2>
        <p className="mt-2 text-sm text-muted">
          Your guest data is still here. Create a free account to save it to the
          cloud and keep using Daily Expenses.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/sign-up"
            className="flex-1 rounded-md bg-green px-4 py-2.5 text-center text-sm font-medium text-card transition-[transform,opacity] hover:opacity-90 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-green-soft"
          >
            Create account
          </Link>
          <button
            type="button"
            onClick={onDismiss}
            className="flex-1 rounded-md border border-sand px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-paper focus:outline-none focus-visible:ring-2 focus-visible:ring-green-soft"
          >
            Continue as guest
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add-transaction form
// ---------------------------------------------------------------------------

const inputClass =
  "w-full rounded-md border border-sand bg-card px-3 py-2.5 text-sm text-ink " +
  "placeholder:text-muted transition-colors " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-green-soft " +
  "disabled:bg-paper disabled:text-muted disabled:cursor-not-allowed";

interface AddFormProps {
  onAdded: (tx: GuestTransaction) => void;
}

function AddTransactionForm({ onAdded }: AddFormProps) {
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(DEFAULT_BASE_CURRENCY);
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayISO());
  const [isVatable, setIsVatable] = useState(false);
  const [vatRate, setVatRate] = useState("5");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryOptions = type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  function handleTypeToggle(next: "expense" | "income") {
    setType(next);
    // Reset category to first option of the new type.
    setCategory(
      next === "expense" ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0],
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Enter a positive amount.");
      return;
    }
    if (!date) {
      setError("Pick a date.");
      return;
    }
    const vatRateNum = isVatable ? parseFloat(vatRate) : 0;
    if (isVatable && (isNaN(vatRateNum) || vatRateNum < 0 || vatRateNum > 100)) {
      setError("VAT rate must be 0–100.");
      return;
    }

    setSubmitting(true);
    const tx = guestStore.addTransaction({
      type,
      amountMinor: Math.round(amountNum * 100),
      currency,
      rateToBase: 1,
      category,
      note: note.trim(),
      isVatable,
      vatRate: vatRateNum,
      occurredAt: new Date(date).toISOString(),
    });
    setAmount("");
    setNote("");
    setDate(todayISO());
    setIsVatable(false);
    setSubmitting(false);
    onAdded(tx);
  }

  return (
    <div className="rounded-lg border border-sand bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-ink">Add Transaction</h2>

      {error && (
        <p role="alert" className="mb-3 rounded-md bg-red-bg px-3 py-2 text-sm text-red-ink">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type toggle */}
        <div className="flex gap-2">
          {(["expense", "income"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => handleTypeToggle(t)}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-soft ${
                type === t
                  ? "bg-green text-card"
                  : "border border-sand bg-paper text-muted hover:text-ink"
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Amount + currency */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label htmlFor="g-amount" className="mb-1 block text-xs font-medium text-muted">
              Amount
            </label>
            <input
              id="g-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              required
              disabled={submitting}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputClass}
              placeholder="0.00"
            />
          </div>
          <div className="w-28">
            <label htmlFor="g-currency" className="mb-1 block text-xs font-medium text-muted">
              Currency
            </label>
            <select
              id="g-currency"
              disabled={submitting}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={`${inputClass} bg-card`}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Category */}
        <div>
          <label htmlFor="g-category" className="mb-1 block text-xs font-medium text-muted">
            Category
          </label>
          <select
            id="g-category"
            disabled={submitting}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={`${inputClass} bg-card`}
          >
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Note + Date */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="g-note" className="mb-1 block text-xs font-medium text-muted">
              Note
            </label>
            <input
              id="g-note"
              type="text"
              maxLength={500}
              disabled={submitting}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={inputClass}
              placeholder="Optional"
            />
          </div>
          <div>
            <label htmlFor="g-date" className="mb-1 block text-xs font-medium text-muted">
              Date
            </label>
            <input
              id="g-date"
              type="date"
              required
              disabled={submitting}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {/* VAT */}
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={isVatable}
              onChange={(e) => setIsVatable(e.target.checked)}
              className="accent-green"
            />
            VAT applies
          </label>
          {isVatable && (
            <div className="flex items-center gap-1.5">
              <label htmlFor="g-vatrate" className="text-xs text-muted">Rate %</label>
              <input
                id="g-vatrate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={vatRate}
                onChange={(e) => setVatRate(e.target.value)}
                className="w-20 rounded-sm border border-sand px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-soft"
              />
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-green px-4 py-2.5 text-sm font-medium text-card transition-[transform,opacity] hover:opacity-90 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-green-soft focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Adding…" : "Add transaction"}
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Guest transaction list
// ---------------------------------------------------------------------------

interface GuestListProps {
  transactions: GuestTransaction[];
  onChanged: () => void;
}

function GuestTransactionList({ transactions, onChanged }: GuestListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState<string>("");
  const [editDate, setEditDate] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editIsVatable, setEditIsVatable] = useState(false);
  const [editVatRate, setEditVatRate] = useState("5");
  const [error, setError] = useState<string | null>(null);

  function startEdit(tx: GuestTransaction) {
    setEditingId(tx.id);
    setEditAmount((tx.amountMinor / 100).toFixed(2));
    setEditCategory(tx.category);
    setEditDate(tx.occurredAt.slice(0, 10));
    setEditNote(tx.note);
    setEditIsVatable(tx.isVatable);
    setEditVatRate(tx.isVatable && tx.vatRate > 0 ? String(tx.vatRate) : "5");
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setError(null);
  }

  function handleSave(tx: GuestTransaction) {
    setError(null);
    const amountNum = parseFloat(editAmount);
    if (isNaN(amountNum) || amountNum <= 0) { setError("Amount must be positive."); return; }
    if (!editCategory) { setError("Pick a category."); return; }
    if (!editDate) { setError("Pick a date."); return; }
    const vatRateNum = editIsVatable ? parseFloat(editVatRate) : 0;
    if (editIsVatable && (isNaN(vatRateNum) || vatRateNum < 0 || vatRateNum > 100)) {
      setError("VAT rate must be 0–100.");
      return;
    }
    guestStore.updateTransaction(tx.id, {
      amountMinor: Math.round(amountNum * 100),
      category: editCategory,
      occurredAt: new Date(editDate).toISOString(),
      note: editNote.trim(),
      isVatable: editIsVatable,
      vatRate: vatRateNum,
    });
    setEditingId(null);
    onChanged();
  }

  function handleDelete(tx: GuestTransaction) {
    const label = tx.note.trim() || tx.category;
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;
    guestStore.deleteTransaction(tx.id);
    onChanged();
  }

  if (transactions.length === 0) {
    return <p className="text-sm text-muted">No transactions yet. Add one above!</p>;
  }

  const rowInputClass =
    "w-full rounded-sm border border-sand px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-soft";

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="rounded-md bg-red-bg px-4 py-3 text-sm text-red-ink">
          {error}
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-sand">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-paper text-left">
              <th className="px-4 py-2.5 font-medium text-muted">Date</th>
              <th className="px-4 py-2.5 font-medium text-muted">Category</th>
              <th className="px-4 py-2.5 font-medium text-muted">Note</th>
              <th className="px-4 py-2.5 text-right font-medium text-muted">Amount</th>
              <th className="px-4 py-2.5 text-right font-medium text-muted">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand">
            {transactions.map((tx) => {
              const isEditing = editingId === tx.id;
              const isExpense = tx.type === "expense";
              const majorDisplay = (tx.amountMinor / 100).toFixed(2);
              const categoryOptions = isExpense ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

              if (isEditing) {
                return (
                  <tr key={tx.id} className="bg-paper">
                    <td colSpan={5} className="px-4 py-4">
                      <div className="grid gap-3 sm:grid-cols-4">
                        <div>
                          <label htmlFor={`ge-amt-${tx.id}`} className="mb-1 block text-xs font-medium text-muted">
                            Amount ({tx.currency})
                          </label>
                          <input
                            id={`ge-amt-${tx.id}`}
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0.01"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className={rowInputClass}
                          />
                        </div>
                        <div>
                          <label htmlFor={`ge-cat-${tx.id}`} className="mb-1 block text-xs font-medium text-muted">
                            Category
                          </label>
                          <select
                            id={`ge-cat-${tx.id}`}
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            className={`${rowInputClass} bg-card`}
                          >
                            {categoryOptions.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor={`ge-date-${tx.id}`} className="mb-1 block text-xs font-medium text-muted">
                            Date
                          </label>
                          <input
                            id={`ge-date-${tx.id}`}
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className={rowInputClass}
                          />
                        </div>
                        <div>
                          <label htmlFor={`ge-note-${tx.id}`} className="mb-1 block text-xs font-medium text-muted">
                            Note
                          </label>
                          <input
                            id={`ge-note-${tx.id}`}
                            type="text"
                            maxLength={500}
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            className={rowInputClass}
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-ink">
                          <input
                            type="checkbox"
                            checked={editIsVatable}
                            onChange={(e) => setEditIsVatable(e.target.checked)}
                            className="accent-green"
                          />
                          VAT applies
                        </label>
                        {editIsVatable && (
                          <div className="flex items-center gap-1.5">
                            <label htmlFor={`ge-vat-${tx.id}`} className="text-xs text-muted">Rate %</label>
                            <input
                              id={`ge-vat-${tx.id}`}
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={editVatRate}
                              onChange={(e) => setEditVatRate(e.target.value)}
                              className="w-20 rounded-sm border border-sand px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-green-soft"
                            />
                          </div>
                        )}
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSave(tx)}
                          className="rounded-md bg-green px-3 py-2 text-sm font-medium text-card transition-[transform,opacity] hover:opacity-90 active:scale-[0.98]"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="rounded-md border border-sand px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-paper"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={tx.id} className="transition-colors hover:bg-paper">
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                    {formatDate(tx.occurredAt)}
                  </td>
                  <td className="px-4 py-2.5 text-ink">{tx.category}</td>
                  <td className="max-w-[10rem] truncate px-4 py-2.5 text-muted">
                    {tx.note.trim() || "—"}
                  </td>
                  <td
                    className={`whitespace-nowrap px-4 py-2.5 text-right font-display font-medium tabular-nums ${
                      isExpense ? "text-ink" : "text-green"
                    }`}
                  >
                    {isExpense ? "−" : "+"}
                    {tx.currency} {majorDisplay}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => startEdit(tx)}
                      className="mr-1 rounded-md px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-paper hover:text-ink"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(tx)}
                      className="rounded-md px-2 py-1 text-xs font-medium text-red-ink transition-colors hover:bg-red-bg"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary card
// ---------------------------------------------------------------------------

interface SummaryCardProps {
  label: string;
  value: string;
  variant: "expense" | "income" | "emphasized";
  index: number;
}

function SummaryCard({ label, value, variant, index }: SummaryCardProps) {
  const emphasized = variant === "emphasized";
  const cardClass = emphasized
    ? "bg-green shadow-md"
    : "border border-sand bg-card shadow-sm";
  const labelClass = emphasized ? "text-green-soft" : "text-muted";
  const valueClass =
    variant === "income" ? "text-green" : emphasized ? "text-card" : "text-ink";

  return (
    <div
      className={`animate-rise rounded-md p-4 ${cardClass}`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <p className={`text-[11px] font-medium uppercase tracking-label ${labelClass}`}>
        {label}
      </p>
      <p className={`mt-1.5 font-display text-2xl font-semibold leading-tight tabular-nums ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function GuestDashboard() {
  const [mounted, setMounted] = useState(false);
  const [transactions, setTransactions] = useState<GuestTransaction[]>([]);
  const [trialPhase, setTrialPhase] = useState<
    "welcome" | "active" | "warning" | "expired"
  >("active");
  const [daysRemaining, setDaysRemaining] = useState(14);
  const [toastVisible, setToastVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  function reloadTransactions() {
    setTransactions(guestStore.getTransactions());
  }

  useEffect(() => {
    guestStore.initGuest();
    const phase = guestStore.getTrialPhase();
    const remaining = guestStore.getDaysRemaining();

    setTransactions(guestStore.getTransactions());
    setTrialPhase(phase);
    setDaysRemaining(remaining);

    if (phase === "welcome") setToastVisible(true);
    if (phase === "expired" && !guestStore.isModalDismissed()) setModalVisible(true);

    setMounted(true);
  }, []);

  function dismissModal() {
    guestStore.dismissModal();
    setModalVisible(false);
  }

  const displayCurrency = displayCurrencyFrom(transactions);
  const totals = computeTotals(transactions);
  const byCategory = computeByCategory(transactions);
  const maxSpend = byCategory.length > 0 ? Math.max(...byCategory.map((c) => c.spent)) : 0;
  // Show 20 most recent
  const recentTxs = transactions.slice(0, 20);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink sm:text-[34px]">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted">
            Guest mode · {mounted ? `All amounts in ${displayCurrency}` : "Loading…"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Link
            href="/sign-in"
            className="rounded-pill px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:text-ink hover:bg-paper focus:outline-none focus-visible:ring-2 focus-visible:ring-green-soft"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-pill bg-green px-3 py-1.5 text-sm font-medium text-card transition-[transform,opacity] hover:opacity-90 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-green-soft"
          >
            Sign up free
          </Link>
        </div>
      </div>

      {/* Trial notices (only rendered after mount to avoid hydration mismatch) */}
      {mounted && trialPhase === "warning" && (
        <WarningBanner daysRemaining={daysRemaining} />
      )}
      {mounted && trialPhase === "expired" && <ExpiredBanner />}

      {/* Summary cards */}
      {mounted && (
        <section aria-label="Monthly summary" className="mb-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <SummaryCard index={0} label="Expense Today" value={formatMoney(totals.expenseToday, displayCurrency)} variant="expense" />
            <SummaryCard index={1} label="Expense This Week" value={formatMoney(totals.expenseWeek, displayCurrency)} variant="expense" />
            <SummaryCard index={2} label="Expense This Month" value={formatMoney(totals.expenseMonth, displayCurrency)} variant="expense" />
            <SummaryCard index={3} label="Income This Month" value={formatMoney(totals.incomeMonth, displayCurrency)} variant="income" />
            <SummaryCard index={4} label="Balance This Month" value={formatMoney(totals.balanceMonth, displayCurrency)} variant="emphasized" />
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: category breakdown + transactions */}
        <div className="space-y-6">
          {mounted && byCategory.length > 0 && (
            <section aria-label="Category breakdown">
              <h2 className="mb-3 text-lg font-semibold text-ink">Spending by Category</h2>
              <ul className="space-y-2.5">
                {byCategory.map((row) => {
                  const widthPct = maxSpend > 0 ? Math.round((row.spent / maxSpend) * 100) : 0;
                  return (
                    <li key={row.category}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-ink">{row.category}</span>
                        <span className="font-display font-medium text-ink tabular-nums">
                          {formatMoney(row.spent, displayCurrency)}
                        </span>
                      </div>
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
            </section>
          )}

          <section aria-label="Recent transactions">
            <h2 className="mb-3 text-lg font-semibold text-ink">Recent Transactions</h2>
            {mounted ? (
              <GuestTransactionList transactions={recentTxs} onChanged={reloadTransactions} />
            ) : (
              <p className="text-sm text-muted">Loading…</p>
            )}
          </section>
        </div>

        {/* Right: add form */}
        <div>
          <AddTransactionForm onAdded={reloadTransactions} />
        </div>
      </div>

      {/* Day-0 toast (bottom pill) */}
      {mounted && trialPhase === "welcome" && toastVisible && (
        <WelcomeToast onDismiss={() => setToastVisible(false)} />
      )}

      {/* Expired modal */}
      {mounted && modalVisible && <SignUpModal onDismiss={dismissModal} />}
    </main>
  );
}
