"use client";

/**
 * Export panel for the read-only shared view.
 * Routes to /api/shared/:ownerId/export and /api/shared/:ownerId/vat-report.
 */

import { useState } from "react";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function currentQuarter(): string {
  const d = new Date();
  const q = Math.ceil((d.getMonth() + 1) / 3);
  return `${d.getFullYear()}-Q${q}`;
}

export default function SharedExportPanel({
  ownerId,
  baseCurrency,
}: {
  ownerId: string;
  baseCurrency: string;
}) {
  const [month, setMonth] = useState(currentMonth());
  const [vatPeriod, setVatPeriod] = useState(currentQuarter());

  function downloadExport(format: "csv" | "pdf") {
    if (!month) return;
    window.location.href = `/api/shared/${ownerId}/export?month=${encodeURIComponent(month)}&format=${format}`;
  }

  function downloadVat(format: "csv" | "pdf") {
    if (!vatPeriod) return;
    window.location.href = `/api/shared/${ownerId}/vat-report?period=${encodeURIComponent(vatPeriod)}&format=${format}`;
  }

  return (
    <div className="space-y-4">
      {/* Monthly export */}
      <section className="rounded-lg border border-sand bg-card p-5 shadow-sm">
        <h2 className="mb-1 text-base font-semibold text-ink">
          Monthly export
        </h2>
        <p className="mb-4 text-sm text-muted">
          Download transactions for a month, in {baseCurrency}.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">
              Month
            </label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-md border border-sand bg-paper px-3 py-2 text-sm text-ink focus:border-green focus:outline-none"
            />
          </div>
          <button
            onClick={() => downloadExport("csv")}
            className="rounded-md border border-sand bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-sand"
          >
            CSV
          </button>
          <button
            onClick={() => downloadExport("pdf")}
            className="rounded-md border border-sand bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-sand"
          >
            PDF
          </button>
        </div>
      </section>

      {/* VAT report */}
      <section className="rounded-lg border border-sand bg-card p-5 shadow-sm">
        <h2 className="mb-1 text-base font-semibold text-ink">VAT report</h2>
        <p className="mb-4 text-sm text-muted">
          Period summary of output VAT, input VAT, and net due.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">
              Period
            </label>
            <input
              type="text"
              placeholder="e.g. 2026-Q2 or 2026-05"
              value={vatPeriod}
              onChange={(e) => setVatPeriod(e.target.value)}
              className="w-40 rounded-md border border-sand bg-paper px-3 py-2 text-sm text-ink focus:border-green focus:outline-none"
            />
          </div>
          <button
            onClick={() => downloadVat("csv")}
            className="rounded-md border border-sand bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-sand"
          >
            CSV
          </button>
          <button
            onClick={() => downloadVat("pdf")}
            className="rounded-md border border-sand bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-sand"
          >
            PDF
          </button>
        </div>
      </section>
    </div>
  );
}
