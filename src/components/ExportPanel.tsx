"use client";

/**
 * ExportPanel — pick a month and download its transactions as CSV (FR-22).
 *
 * The download is a plain GET navigation to /api/export; the response's
 * Content-Disposition makes the browser save the file without leaving the page.
 */

import { useState } from "react";

/** Current month as YYYY-MM (local) for the month input default. */
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function ExportPanel({
  baseCurrency,
}: {
  baseCurrency: string;
}) {
  const [month, setMonth] = useState(currentMonth());

  function download(format: "csv" | "pdf") {
    if (!month) return;
    window.location.href = `/api/export?month=${encodeURIComponent(month)}&format=${format}`;
  }

  return (
    <section
      aria-label="Export"
      className="rounded-lg border border-sand bg-card p-5 shadow-sm"
    >
      <h2 className="mb-1 text-lg font-semibold text-ink">Monthly export</h2>
      <p className="mb-4 text-sm text-muted">
        Download every transaction for a month, with amounts in {baseCurrency}.
        CSV for a spreadsheet, PDF for a printable record.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label
            htmlFor="export-month"
            className="mb-1 block text-sm font-medium text-ink"
          >
            Month
          </label>
          <input
            id="export-month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-sm border border-sand px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-soft"
          />
        </div>

        <button
          type="button"
          onClick={() => download("csv")}
          disabled={!month}
          className="rounded-md bg-green px-4 py-2.5 text-sm font-medium text-card transition-[transform,opacity] hover:opacity-90 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-green-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          Download CSV
        </button>

        <button
          type="button"
          onClick={() => download("pdf")}
          disabled={!month}
          className="rounded-md border border-sand px-4 py-2.5 text-sm font-medium text-ink transition-[transform,opacity] hover:bg-paper active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-green-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          Download PDF
        </button>
      </div>
    </section>
  );
}
