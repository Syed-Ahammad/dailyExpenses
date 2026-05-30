"use client";

/**
 * TransactionList — recent transactions table with inline edit + delete.
 *
 * Renders rows directly from props so router.refresh() (after a mutation
 * re-runs the parent Server Component) always shows fresh data; useState holds
 * only UI state (which row is being edited, its draft values, busy/error flags).
 *
 * Editable fields: amount, category, date, note. `type` and `currency` are
 * intentionally NOT editable here — changing currency would require re-entering
 * rateToBase (live FX is Phase 3); to change those, delete and re-add. Money is
 * entered in MAJOR units and converted with Math.round(major * 100) before the
 * PATCH (NFR-1); division by 100 happens only at the display edge.
 *
 * Styling follows docs/design-system.md: money figures in the display serif,
 * expense in ink and income in green (never color alone — also a +/− sign).
 *
 * FR-7 (edit transaction), FR-8 (delete transaction),
 * FR-25 (attach receipt to existing transaction).
 */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
} from "@/lib/categories";

export interface TransactionView {
  id: string;
  type: "expense" | "income";
  amountMinor: number;
  currency: string;
  category: string;
  note: string;
  /** Cloudinary URL if a receipt is attached, otherwise null (FR-25). */
  receiptUrl: string | null;
  occurredAt: string; // ISO string
}

interface TransactionListProps {
  baseCurrency: string;
  transactions: TransactionView[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function TransactionList({
  transactions,
}: TransactionListProps) {
  const router = useRouter();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editNote, setEditNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // One hidden file input shared across all rows. The id of the row that
  // triggered it is stashed so the change handler knows where to PATCH.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachTargetId, setAttachTargetId] = useState<string | null>(null);

  function triggerAttach(id: string) {
    setError(null);
    setAttachTargetId(id);
    fileInputRef.current?.click();
  }

  async function handleAttachFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    const targetId = attachTargetId;
    setAttachTargetId(null);
    if (!file || !targetId) return;

    setBusyId(targetId);
    setError(null);
    try {
      const data = new FormData();
      data.append("file", file);
      const uploadRes = await fetch("/api/receipts/upload", {
        method: "POST",
        body: data,
      });
      const uploadJson = (await uploadRes.json()) as {
        url?: string;
        error?: string;
      };
      if (!uploadRes.ok || typeof uploadJson.url !== "string") {
        setError(uploadJson.error ?? "Failed to upload receipt.");
        return;
      }

      const patchRes = await fetch(`/api/expenses/${targetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptUrl: uploadJson.url }),
      });
      if (patchRes.ok) {
        router.refresh();
      } else {
        const patchJson = (await patchRes.json()) as { error?: string };
        setError(patchJson.error ?? "Failed to attach receipt.");
      }
    } catch {
      setError("Network error while attaching receipt.");
    } finally {
      setBusyId(null);
    }
  }

  function startEdit(tx: TransactionView) {
    setError(null);
    setEditingId(tx.id);
    setEditAmount((tx.amountMinor / 100).toFixed(2));
    setEditCategory(tx.category);
    setEditDate(tx.occurredAt.slice(0, 10)); // yyyy-mm-dd for the date input
    setEditNote(tx.note);
  }

  function cancelEdit() {
    setEditingId(null);
    setError(null);
  }

  async function handleSave(id: string) {
    setError(null);

    const amountNum = parseFloat(editAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Amount must be a positive number.");
      return;
    }
    if (editCategory === "") {
      setError("Please choose a category.");
      return;
    }
    if (editDate === "") {
      setError("Please choose a date.");
      return;
    }

    // Always send all four editable fields — the API rejects an empty body,
    // and a no-op edit is harmless.
    const body = {
      amountMinor: Math.round(amountNum * 100),
      category: editCategory,
      occurredAt: editDate,
      note: editNote.trim(), // "" clears the note
    };

    setBusyId(id);
    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setEditingId(null);
        router.refresh();
      } else {
        const json = (await res.json()) as { error?: string };
        setError(json.error ?? "Failed to update transaction.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(tx: TransactionView) {
    const label = tx.note.trim() || tx.category;
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) {
      return;
    }
    setError(null);
    setBusyId(tx.id);
    try {
      const res = await fetch(`/api/expenses/${tx.id}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      } else {
        const json = (await res.json()) as { error?: string };
        setError(json.error ?? "Failed to delete transaction.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  if (transactions.length === 0) {
    return <p className="text-sm text-muted">No transactions recorded yet.</p>;
  }

  const inputClass =
    "w-full rounded-sm border border-sand px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-soft";

  return (
    <div className="space-y-3">
      {error !== null && (
        <p
          role="alert"
          className="rounded-md bg-red-bg px-4 py-3 text-sm text-red-ink"
        >
          {error}
        </p>
      )}

      {/* Hidden input shared across all "Attach receipt" actions (FR-25). */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={handleAttachFile}
        className="hidden"
      />

      <div className="overflow-x-auto rounded-lg border border-sand">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-paper text-left">
              <th className="px-4 py-2.5 font-medium text-muted">Date</th>
              <th className="px-4 py-2.5 font-medium text-muted">Category</th>
              <th className="px-4 py-2.5 font-medium text-muted">Note</th>
              <th className="px-4 py-2.5 text-right font-medium text-muted">
                Amount
              </th>
              <th className="px-4 py-2.5 text-right font-medium text-muted">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand">
            {transactions.map((tx) => {
              const isEditing = editingId === tx.id;
              const isBusy = busyId === tx.id;
              const isExpense = tx.type === "expense";
              const majorDisplay = (tx.amountMinor / 100).toFixed(2);
              const categoryOptions = isExpense
                ? EXPENSE_CATEGORIES
                : INCOME_CATEGORIES;

              if (isEditing) {
                // Full-width editor row — gives the form room the columns can't.
                return (
                  <tr key={tx.id} className="bg-paper">
                    <td colSpan={5} className="px-4 py-4">
                      <div className="grid gap-3 sm:grid-cols-4">
                        <div>
                          <label
                            htmlFor={`amount-${tx.id}`}
                            className="mb-1 block text-xs font-medium text-muted"
                          >
                            Amount ({tx.currency})
                          </label>
                          <input
                            id={`amount-${tx.id}`}
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0.01"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`category-${tx.id}`}
                            className="mb-1 block text-xs font-medium text-muted"
                          >
                            Category
                          </label>
                          <select
                            id={`category-${tx.id}`}
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            className={`${inputClass} bg-card`}
                          >
                            {categoryOptions.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label
                            htmlFor={`date-${tx.id}`}
                            className="mb-1 block text-xs font-medium text-muted"
                          >
                            Date
                          </label>
                          <input
                            id={`date-${tx.id}`}
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`note-${tx.id}`}
                            className="mb-1 block text-xs font-medium text-muted"
                          >
                            Note
                          </label>
                          <input
                            id={`note-${tx.id}`}
                            type="text"
                            maxLength={500}
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            className={inputClass}
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSave(tx.id)}
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
                        <span className="ml-1 text-xs text-muted">
                          {tx.type} · {tx.currency} (not editable here)
                        </span>
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
                    {tx.receiptUrl !== null ? (
                      <a
                        href={tx.receiptUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mr-1 rounded-md px-2 py-1 text-xs font-medium text-green transition-colors hover:underline"
                        aria-label="View receipt"
                      >
                        Receipt
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => triggerAttach(tx.id)}
                        disabled={isBusy}
                        className="mr-1 rounded-md px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-paper hover:text-ink disabled:opacity-50"
                      >
                        {isBusy ? "…" : "Attach"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => startEdit(tx)}
                      disabled={isBusy}
                      className="mr-1 rounded-md px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-paper hover:text-ink disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(tx)}
                      disabled={isBusy}
                      className="rounded-md px-2 py-1 text-xs font-medium text-red-ink transition-colors hover:bg-red-bg disabled:opacity-50"
                    >
                      {isBusy ? "…" : "Delete"}
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
