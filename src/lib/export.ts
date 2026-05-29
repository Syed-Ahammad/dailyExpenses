// CSV / PDF export of monthly transactions (FR-22 CSV, FR-23 PDF).
// Lives in src/lib per the folder conventions — the route stays thin.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
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

/** Integer minor units → 2-decimal major string (the display edge, NFR-1). */
function major(minor: number): string {
  return (minor / 100).toFixed(2);
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-05" → "May 2026" for report headings. */
function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${MONTH_NAMES[Number(m) - 1] ?? m} ${y}`;
}

// ---------------------------------------------------------------------------
// Shared data load
// ---------------------------------------------------------------------------

interface MonthlyData {
  baseCurrency: string;
  rows: ExportRow[];
}

/** Loads a user's base currency + their transactions for the month (UTC),
 *  sorted oldest-first. Scoped to userId — never trust a client id. */
async function loadMonthly(
  userId: string,
  month: string,
): Promise<MonthlyData> {
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

  return { baseCurrency: user?.baseCurrency ?? DEFAULT_BASE_CURRENCY, rows };
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** Quote a CSV field only when it contains a comma, quote, or newline; escape
 *  embedded quotes by doubling them (RFC 4180). */
function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Builds a CSV (RFC 4180, CRLF) from transactions. Each row carries the original
 * amount and the base-currency equivalent (amountMinor * rateToBase, rounded
 * once). An empty array still yields a valid file with just the header line.
 */
export function transactionsToCsv(
  rows: ExportRow[],
  baseCurrency: string,
): string {
  const header = [
    "Date", "Type", "Category", "Currency", "Amount",
    `Rate to ${baseCurrency}`, `Amount (${baseCurrency})`,
    "Payment Method", "VATable", "VAT %", "Note",
  ];
  const lines = [header.map(csvCell).join(",")];

  for (const r of rows) {
    const date = new Date(r.occurredAt).toISOString().slice(0, 10);
    const baseMinor = Math.round(r.amountMinor * r.rateToBase);
    lines.push(
      [
        date, r.type, r.category, r.currency, major(r.amountMinor),
        String(r.rateToBase), major(baseMinor),
        r.paymentMethod ?? "", r.isVatable ? "yes" : "no",
        String(r.vatRate ?? 0), r.note ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\r\n") + "\r\n";
}

export async function exportMonthlyCsv(
  userId: string,
  month: string,
): Promise<string> {
  const { baseCurrency, rows } = await loadMonthly(userId, month);
  return transactionsToCsv(rows, baseCurrency);
}

// ---------------------------------------------------------------------------
// PDF (pdf-lib — pure JS, serverless-safe)
// ---------------------------------------------------------------------------

const INK = rgb(0.078, 0.125, 0.11);
const GREEN = rgb(0.122, 0.361, 0.271);
const MUTED = rgb(0.486, 0.502, 0.475);
const SAND = rgb(0.91, 0.89, 0.831);

// A4 portrait + layout metrics (points).
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const BOTTOM = MARGIN + 6;

// Column anchors: amounts are right-aligned to their right edge.
const COL = {
  date: 40,
  type: 100,
  category: 150,
  currency: 252,
  amountRight: 360,
  baseRight: 448,
  note: 456,
  noteRight: PAGE_W - MARGIN,
};

/** Truncate to fit maxWidth, appending an ellipsis when cut. */
function fit(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && font.widthOfTextAtSize(s + "…", size) > maxWidth) {
    s = s.slice(0, -1);
  }
  return s + "…";
}

function drawTableHeader(page: PDFPage, y: number, bold: PDFFont): void {
  const size = 9;
  page.drawText("Date", { x: COL.date, y, size, font: bold, color: MUTED });
  page.drawText("Type", { x: COL.type, y, size, font: bold, color: MUTED });
  page.drawText("Category", { x: COL.category, y, size, font: bold, color: MUTED });
  page.drawText("Cur", { x: COL.currency, y, size, font: bold, color: MUTED });
  const amt = "Amount";
  page.drawText(amt, {
    x: COL.amountRight - bold.widthOfTextAtSize(amt, size),
    y, size, font: bold, color: MUTED,
  });
  const base = "Base";
  page.drawText(base, {
    x: COL.baseRight - bold.widthOfTextAtSize(base, size),
    y, size, font: bold, color: MUTED,
  });
  page.drawText("Note", { x: COL.note, y, size, font: bold, color: MUTED });
  page.drawLine({
    start: { x: MARGIN, y: y - 4 },
    end: { x: PAGE_W - MARGIN, y: y - 4 },
    thickness: 0.5,
    color: SAND,
  });
}

/**
 * Generates a readable one-month PDF report: title, totals, and a paginated
 * transaction table with original + base-currency amounts. Returns the raw
 * PDF bytes. (FR-23)
 */
export async function exportMonthlyPdf(
  userId: string,
  month: string,
): Promise<Uint8Array> {
  const { baseCurrency, rows } = await loadMonthly(userId, month);

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  // Title + subtitle
  page.drawText("Daily Expenses", { x: MARGIN, y, size: 18, font: bold, color: GREEN });
  y -= 18;
  page.drawText(`Monthly report · ${monthLabel(month)} · amounts in ${baseCurrency}`, {
    x: MARGIN, y, size: 10, font, color: MUTED,
  });
  y -= 24;

  // Totals (base currency)
  let expense = 0;
  let income = 0;
  for (const r of rows) {
    const baseMinor = Math.round(r.amountMinor * r.rateToBase);
    if (r.type === "expense") expense += baseMinor;
    else income += baseMinor;
  }
  const summary =
    `Income: ${baseCurrency} ${major(income)}     ` +
    `Expense: ${baseCurrency} ${major(expense)}     ` +
    `Balance: ${baseCurrency} ${major(income - expense)}`;
  page.drawText(summary, { x: MARGIN, y, size: 11, font: bold, color: INK });
  y -= 22;

  // Table
  drawTableHeader(page, y, bold);
  y -= 16;

  const size = 8;
  const rowH = 13;
  if (rows.length === 0) {
    page.drawText("No transactions for this month.", {
      x: MARGIN, y, size, font, color: MUTED,
    });
  }

  for (const r of rows) {
    if (y < BOTTOM) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
      drawTableHeader(page, y, bold);
      y -= 16;
    }

    const date = new Date(r.occurredAt).toISOString().slice(0, 10);
    const baseMinor = Math.round(r.amountMinor * r.rateToBase);
    const amount = major(r.amountMinor);
    const baseAmt = major(baseMinor);

    page.drawText(date, { x: COL.date, y, size, font, color: INK });
    page.drawText(r.type, { x: COL.type, y, size, font, color: r.type === "income" ? GREEN : INK });
    page.drawText(fit(r.category, font, size, COL.currency - COL.category - 4), {
      x: COL.category, y, size, font, color: INK,
    });
    page.drawText(r.currency, { x: COL.currency, y, size, font, color: INK });
    page.drawText(amount, { x: COL.amountRight - font.widthOfTextAtSize(amount, size), y, size, font, color: INK });
    page.drawText(baseAmt, { x: COL.baseRight - font.widthOfTextAtSize(baseAmt, size), y, size, font, color: INK });
    page.drawText(fit(r.note ?? "", font, size, COL.noteRight - COL.note), {
      x: COL.note, y, size, font, color: MUTED,
    });

    y -= rowH;
  }

  return doc.save();
}
