"use client";

/**
 * BudgetManager — interactive CRUD for per-category monthly budgets.
 *
 * Renders the budget list directly from props (never copied into state) so that
 * router.refresh() — which re-runs the parent Server Component — always shows
 * fresh server data. useState holds ONLY transient UI state: the add-form
 * fields, which row is being edited and its draft values, and submit/error flags.
 *
 * Money convention: limits are entered in MAJOR units and converted to integer
 * minor units with Math.round(major * 100) before POST/PATCH (NFR-1). Division
 * by 100 happens only at the display edge.
 *
 * Styling follows docs/design-system.md: warm tokens, money figures in the
 * display serif, and a status-colored usage bar (green → gold → red) plus a
 * text label so meaning never relies on color alone.
 *
 * FR-15 (set budget), FR-16 (edit / remove budget).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EXPENSE_CATEGORIES } from "@/lib/categories";
import type { BudgetLevel } from "@/lib/dashboard";

/** One budget row with its current-month usage, computed server-side. */
export interface BudgetView {
  id: string;
  category: string;
  limitMinorBase: number;
  warnAtPercent: number;
  spent: number; // base-currency minor units, current month
  percent: number;
  level: BudgetLevel;
}

interface BudgetManagerProps {
  baseCurrency: string;
  budgets: BudgetView[];
}

const DEFAULT_WARN_AT = 80;

/** Display helper: integer minor units → "USD 500.00". The only /100. */
function formatMoney(minor: number, currency: string): string {
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

/** Status pill — feedback tokens (amber/red) for near/over; calm sand for ok. */
const LEVEL_PILL: Record<BudgetLevel, string> = {
  ok: "bg-sand text-muted",
  near: "bg-amber-bg text-amber-ink",
  over: "bg-red-bg text-red-ink",
};

/** Usage-bar fill reflects status: green → gold → red (design-system §8). */
const LEVEL_BAR: Record<BudgetLevel, string> = {
  ok: "bg-green",
  near: "bg-gold",
  over: "bg-red-ink",
};

const LEVEL_LABEL: Record<BudgetLevel, string> = {
  ok: "ok",
  near: "near",
  over: "over",
};

export default function BudgetManager({
  baseCurrency,
  budgets,
}: BudgetManagerProps) {
  const router = useRouter();

  // Categories still available to budget = expense categories with no budget yet
  // (the API enforces one budget per category via a unique index).
  const budgetedCategories = new Set(budgets.map((b) => b.category));
  const availableCategories = EXPENSE_CATEGORIES.filter(
    (c) => !budgetedCategories.has(c),
  );

  // --- Add-form state ---
  const [newCategory, setNewCategory] = useState<string>("");
  const [newLimit, setNewLimit] = useState<string>("");
  const [newWarnAt, setNewWarnAt] = useState<string>(String(DEFAULT_WARN_AT));
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // --- Inline-edit state (one row at a time) ---
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLimit, setEditLimit] = useState<string>("");
  const [editWarnAt, setEditWarnAt] = useState<string>("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  /** Parse a major-unit money string into integer minor units, or null. */
  function toMinor(major: string): number | null {
    const n = parseFloat(major);
    if (isNaN(n) || n <= 0) return null;
    return Math.round(n * 100);
  }

  /** Parse a warn-at-percent string into a 1–100 integer, or null. */
  function toWarnAt(value: string): number | null {
    const n = parseInt(value, 10);
    if (isNaN(n) || n < 1 || n > 100) return null;
    return n;
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddError(null);

    if (newCategory === "") {
      setAddError("Please choose a category.");
      return;
    }
    const limitMinorBase = toMinor(newLimit);
    if (limitMinorBase === null) {
      setAddError("Limit must be a positive amount.");
      return;
    }
    const warnAtPercent = toWarnAt(newWarnAt);
    if (warnAtPercent === null) {
      setAddError("Warn-at must be a whole number between 1 and 100.");
      return;
    }

    setAdding(true);
    try {
      const res = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: newCategory, limitMinorBase, warnAtPercent }),
      });
      if (res.status === 201) {
        // Reset the add form and let the server re-render the list.
        setNewCategory("");
        setNewLimit("");
        setNewWarnAt(String(DEFAULT_WARN_AT));
        router.refresh();
      } else {
        const json = (await res.json()) as { error?: string };
        setAddError(json.error ?? "Failed to create budget.");
      }
    } catch {
      setAddError("Network error. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(b: BudgetView) {
    setRowError(null);
    setEditingId(b.id);
    setEditLimit((b.limitMinorBase / 100).toFixed(2));
    setEditWarnAt(String(b.warnAtPercent));
  }

  function cancelEdit() {
    setEditingId(null);
    setRowError(null);
  }

  async function handleSaveEdit(id: string) {
    setRowError(null);
    const limitMinorBase = toMinor(editLimit);
    if (limitMinorBase === null) {
      setRowError("Limit must be a positive amount.");
      return;
    }
    const warnAtPercent = toWarnAt(editWarnAt);
    if (warnAtPercent === null) {
      setRowError("Warn-at must be a whole number between 1 and 100.");
      return;
    }

    setSavingId(id);
    try {
      const res = await fetch(`/api/budgets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limitMinorBase, warnAtPercent }),
      });
      if (res.ok) {
        setEditingId(null);
        router.refresh();
      } else {
        const json = (await res.json()) as { error?: string };
        setRowError(json.error ?? "Failed to update budget.");
      }
    } catch {
      setRowError("Network error. Please try again.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(b: BudgetView) {
    // Destructive — confirm before removing.
    if (
      !window.confirm(`Delete the budget for "${b.category}"? This cannot be undone.`)
    ) {
      return;
    }
    setRowError(null);
    setSavingId(b.id);
    try {
      const res = await fetch(`/api/budgets/${b.id}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      } else {
        const json = (await res.json()) as { error?: string };
        setRowError(json.error ?? "Failed to delete budget.");
      }
    } catch {
      setRowError("Network error. Please try again.");
    } finally {
      setSavingId(null);
    }
  }

  const inputClass =
    "w-full rounded-sm border border-sand px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-soft";
  const primaryBtn =
    "rounded-md bg-green px-4 py-2.5 text-sm font-medium text-card transition-[transform,opacity] hover:opacity-90 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-green-soft disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="space-y-8">
      {/* ---------------------------------------------------------------- */}
      {/* Add budget — FR-15                                                */}
      {/* ---------------------------------------------------------------- */}
      <section
        aria-label="Add budget"
        className="rounded-lg border border-sand bg-card p-5 shadow-sm"
      >
        <h2 className="mb-4 text-lg font-semibold text-ink">Add Budget</h2>

        {availableCategories.length === 0 ? (
          <p className="text-sm text-muted">
            Every expense category already has a budget. Edit or delete one below
            to make changes.
          </p>
        ) : (
          <form onSubmit={handleAdd} className="space-y-4">
            {addError !== null && (
              <p
                role="alert"
                className="rounded-md bg-red-bg px-4 py-3 text-sm text-red-ink"
              >
                {addError}
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <label
                  htmlFor="new-category"
                  className="mb-1 block text-sm font-medium text-ink"
                >
                  Category
                </label>
                <select
                  id="new-category"
                  required
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className={`${inputClass} bg-card`}
                >
                  <option value="">— Select —</option>
                  {availableCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="new-limit"
                  className="mb-1 block text-sm font-medium text-ink"
                >
                  Monthly limit ({baseCurrency})
                </label>
                <input
                  id="new-limit"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  required
                  value={newLimit}
                  onChange={(e) => setNewLimit(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="new-warn"
                  className="mb-1 block text-sm font-medium text-ink"
                >
                  Warn at (%)
                </label>
                <input
                  id="new-warn"
                  type="number"
                  inputMode="numeric"
                  step="1"
                  min="1"
                  max="100"
                  required
                  value={newWarnAt}
                  onChange={(e) => setNewWarnAt(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <button type="submit" disabled={adding} className={primaryBtn}>
              {adding ? "Saving…" : "Add Budget"}
            </button>
          </form>
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Existing budgets — FR-16 (edit / remove) + live usage            */}
      {/* ---------------------------------------------------------------- */}
      <section aria-label="Existing budgets">
        <h2 className="mb-3 text-lg font-semibold text-ink">Your Budgets</h2>

        {rowError !== null && (
          <p
            role="alert"
            className="mb-3 rounded-md bg-red-bg px-4 py-3 text-sm text-red-ink"
          >
            {rowError}
          </p>
        )}

        {budgets.length === 0 ? (
          <p className="text-sm text-muted">
            No budgets yet. Add one above to start tracking category spend.
          </p>
        ) : (
          <ul className="space-y-3">
            {budgets.map((b) => {
              const isEditing = editingId === b.id;
              const isBusy = savingId === b.id;
              // Bar never overflows its track; status colour conveys "over".
              const barWidth = Math.min(b.percent, 100);

              return (
                <li
                  key={b.id}
                  className="rounded-lg border border-sand bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{b.category}</p>
                      {!isEditing && (
                        <p className="mt-0.5 text-sm text-muted">
                          <span className="font-display tabular-nums text-ink">
                            {formatMoney(b.spent, baseCurrency)} /{" "}
                            {formatMoney(b.limitMinorBase, baseCurrency)}
                          </span>
                          <span className="ml-2 text-muted">
                            warn at {b.warnAtPercent}%
                          </span>
                        </p>
                      )}
                    </div>

                    {!isEditing && (
                      <span
                        className={`shrink-0 rounded-pill px-2.5 py-1 text-xs font-medium ${LEVEL_PILL[b.level]}`}
                      >
                        {b.percent}% · {LEVEL_LABEL[b.level]}
                      </span>
                    )}
                  </div>

                  {/* Usage bar (hidden while editing to reduce clutter) */}
                  {!isEditing && (
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-pill bg-sand">
                      <div
                        className={`h-full rounded-pill transition-[width] duration-[400ms] ease-out ${LEVEL_BAR[b.level]}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  )}

                  {/* Inline edit form — category is immutable (display only) */}
                  {isEditing ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div>
                        <label
                          htmlFor={`edit-limit-${b.id}`}
                          className="mb-1 block text-xs font-medium text-muted"
                        >
                          Limit ({baseCurrency})
                        </label>
                        <input
                          id={`edit-limit-${b.id}`}
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0.01"
                          value={editLimit}
                          onChange={(e) => setEditLimit(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`edit-warn-${b.id}`}
                          className="mb-1 block text-xs font-medium text-muted"
                        >
                          Warn at (%)
                        </label>
                        <input
                          id={`edit-warn-${b.id}`}
                          type="number"
                          inputMode="numeric"
                          step="1"
                          min="1"
                          max="100"
                          value={editWarnAt}
                          onChange={(e) => setEditWarnAt(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(b.id)}
                          disabled={isBusy}
                          className="rounded-md bg-green px-3 py-2 text-sm font-medium text-card transition-[transform,opacity] hover:opacity-90 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-green-soft disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isBusy ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={isBusy}
                          className="rounded-md border border-sand px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-paper disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(b)}
                        disabled={isBusy}
                        className="rounded-md border border-sand px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-paper disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(b)}
                        disabled={isBusy}
                        className="rounded-md border border-red-bg px-3 py-1.5 text-sm font-medium text-red-ink transition-colors hover:bg-red-bg disabled:opacity-50"
                      >
                        {isBusy ? "…" : "Delete"}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
