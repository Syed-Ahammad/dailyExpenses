"use client";

/**
 * Recurring transaction templates (FR-30, FR-31).
 * Users create templates that auto-generate transactions on a schedule.
 */

import { useEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/categories";
import { CURRENCIES } from "@/lib/currencies";

type Frequency = "daily" | "weekly" | "monthly" | "yearly";

interface Template {
  _id: string;
  type: "expense" | "income";
  amountMinor: number;
  currency: string;
  category: string;
  paymentMethod?: string;
  note?: string;
  isVatable: boolean;
  vatRate: number;
  frequency: Frequency;
  nextDueAt: string;
  lastGeneratedAt?: string;
  isActive: boolean;
  endsAt?: string;
}

interface FormState {
  type: "expense" | "income";
  amountMajor: string;
  currency: string;
  category: string;
  paymentMethod: string;
  note: string;
  isVatable: boolean;
  vatRate: string;
  frequency: Frequency;
  nextDueAt: string;
  endsAt: string;
}

const EMPTY_FORM: FormState = {
  type: "expense",
  amountMajor: "",
  currency: "AED",
  category: "",
  paymentMethod: "",
  note: "",
  isVatable: false,
  vatRate: "5",
  frequency: "monthly",
  nextDueAt: new Date().toISOString().slice(0, 10),
  endsAt: "",
};

const FREQ_LABELS: Record<Frequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

const PAYMENT_METHODS = [
  { value: "", label: "— none —" },
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "wallet", label: "Wallet" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
];

function formatMoney(minor: number, currency: string): string {
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Reducer for toggle-count so the list re-fetches after any mutation.
function useRefreshKey() {
  const [key, bump] = useReducer((n: number) => n + 1, 0);
  return [key, bump] as const;
}

// ---------------------------------------------------------------------------
// Template form (create + edit)
// ---------------------------------------------------------------------------

function TemplateForm({
  initial,
  onSave,
  onCancel,
  saving,
  error,
}: {
  initial: FormState;
  onSave: (f: FormState) => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}) {
  const [f, setF] = useState<FormState>(initial);
  const categories =
    f.type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  // Reset category when type changes if current category is invalid.
  function setType(t: "expense" | "income") {
    const allowed = t === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
    setF((prev) => ({
      ...prev,
      type: t,
      category: (allowed as readonly string[]).includes(prev.category)
        ? prev.category
        : "",
    }));
  }

  return (
    <div className="rounded-lg border border-sand bg-card p-5 shadow-sm">
      {error && (
        <p className="mb-3 rounded bg-red-bg px-3 py-2 text-sm text-red-ink">
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Type */}
        <div className="sm:col-span-2 flex gap-3">
          {(["expense", "income"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex-1 rounded-md border py-2 text-sm font-medium transition ${
                f.type === t
                  ? "border-green bg-green/10 text-green"
                  : "border-sand text-muted hover:border-ink/30"
              }`}
            >
              {t === "expense" ? "Expense" : "Income"}
            </button>
          ))}
        </div>

        {/* Amount */}
        <div>
          <label className="block text-xs font-medium text-muted mb-1">
            Amount
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={f.amountMajor}
            onChange={(e) => setF((p) => ({ ...p, amountMajor: e.target.value }))}
            className="w-full rounded-md border border-sand bg-paper px-3 py-2 text-sm text-ink focus:border-green focus:outline-none"
          />
        </div>

        {/* Currency */}
        <div>
          <label className="block text-xs font-medium text-muted mb-1">
            Currency
          </label>
          <select
            value={f.currency}
            onChange={(e) => setF((p) => ({ ...p, currency: e.target.value }))}
            className="w-full rounded-md border border-sand bg-paper px-3 py-2 text-sm text-ink focus:border-green focus:outline-none"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs font-medium text-muted mb-1">
            Category
          </label>
          <select
            value={f.category}
            onChange={(e) => setF((p) => ({ ...p, category: e.target.value }))}
            className="w-full rounded-md border border-sand bg-paper px-3 py-2 text-sm text-ink focus:border-green focus:outline-none"
          >
            <option value="">— select —</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Payment method */}
        <div>
          <label className="block text-xs font-medium text-muted mb-1">
            Payment method
          </label>
          <select
            value={f.paymentMethod}
            onChange={(e) =>
              setF((p) => ({ ...p, paymentMethod: e.target.value }))
            }
            className="w-full rounded-md border border-sand bg-paper px-3 py-2 text-sm text-ink focus:border-green focus:outline-none"
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Frequency */}
        <div>
          <label className="block text-xs font-medium text-muted mb-1">
            Frequency
          </label>
          <select
            value={f.frequency}
            onChange={(e) =>
              setF((p) => ({ ...p, frequency: e.target.value as Frequency }))
            }
            className="w-full rounded-md border border-sand bg-paper px-3 py-2 text-sm text-ink focus:border-green focus:outline-none"
          >
            {(["daily", "weekly", "monthly", "yearly"] as Frequency[]).map(
              (freq) => (
                <option key={freq} value={freq}>
                  {FREQ_LABELS[freq]}
                </option>
              ),
            )}
          </select>
        </div>

        {/* First due date */}
        <div>
          <label className="block text-xs font-medium text-muted mb-1">
            First due date
          </label>
          <input
            type="date"
            value={f.nextDueAt}
            onChange={(e) => setF((p) => ({ ...p, nextDueAt: e.target.value }))}
            className="w-full rounded-md border border-sand bg-paper px-3 py-2 text-sm text-ink focus:border-green focus:outline-none"
          />
        </div>

        {/* End date (optional) */}
        <div>
          <label className="block text-xs font-medium text-muted mb-1">
            End date{" "}
            <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            type="date"
            value={f.endsAt}
            onChange={(e) => setF((p) => ({ ...p, endsAt: e.target.value }))}
            className="w-full rounded-md border border-sand bg-paper px-3 py-2 text-sm text-ink focus:border-green focus:outline-none"
          />
        </div>

        {/* Note */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-muted mb-1">
            Note / label{" "}
            <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            type="text"
            maxLength={500}
            placeholder="e.g. Office rent"
            value={f.note}
            onChange={(e) => setF((p) => ({ ...p, note: e.target.value }))}
            className="w-full rounded-md border border-sand bg-paper px-3 py-2 text-sm text-ink focus:border-green focus:outline-none"
          />
        </div>

        {/* VAT */}
        <div className="sm:col-span-2 flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-ink select-none cursor-pointer">
            <input
              type="checkbox"
              checked={f.isVatable}
              onChange={(e) =>
                setF((p) => ({ ...p, isVatable: e.target.checked }))
              }
              className="accent-green"
            />
            VAT applicable
          </label>
          {f.isVatable && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted">Rate %</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={f.vatRate}
                onChange={(e) =>
                  setF((p) => ({ ...p, vatRate: e.target.value }))
                }
                className="w-20 rounded-md border border-sand bg-paper px-2 py-1 text-sm text-ink focus:border-green focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-md border border-sand px-4 py-2 text-sm text-muted hover:text-ink disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(f)}
          disabled={saving}
          className="rounded-md bg-green px-5 py-2 text-sm font-medium text-card hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save template"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function RecurringPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, bump] = useRefreshKey();

  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processMsg, setProcessMsg] = useState<string | null>(null);

  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/recurring")
      .then((r) => r.json())
      .then((d: { items: Template[] }) => setTemplates(d.items ?? []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  function templateToForm(t: Template): FormState {
    return {
      type: t.type,
      amountMajor: (t.amountMinor / 100).toFixed(2),
      currency: t.currency,
      category: t.category,
      paymentMethod: t.paymentMethod ?? "",
      note: t.note ?? "",
      isVatable: t.isVatable,
      vatRate: String(t.vatRate),
      frequency: t.frequency,
      nextDueAt: t.nextDueAt.slice(0, 10),
      endsAt: t.endsAt ? t.endsAt.slice(0, 10) : "",
    };
  }

  function buildPayload(f: FormState) {
    const amountMajor = parseFloat(f.amountMajor);
    return {
      type: f.type,
      amountMinor: Math.round(amountMajor * 100),
      currency: f.currency,
      category: f.category,
      ...(f.paymentMethod ? { paymentMethod: f.paymentMethod } : {}),
      ...(f.note.trim() ? { note: f.note.trim() } : {}),
      isVatable: f.isVatable,
      vatRate: f.isVatable ? parseFloat(f.vatRate) || 0 : 0,
      frequency: f.frequency,
      nextDueAt: new Date(f.nextDueAt).toISOString(),
      ...(f.endsAt ? { endsAt: new Date(f.endsAt).toISOString() } : {}),
    };
  }

  async function handleCreate(f: FormState) {
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(f)),
      });
      const json = await res.json();
      if (!res.ok) {
        setFormError(json.error ?? "Could not save template.");
        return;
      }
      setShowForm(false);
      bump();
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(f: FormState) {
    if (!editingId) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/recurring/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(f)),
      });
      const json = await res.json();
      if (!res.ok) {
        setEditError(json.error ?? "Could not update template.");
        return;
      }
      setEditingId(null);
      bump();
    } catch {
      setEditError("Something went wrong. Please try again.");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/recurring/${id}`, { method: "DELETE" });
      bump();
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggleActive(t: Template) {
    await fetch(`/api/recurring/${t._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !t.isActive }),
    });
    bump();
  }

  async function handleRunNow() {
    setProcessing(true);
    setProcessMsg(null);
    try {
      const res = await fetch("/api/recurring/process", { method: "POST" });
      const json = (await res.json()) as { generated?: number; error?: string };
      if (!res.ok) {
        setProcessMsg(`Error: ${json.error ?? "Unknown error"}`);
      } else {
        setProcessMsg(
          json.generated === 0
            ? "Nothing due right now."
            : `Generated ${json.generated} transaction${json.generated === 1 ? "" : "s"}.`,
        );
        bump();
      }
    } catch {
      setProcessMsg("Request failed. Please try again.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <main ref={pageRef} className="min-h-dvh bg-paper px-4 py-10">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-2">
          <Link href="/dashboard" className="text-sm text-muted hover:text-ink">
            ← Dashboard
          </Link>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
              Recurring
            </h1>
            <p className="mt-0.5 text-sm text-muted">
              Templates that auto-create a transaction on their due date.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRunNow}
              disabled={processing}
              className="rounded-md border border-sand px-3 py-2 text-xs font-medium text-muted hover:text-ink disabled:opacity-50"
              title="Generate any transactions that are due now"
            >
              {processing ? "Running…" : "Run now"}
            </button>
            <button
              onClick={() => {
                setShowForm(true);
                setFormError(null);
              }}
              className="rounded-md bg-green px-4 py-2 text-sm font-medium text-card hover:opacity-90"
            >
              + New template
            </button>
          </div>
        </div>

        {processMsg && (
          <p className="mt-3 rounded-md bg-sand px-3 py-2 text-sm text-muted">
            {processMsg}
          </p>
        )}

        {/* Create form */}
        {showForm && (
          <div className="mt-6">
            <TemplateForm
              initial={EMPTY_FORM}
              onSave={handleCreate}
              onCancel={() => setShowForm(false)}
              saving={saving}
              error={formError}
            />
          </div>
        )}

        {/* List */}
        <div className="mt-6 space-y-3">
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-20 animate-pulse rounded-lg bg-sand"
                />
              ))}
            </div>
          )}

          {!loading && templates.length === 0 && !showForm && (
            <div className="rounded-lg border border-dashed border-sand py-12 text-center text-sm text-muted">
              No recurring templates yet.
              <br />
              Use the{" "}
              <button
                onClick={() => setShowForm(true)}
                className="text-green underline"
              >
                + New template
              </button>{" "}
              button to create one.
            </div>
          )}

          {templates.map((t) =>
            editingId === t._id ? (
              <div key={t._id}>
                <TemplateForm
                  initial={editForm}
                  onSave={handleEdit}
                  onCancel={() => setEditingId(null)}
                  saving={editSaving}
                  error={editError}
                />
              </div>
            ) : (
              <TemplateRow
                key={t._id}
                template={t}
                deleting={deletingId === t._id}
                onEdit={() => {
                  setEditingId(t._id);
                  setEditForm(templateToForm(t));
                  setEditError(null);
                }}
                onDelete={() => handleDelete(t._id)}
                onToggleActive={() => handleToggleActive(t)}
              />
            ),
          )}
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Template row
// ---------------------------------------------------------------------------

function TemplateRow({
  template: t,
  deleting,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  template: Template;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      className={`rounded-lg border bg-card p-4 shadow-sm transition-opacity ${
        t.isActive ? "border-sand" : "border-sand/50 opacity-60"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: label + meta */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                t.type === "expense"
                  ? "bg-red-bg text-red-ink"
                  : "bg-green/10 text-green"
              }`}
            >
              {t.type}
            </span>
            <span className="rounded-full bg-sand px-2 py-0.5 text-xs text-muted">
              {FREQ_LABELS[t.frequency]}
            </span>
            {!t.isActive && (
              <span className="rounded-full bg-sand px-2 py-0.5 text-xs text-muted">
                paused
              </span>
            )}
          </div>
          <p className="mt-1.5 font-display text-base font-semibold text-ink">
            {formatMoney(t.amountMinor, t.currency)}
          </p>
          <p className="text-sm text-muted">
            {t.category}
            {t.note ? ` · ${t.note}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted">
            Next: {formatDate(t.nextDueAt)}
            {t.lastGeneratedAt
              ? ` · Last generated: ${formatDate(t.lastGeneratedAt)}`
              : " · Never generated"}
            {t.endsAt ? ` · Ends: ${formatDate(t.endsAt)}` : ""}
          </p>
        </div>

        {/* Right: actions */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={onToggleActive}
            title={t.isActive ? "Pause" : "Resume"}
            className="rounded p-1.5 text-muted hover:bg-sand hover:text-ink"
          >
            {t.isActive ? (
              <PauseIcon />
            ) : (
              <PlayIcon />
            )}
          </button>
          <button
            onClick={onEdit}
            title="Edit"
            className="rounded p-1.5 text-muted hover:bg-sand hover:text-ink"
          >
            <PencilIcon />
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setConfirmDelete(false);
                  onDelete();
                }}
                disabled={deleting}
                className="rounded bg-red-bg px-2 py-1 text-xs font-medium text-red-ink hover:opacity-80 disabled:opacity-50"
              >
                {deleting ? "…" : "Delete"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded px-2 py-1 text-xs text-muted hover:text-ink"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              title="Delete"
              className="rounded p-1.5 text-muted hover:bg-red-bg hover:text-red-ink"
            >
              <TrashIcon />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline SVG icons (no external dep)
// ---------------------------------------------------------------------------

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M11.013 2.513a1.75 1.75 0 0 1 2.475 2.474L5.5 12.975l-3 .75.75-3 7.763-8.212z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M2 4h12M5 4V2.5A.5.5 0 0 1 5.5 2h5a.5.5 0 0 1 .5.5V4M6 7v5M10 7v5M3 4l1 9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
      <rect x="3" y="2" width="3.5" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9.5" y="2" width="3.5" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M4 2.5l9 5.5-9 5.5V2.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
