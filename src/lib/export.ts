// CSV / PDF export of monthly transactions (FR-22 CSV; FR-23 PDF later).
// Lives in src/lib per the folder conventions — the route stays thin.

import { connectMongo } from "./mongodb";
import { DEFAULT_BASE_CURRENCY } from "./currencies";
import { TransactionModel } from "@/models/Transaction";
import { UserModel } from "@/models/User";

/** Minimal shape of a transaction needed for export (a lean Mongo doc fits). */
export interface ExportRow {
  type: string;
  amountMinor: number;
  currency: string;
  rateToBase: number;
  category: string;
  paymentMethod?: string | null;
  note?: string | null;
  isVatable?: boolean;
  vatRate?: number;
  occurredAt: Date | string;
}

/**
 * Parses a "YYYY-MM" string into a UTC half-open month range [start, end).
 * Returns null if the string isn't a valid month — callers reject with 400.
 * UTC matches the dashboard's date boundaries (docs note in dashboard.ts).
 */
export function monthRangeUtc(
  month: string,
): { start: Date; end: Date } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const year = Number(m[1]);
  const mon = Number(m[2]);
  if (mon < 1 || mon > 12) return null;
  return {
    start: new Date(Date.UTC(year, mon - 1, 1)),
    end: new Date(Date.UTC(year, mon, 1)), // exclusive
  };
}

/** Quote a CSV field only when it contains a comma, quote, or newline; escape
 *  embedded quotes by doubling them (RFC 4180). */
function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Integer minor units → 2-decimal major string (the display edge, NFR-1). */
function major(minor: number): string {
  return (minor / 100).toFixed(2);
}

/**
 * Builds a CSV (RFC 4180, CRLF line endings) from transactions. Each row carries
 * both the original-currency amount and the base-currency equivalent
 * (amountMinor * rateToBase, rounded once). An empty array still yields a valid
 * file with just the header line.
 */
export function transactionsToCsv(
  rows: ExportRow[],
  baseCurrency: string,
): string {
  const header = [
    "Date",
    "Type",
    "Category",
    "Currency",
    "Amount",
    `Rate to ${baseCurrency}`,
    `Amount (${baseCurrency})`,
    "Payment Method",
    "VATable",
    "VAT %",
    "Note",
  ];

  const lines = [header.map(csvCell).join(",")];

  for (const r of rows) {
    const date = new Date(r.occurredAt).toISOString().slice(0, 10);
    const baseMinor = Math.round(r.amountMinor * r.rateToBase);
    lines.push(
      [
        date,
        r.type,
        r.category,
        r.currency,
        major(r.amountMinor),
        String(r.rateToBase),
        major(baseMinor),
        r.paymentMethod ?? "",
        r.isVatable ? "yes" : "no",
        String(r.vatRate ?? 0),
        r.note ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }

  return lines.join("\r\n") + "\r\n";
}

/**
 * Fetches a user's transactions for the given month (UTC) and returns a CSV
 * string. Scoped to userId — never trust a client-supplied id (docs/auth.md).
 *
 * @param userId Authenticated user's id (from getUserId()).
 * @param month  "YYYY-MM".
 * @throws If month is malformed (the route validates first, so this is a guard).
 */
export async function exportMonthlyCsv(
  userId: string,
  month: string,
): Promise<string> {
  const range = monthRangeUtc(month);
  if (!range) throw new Error(`Invalid month: ${month}`);

  await connectMongo();

  const [user, rows] = await Promise.all([
    UserModel.findById(userId).lean<{ baseCurrency?: string } | null>(),
    TransactionModel.find({
      userId,
      occurredAt: { $gte: range.start, $lt: range.end },
    })
      .sort({ occurredAt: 1 })
      .lean<ExportRow[]>(),
  ]);

  const baseCurrency = user?.baseCurrency ?? DEFAULT_BASE_CURRENCY;
  return transactionsToCsv(rows, baseCurrency);
}

export async function exportMonthlyPdf(
  _userId: string,
  _month: string,
): Promise<Buffer> {
  // FR-23 — planned for a later phase.
  throw new Error("exportMonthlyPdf not implemented");
}
