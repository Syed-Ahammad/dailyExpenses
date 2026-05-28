"use client";

/**
 * AddTransactionForm — controlled form for creating an expense or income entry.
 *
 * Money convention: the user enters an amount in MAJOR units (e.g. 50.25 AED).
 * We convert to integer minor units with Math.round(amount * 100) before POSTing,
 * so the server always receives amountMinor as an integer (NFR-1).
 *
 * On 201 success, the form resets and calls router.refresh() so the parent
 * Server Component re-runs its data fetches and the totals + recent list update
 * without a full page reload.
 *
 * FR-5 (expense entry), FR-6 (income entry), FR-9 (multi-currency with rateToBase).
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type ExpenseCategory,
  type IncomeCategory,
} from "@/lib/categories";

type TransactionType = "expense" | "income";

type PaymentMethod =
  | "cash"
  | "card"
  | "bank_transfer"
  | "wallet"
  | "cheque"
  | "other"
  | "";

interface FormState {
  type: TransactionType;
  amount: string;
  currency: string;
  rateToBase: string;
  category: string;
  paymentMethod: PaymentMethod;
  occurredAt: string;
  note: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultCategory(type: TransactionType): string {
  // Default to the first option for the chosen type on reset or type-switch.
  return type === "expense" ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0];
}

function initialState(): FormState {
  return {
    type: "expense",
    amount: "",
    currency: "AED",
    rateToBase: "1",
    category: defaultCategory("expense"),
    paymentMethod: "",
    occurredAt: todayIso(),
    note: "",
  };
}

/**
 * Controlled form component for recording an expense or income transaction.
 * All money conversion (major → minor) happens here before the network call.
 */
export default function AddTransactionForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generic field updater — keeps handlers DRY.
  const setField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  /**
   * When the user switches type (expense ↔ income), the category list changes
   * entirely. Reset category to the first option of the new type so the select
   * never holds a value that belongs to the wrong list.
   */
  function handleTypeChange(newType: TransactionType) {
    setForm((prev) => ({
      ...prev,
      type: newType,
      category: defaultCategory(newType), // reset category on type change
    }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const amountNum = parseFloat(form.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Please enter a valid positive amount.");
      return;
    }

    const rateNum = parseFloat(form.rateToBase);
    if (isNaN(rateNum) || rateNum <= 0) {
      setError("Rate to base must be a positive number.");
      return;
    }

    // Convert major units → integer minor units (NFR-1).
    // Math.round handles floating-point imprecision (e.g. 50.25 * 100 = 5025).
    const amountMinor = Math.round(amountNum * 100);

    const body = {
      type: form.type,
      amountMinor,
      currency: form.currency.toUpperCase().trim(),
      rateToBase: rateNum,
      category: form.category,
      ...(form.paymentMethod !== "" && { paymentMethod: form.paymentMethod }),
      note: form.note.trim() || undefined,
      isVatable: false,
      vatRate: 0,
      categorySource: "manual" as const,
      occurredAt: form.occurredAt,
    };

    setSubmitting(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 201) {
        // Success: reset form and refresh server-side data.
        setForm(initialState());
        // router.refresh() re-runs the parent Server Component's data fetches
        // so totals and the recent transactions list reflect the new entry.
        router.refresh();
      } else {
        const json = (await res.json()) as { error?: string };
        setError(json.error ?? "Failed to save transaction. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const categoryOptions: readonly (ExpenseCategory | IncomeCategory)[] =
    form.type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      aria-label="Add transaction"
    >
      <h2 className="text-lg font-semibold text-slate-800">Add Transaction</h2>

      {/* Error banner */}
      {error !== null && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {/* Type */}
      <fieldset>
        <legend className="mb-1.5 block text-sm font-medium text-slate-700">
          Type
        </legend>
        <div className="flex gap-4">
          {(["expense", "income"] as const).map((t) => (
            <label
              key={t}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <input
                type="radio"
                name="type"
                value={t}
                checked={form.type === t}
                onChange={() => handleTypeChange(t)}
                className="accent-slate-700"
              />
              <span className="capitalize">{t}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Amount + Currency row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-2">
          <label
            htmlFor="amount"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Amount
          </label>
          <input
            id="amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            required
            value={form.amount}
            onChange={(e) => setField("amount", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
        <div>
          <label
            htmlFor="currency"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Currency
          </label>
          <input
            id="currency"
            type="text"
            maxLength={3}
            placeholder="AED"
            required
            value={form.currency}
            onChange={(e) => setField("currency", e.target.value.toUpperCase())}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
      </div>

      {/* Rate to base — shown but kept minimal (FR-9) */}
      <div>
        <label
          htmlFor="rateToBase"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Rate to Base{" "}
          <span className="font-normal text-slate-500">(1 if same currency)</span>
        </label>
        <input
          id="rateToBase"
          type="number"
          inputMode="decimal"
          step="any"
          min="0.000001"
          required
          value={form.rateToBase}
          onChange={(e) => setField("rateToBase", e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
      </div>

      {/* Category */}
      <div>
        <label
          htmlFor="category"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Category
        </label>
        <select
          id="category"
          required
          value={form.category}
          onChange={(e) => setField("category", e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          {categoryOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Payment Method */}
      <div>
        <label
          htmlFor="paymentMethod"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Payment Method{" "}
          <span className="font-normal text-slate-500">(optional)</span>
        </label>
        <select
          id="paymentMethod"
          value={form.paymentMethod}
          onChange={(e) =>
            setField("paymentMethod", e.target.value as PaymentMethod)
          }
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="">— Select —</option>
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="wallet">Wallet</option>
          <option value="cheque">Cheque</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Date */}
      <div>
        <label
          htmlFor="occurredAt"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Date
        </label>
        <input
          id="occurredAt"
          type="date"
          required
          value={form.occurredAt}
          onChange={(e) => setField("occurredAt", e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
      </div>

      {/* Note */}
      <div>
        <label
          htmlFor="note"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Note{" "}
          <span className="font-normal text-slate-500">(optional, max 500)</span>
        </label>
        <textarea
          id="note"
          maxLength={500}
          rows={2}
          placeholder="e.g. Lunch with client"
          value={form.note}
          onChange={(e) => setField("note", e.target.value)}
          className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Save Transaction"}
      </button>
    </form>
  );
}
