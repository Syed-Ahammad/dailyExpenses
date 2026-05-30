"use client";

/**
 * VatReportPanel — pick a quarter (or month), preview the VAT summary, and
 * download CSV / PDF. Phase 5, FR-29.
 *
 * The on-screen summary is a quick JSON fetch of /api/vat-report so the user
 * sees a number before downloading. Downloads themselves are plain GET
 * navigations to the same endpoint with ?format=csv|pdf.
 */

import { useCallback, useEffect, useState } from "react";

type Cadence = "quarter" | "month";

interface VatTotals {
  vatMinor: number;
  netMinor: number;
  grossMinor: number;
  byRate: Array<{
    rate: number;
    netMinor: number;
    vatMinor: number;
    grossMinor: number;
  }>;
  byCategory: Array<{
    category: string;
    netMinor: number;
    vatMinor: number;
  }>;
}

interface VatReport {
  period: string;
  kind: Cadence;
  from: string;
  to: string;
  baseCurrency: string;
  output: VatTotals;
  input: VatTotals;
  netVatMinor: number;
}

function major(minor: number): string {
  return (minor / 100).toFixed(2);
}

function currentQuarter(): { year: number; quarter: number } {
  const now = new Date();
  return {
    year: now.getUTCFullYear(),
    quarter: Math.floor(now.getUTCMonth() / 3) + 1,
  };
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function VatReportPanel({
  baseCurrency,
}: {
  baseCurrency: string;
}) {
  const [cadence, setCadence] = useState<Cadence>("quarter");
  const { year: initialYear, quarter: initialQuarter } = currentQuarter();
  const [year, setYear] = useState(initialYear);
  const [quarter, setQuarter] = useState(initialQuarter);
  const [month, setMonth] = useState(currentMonth());

  const [report, setReport] = useState<VatReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const period = cadence === "quarter" ? `${year}-Q${quarter}` : month;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/vat-report?period=${encodeURIComponent(period)}`,
      );
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setError(json.error ?? "Failed to load VAT report.");
        setReport(null);
        return;
      }
      const json = (await res.json()) as VatReport;
      setReport(json);
    } catch {
      setError("Network error while loading VAT report.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  function download(format: "csv" | "pdf") {
    window.location.href = `/api/vat-report?period=${encodeURIComponent(period)}&format=${format}`;
  }

  // 5 years back, plus current and next, for the year select.
  const yearChoices: number[] = [];
  const nowYear = new Date().getUTCFullYear();
  for (let y = nowYear + 1; y >= nowYear - 5; y--) yearChoices.push(y);

  return (
    <section
      aria-label="VAT report"
      className="rounded-lg border border-sand bg-card p-5 shadow-sm"
    >
      <h2 className="mb-1 text-lg font-semibold text-ink">VAT report</h2>
      <p className="mb-4 text-sm text-muted">
        Output, input, and net VAT for a period, in {baseCurrency}. Suitable
        for handing to your accountant.
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label
            htmlFor="vat-cadence"
            className="mb-1 block text-sm font-medium text-ink"
          >
            Period
          </label>
          <select
            id="vat-cadence"
            value={cadence}
            onChange={(e) => setCadence(e.target.value as Cadence)}
            className="rounded-sm border border-sand bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-soft"
          >
            <option value="quarter">Quarterly</option>
            <option value="month">Monthly</option>
          </select>
        </div>

        {cadence === "quarter" ? (
          <>
            <div>
              <label
                htmlFor="vat-year"
                className="mb-1 block text-sm font-medium text-ink"
              >
                Year
              </label>
              <select
                id="vat-year"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="rounded-sm border border-sand bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-soft"
              >
                {yearChoices.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="vat-quarter"
                className="mb-1 block text-sm font-medium text-ink"
              >
                Quarter
              </label>
              <select
                id="vat-quarter"
                value={quarter}
                onChange={(e) => setQuarter(Number(e.target.value))}
                className="rounded-sm border border-sand bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-soft"
              >
                <option value={1}>Q1 (Jan–Mar)</option>
                <option value={2}>Q2 (Apr–Jun)</option>
                <option value={3}>Q3 (Jul–Sep)</option>
                <option value={4}>Q4 (Oct–Dec)</option>
              </select>
            </div>
          </>
        ) : (
          <div>
            <label
              htmlFor="vat-month"
              className="mb-1 block text-sm font-medium text-ink"
            >
              Month
            </label>
            <input
              id="vat-month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-sm border border-sand px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-soft"
            />
          </div>
        )}

        <button
          type="button"
          onClick={() => download("csv")}
          className="rounded-md bg-green px-4 py-2.5 text-sm font-medium text-card transition-[transform,opacity] hover:opacity-90 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-green-soft"
        >
          Download CSV
        </button>
        <button
          type="button"
          onClick={() => download("pdf")}
          className="rounded-md border border-sand px-4 py-2.5 text-sm font-medium text-ink transition-[transform,opacity] hover:bg-paper active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-green-soft"
        >
          Download PDF
        </button>
      </div>

      {error !== null && (
        <p
          role="alert"
          className="mb-3 rounded-md bg-red-bg px-4 py-3 text-sm text-red-ink"
        >
          {error}
        </p>
      )}

      {/* Summary block — three figures the user/accountant cares about. */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Output VAT"
          sub="VAT collected"
          value={report ? `${baseCurrency} ${major(report.output.vatMinor)}` : "—"}
          loading={loading}
        />
        <SummaryCard
          label="Input VAT"
          sub="VAT reclaimable"
          value={report ? `${baseCurrency} ${major(report.input.vatMinor)}` : "—"}
          loading={loading}
        />
        <SummaryCard
          label="Net VAT due"
          sub="Output − Input"
          value={report ? `${baseCurrency} ${major(report.netVatMinor)}` : "—"}
          loading={loading}
          accent
        />
      </div>

      {/* Per-rate breakdown — keeps a single combined table for compactness. */}
      {report && (report.output.byRate.length > 0 || report.input.byRate.length > 0) && (
        <div className="mb-4 overflow-x-auto rounded-lg border border-sand">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-paper text-left">
                <th className="px-4 py-2.5 font-medium text-muted">Stream</th>
                <th className="px-4 py-2.5 font-medium text-muted">Rate %</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted">
                  Net ({baseCurrency})
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-muted">
                  VAT ({baseCurrency})
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-muted">
                  Gross ({baseCurrency})
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand">
              {report.output.byRate.map((r) => (
                <tr key={`out-${r.rate}`}>
                  <td className="px-4 py-2.5 text-green">Output</td>
                  <td className="px-4 py-2.5 text-ink">{r.rate}%</td>
                  <td className="px-4 py-2.5 text-right font-display tabular-nums text-ink">
                    {major(r.netMinor)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-display tabular-nums text-ink">
                    {major(r.vatMinor)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-display tabular-nums text-ink">
                    {major(r.grossMinor)}
                  </td>
                </tr>
              ))}
              {report.input.byRate.map((r) => (
                <tr key={`in-${r.rate}`}>
                  <td className="px-4 py-2.5 text-ink">Input</td>
                  <td className="px-4 py-2.5 text-ink">{r.rate}%</td>
                  <td className="px-4 py-2.5 text-right font-display tabular-nums text-ink">
                    {major(r.netMinor)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-display tabular-nums text-ink">
                    {major(r.vatMinor)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-display tabular-nums text-ink">
                    {major(r.grossMinor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {report &&
        report.output.byRate.length === 0 &&
        report.input.byRate.length === 0 &&
        !loading && (
          <p className="text-sm text-muted">
            No VAT-flagged transactions in this period. Mark a transaction as
            VATable on entry (or edit it from the dashboard) and it will show
            up here.
          </p>
        )}
    </section>
  );
}

function SummaryCard({
  label,
  sub,
  value,
  loading,
  accent,
}: {
  label: string;
  sub: string;
  value: string;
  loading: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-md border px-4 py-3 ${
        accent ? "border-green/40 bg-green-soft/40" : "border-sand bg-paper"
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p
        className={`mt-1 font-display text-xl font-semibold tabular-nums ${
          accent ? "text-green" : "text-ink"
        }`}
      >
        {loading ? "…" : value}
      </p>
      <p className="mt-1 text-xs text-muted">{sub}</p>
    </div>
  );
}
