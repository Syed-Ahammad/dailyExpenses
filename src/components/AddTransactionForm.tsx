"use client";

/**
 * AddTransactionForm — controlled form for creating an expense or income entry.
 *
 * Money convention: the user enters an amount in MAJOR units (e.g. 50.25 USD).
 * We convert to integer minor units with Math.round(amount * 100) before POSTing,
 * so the server always receives amountMinor as an integer (NFR-1).
 *
 * On 201 success, the form resets and calls router.refresh() so the parent
 * Server Component re-runs its data fetches and the totals + recent list update
 * without a full page reload.
 *
 * FR-5 (expense entry), FR-6 (income entry), FR-9 (multi-currency with rateToBase),
 * FR-19/FR-20 (AI category suggestion), FR-21 (category source tracking),
 * FR-25 (attach receipt), FR-26 (OCR extract amount/merchant/date).
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type ExpenseCategory,
  type IncomeCategory,
} from "@/lib/categories";
import { CURRENCIES } from "@/lib/currencies";

type TransactionType = "expense" | "income";
type CategorySource = "manual" | "ai_suggested" | "ai_confirmed";

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
  return type === "expense" ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0];
}

function initialState(baseCurrency: string): FormState {
  return {
    type: "expense",
    amount: "",
    currency: baseCurrency,
    rateToBase: "1",
    category: defaultCategory("expense"),
    paymentMethod: "",
    occurredAt: todayIso(),
    note: "",
  };
}

interface AddTransactionFormProps {
  /** The user's base currency (ISO 4217). Passed from the server so it never
   *  needs to be re-fetched client-side. Defaults the currency select and
   *  determines when rateToBase is hidden. */
  baseCurrency: string;
}

/**
 * Controlled form component for recording an expense or income transaction.
 * All money conversion (major → minor) happens here before the network call.
 */
export default function AddTransactionForm({
  baseCurrency,
}: AddTransactionFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => initialState(baseCurrency));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // FX rate fetch state (FR-9)
  const [rateFetching, setRateFetching] = useState(false);

  // AI suggestion state (FR-19, FR-20, FR-21)
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [categorySource, setCategorySource] = useState<CategorySource>("manual");

  // Receipt + OCR state (FR-25, FR-26)
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrNotice, setOcrNotice] = useState<string | null>(null);

  // Generic field updater — keeps handlers DRY.
  const setField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  /**
   * When the user switches type (expense ↔ income), reset category and clear
   * any pending AI suggestion since the category list changes entirely.
   */
  function handleTypeChange(newType: TransactionType) {
    setForm((prev) => ({
      ...prev,
      type: newType,
      category: defaultCategory(newType),
    }));
    setAiSuggestion(null);
    setCategorySource("manual");
  }

  /**
   * When the currency changes to a foreign currency, auto-fetch the live rate
   * and pre-fill rateToBase. If the fetch fails or returns null, the field stays
   * editable for manual entry (FR-9).
   */
  async function handleCurrencyChange(newCurrency: string) {
    setForm((prev) => ({
      ...prev,
      currency: newCurrency,
      rateToBase: newCurrency === baseCurrency ? "1" : prev.rateToBase,
    }));

    if (newCurrency !== baseCurrency) {
      setRateFetching(true);
      try {
        const res = await fetch(
          `/api/rates?from=${encodeURIComponent(newCurrency)}&to=${encodeURIComponent(baseCurrency)}`,
        );
        const json = (await res.json()) as { rate: number | null };
        if (typeof json.rate === "number") {
          const rate = json.rate;
          setForm((prev) => ({
            ...prev,
            rateToBase: rate.toFixed(6).replace(/\.?0+$/, ""),
          }));
        }
      } catch {
        // Silently fail — user can enter the rate manually.
      } finally {
        setRateFetching(false);
      }
    }
  }

  /**
   * Request an AI category suggestion for the current note.
   * Only offered when the note is long enough to be meaningful (≥3 chars).
   * On failure the form is unblocked — the user's current selection is kept.
   */
  async function handleSuggestCategory() {
    const note = form.note.trim();
    if (note.length < 3) return;

    setAiLoading(true);
    setAiSuggestion(null);
    try {
      const res = await fetch("/api/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note, type: form.type }),
      });
      if (!res.ok) return; // silently fall back to current selection
      const json = (await res.json()) as { category?: string };
      if (typeof json.category === "string" && json.category.length > 0) {
        setAiSuggestion(json.category);
      }
    } catch {
      // Ignore — form must never be blocked by an AI failure.
    } finally {
      setAiLoading(false);
    }
  }

  /** Accept the AI suggestion: apply it and mark as ai_confirmed (FR-20, FR-21). */
  function acceptSuggestion() {
    if (!aiSuggestion) return;
    setField("category", aiSuggestion);
    setCategorySource("ai_confirmed");
    setAiSuggestion(null);
  }

  /** Dismiss the suggestion without changing the category. */
  function dismissSuggestion() {
    setAiSuggestion(null);
    setCategorySource("manual");
  }

  /** Manual category change clears any pending suggestion (FR-21). */
  function handleCategoryChange(value: string) {
    setField("category", value);
    setAiSuggestion(null);
    setCategorySource("manual");
  }

  /**
   * Upload a chosen receipt to Cloudinary via /api/receipts/upload (FR-25).
   * Resets any prior receipt before uploading so a second pick replaces it.
   */
  async function handleReceiptChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Clear the input value so picking the same file again still fires onChange.
    e.target.value = "";
    if (!file) return;

    setReceiptError(null);
    setOcrNotice(null);
    setReceiptUploading(true);
    try {
      const data = new FormData();
      data.append("file", file);
      const res = await fetch("/api/receipts/upload", {
        method: "POST",
        body: data,
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || typeof json.url !== "string") {
        setReceiptError(json.error ?? "Failed to upload receipt.");
        return;
      }
      setReceiptUrl(json.url);
    } catch {
      setReceiptError("Network error while uploading receipt.");
    } finally {
      setReceiptUploading(false);
    }
  }

  function handleRemoveReceipt() {
    setReceiptUrl(null);
    setReceiptError(null);
    setOcrNotice(null);
  }

  /**
   * Run OCR on the uploaded receipt (FR-26) and pre-fill any form fields the
   * user hasn't touched yet. We never overwrite a value the user has already
   * entered — that would be a worse UX than asking them to re-type.
   */
  async function handleExtractReceipt() {
    if (!receiptUrl) return;
    setOcrNotice(null);
    setReceiptError(null);
    setOcrLoading(true);
    try {
      const res = await fetch("/api/receipts/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptUrl }),
      });
      if (!res.ok) {
        setReceiptError("Could not read this receipt. You can still save manually.");
        return;
      }
      const json = (await res.json()) as {
        amountMinor?: number;
        currency?: string;
        merchant?: string;
        occurredAt?: string;
      };

      const filled: string[] = [];

      setForm((prev) => {
        const next = { ...prev };

        if (typeof json.amountMinor === "number" && prev.amount === "") {
          next.amount = (json.amountMinor / 100).toFixed(2);
          filled.push("amount");
        }
        if (typeof json.merchant === "string" && prev.note.trim() === "") {
          next.note = json.merchant;
          filled.push("note");
        }
        if (typeof json.occurredAt === "string" && prev.occurredAt === todayIso()) {
          next.occurredAt = json.occurredAt;
          filled.push("date");
        }
        return next;
      });

      // Currency update is async (it kicks off an FX lookup), so handle it
      // outside the state-batching block.
      if (
        typeof json.currency === "string" &&
        form.currency === baseCurrency &&
        json.currency !== baseCurrency
      ) {
        await handleCurrencyChange(json.currency);
        filled.push("currency");
      }

      setOcrNotice(
        filled.length > 0
          ? `Pre-filled: ${filled.join(", ")}.`
          : "Receipt scanned but no fields could be extracted.",
      );
    } catch {
      setReceiptError("Network error while reading receipt.");
    } finally {
      setOcrLoading(false);
    }
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
    const amountMinor = Math.round(amountNum * 100);

    const body = {
      type: form.type,
      amountMinor,
      currency: form.currency,
      rateToBase: rateNum,
      category: form.category,
      ...(form.paymentMethod !== "" && { paymentMethod: form.paymentMethod }),
      note: form.note.trim() || undefined,
      isVatable: false,
      vatRate: 0,
      categorySource,
      ...(receiptUrl && { receiptUrl }),
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
        setForm(initialState(baseCurrency));
        setAiSuggestion(null);
        setCategorySource("manual");
        setReceiptUrl(null);
        setReceiptError(null);
        setOcrNotice(null);
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

  const isForeignCurrency = form.currency !== baseCurrency;
  const canSuggest = form.note.trim().length >= 3;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-sand bg-card p-5 shadow-sm"
      aria-label="Add transaction"
    >
      <h2 className="text-lg font-semibold text-ink">Add Transaction</h2>

      {/* Error banner */}
      {error !== null && (
        <p
          role="alert"
          className="rounded-md bg-red-bg px-4 py-3 text-sm text-red-ink"
        >
          {error}
        </p>
      )}

      {/* Type */}
      <fieldset>
        <legend className="mb-1.5 block text-sm font-medium text-ink">
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
                className="accent-green"
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
            className="mb-1 block text-sm font-medium text-ink"
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
            className="w-full rounded-sm border border-sand px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-soft"
          />
        </div>
        <div>
          <label
            htmlFor="currency"
            className="mb-1 block text-sm font-medium text-ink"
          >
            Currency
          </label>
          <select
            id="currency"
            required
            value={form.currency}
            onChange={(e) => handleCurrencyChange(e.target.value)}
            className="w-full rounded-sm border border-sand bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-soft"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Rate to base — only shown for foreign currencies (FR-9). */}
      {isForeignCurrency && (
        <div>
          <label
            htmlFor="rateToBase"
            className="mb-1 block text-sm font-medium text-ink"
          >
            Rate to {baseCurrency}{" "}
            <span className="font-normal text-muted">
              (how many {baseCurrency} per 1 {form.currency})
            </span>
          </label>
          <div className="relative">
            <input
              id="rateToBase"
              type="number"
              inputMode="decimal"
              step="any"
              min="0.000001"
              required
              value={form.rateToBase}
              onChange={(e) => setField("rateToBase", e.target.value)}
              disabled={rateFetching}
              className="w-full rounded-sm border border-sand px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-soft disabled:opacity-60"
            />
            {rateFetching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
                Fetching…
              </span>
            )}
          </div>
          {!rateFetching && form.rateToBase !== "1" && (
            <p className="mt-1 text-xs text-muted">Live rate pre-filled — edit if needed.</p>
          )}
        </div>
      )}

      {/* Category + AI suggest (FR-19, FR-20) */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="category" className="text-sm font-medium text-ink">
            Category
          </label>
          {canSuggest && (
            <button
              type="button"
              onClick={handleSuggestCategory}
              disabled={aiLoading}
              className="text-xs text-green hover:underline disabled:opacity-50"
            >
              {aiLoading ? "Suggesting…" : "AI suggest ✦"}
            </button>
          )}
        </div>
        <select
          id="category"
          required
          value={form.category}
          onChange={(e) => handleCategoryChange(e.target.value)}
          className="w-full rounded-sm border border-sand bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-soft"
        >
          {categoryOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {/* AI suggestion chip */}
        {aiSuggestion !== null && (
          <div className="mt-2 flex items-center gap-2 rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-sm">
            <span className="text-muted">AI suggests:</span>
            <span className="font-medium text-ink">{aiSuggestion}</span>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={acceptSuggestion}
                className="rounded px-2 py-0.5 text-xs font-medium text-green hover:underline"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={dismissSuggestion}
                className="rounded px-2 py-0.5 text-xs text-muted hover:underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Payment Method */}
      <div>
        <label
          htmlFor="paymentMethod"
          className="mb-1 block text-sm font-medium text-ink"
        >
          Payment Method{" "}
          <span className="font-normal text-muted">(optional)</span>
        </label>
        <select
          id="paymentMethod"
          value={form.paymentMethod}
          onChange={(e) =>
            setField("paymentMethod", e.target.value as PaymentMethod)
          }
          className="w-full rounded-sm border border-sand bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-soft"
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
          className="mb-1 block text-sm font-medium text-ink"
        >
          Date
        </label>
        <input
          id="occurredAt"
          type="date"
          required
          value={form.occurredAt}
          onChange={(e) => setField("occurredAt", e.target.value)}
          className="w-full rounded-sm border border-sand px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-soft"
        />
      </div>

      {/* Note */}
      <div>
        <label
          htmlFor="note"
          className="mb-1 block text-sm font-medium text-ink"
        >
          Note{" "}
          <span className="font-normal text-muted">(optional, max 500)</span>
        </label>
        <textarea
          id="note"
          maxLength={500}
          rows={2}
          placeholder="e.g. Lunch with client"
          value={form.note}
          onChange={(e) => setField("note", e.target.value)}
          className="w-full resize-none rounded-sm border border-sand px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-soft"
        />
      </div>

      {/* Receipt upload + OCR (FR-25, FR-26) */}
      <div>
        <label className="mb-1 block text-sm font-medium text-ink">
          Receipt <span className="font-normal text-muted">(optional)</span>
        </label>

        {receiptUrl === null ? (
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            disabled={receiptUploading}
            onChange={handleReceiptChange}
            className="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-paper file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-sand disabled:opacity-50"
          />
        ) : (
          <div className="flex items-center gap-3 rounded-md border border-sand bg-paper px-3 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={receiptUrl}
              alt="Receipt preview"
              className="h-12 w-12 rounded-sm object-cover"
              onError={(e) => {
                // Non-image (e.g. PDF) — hide the preview cleanly.
                e.currentTarget.style.display = "none";
              }}
            />
            <a
              href={receiptUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-sm text-green hover:underline"
            >
              View receipt
            </a>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={handleExtractReceipt}
                disabled={ocrLoading}
                className="rounded-md border border-gold/40 bg-gold/10 px-2.5 py-1 text-xs font-medium text-ink hover:bg-gold/20 disabled:opacity-50"
              >
                {ocrLoading ? "Reading…" : "Extract from receipt ✦"}
              </button>
              <button
                type="button"
                onClick={handleRemoveReceipt}
                disabled={ocrLoading}
                className="rounded-md px-2.5 py-1 text-xs text-muted hover:underline disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          </div>
        )}

        {receiptUploading && (
          <p className="mt-1 text-xs text-muted">Uploading…</p>
        )}
        {ocrNotice !== null && (
          <p className="mt-1 text-xs text-muted">{ocrNotice}</p>
        )}
        {receiptError !== null && (
          <p className="mt-1 text-xs text-red-ink">{receiptError}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting || receiptUploading}
        className="w-full rounded-md bg-green px-4 py-2.5 text-sm font-medium text-card transition-[transform,opacity] hover:opacity-90 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-green-soft disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Save Transaction"}
      </button>
    </form>
  );
}
