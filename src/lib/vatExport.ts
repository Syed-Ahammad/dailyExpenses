// CSV + PDF rendering for the period VAT report (Phase 5, FR-29).
// Mirrors the structure of export.ts so /api/vat-report stays thin.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { VatReport } from "./vat";

function major(minor: number): string {
  return (minor / 100).toFixed(2);
}

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Render the VAT report as a single CSV that an accountant can paste straight
 * into a working sheet: header summary, then a Per-rate section, then a
 * Per-category section. CRLF line endings to match RFC 4180.
 */
export function vatReportToCsv(report: VatReport): string {
  const b = report.baseCurrency;
  const lines: string[] = [];

  lines.push(
    ["Period", report.period, report.kind].map(csvCell).join(","),
  );
  lines.push(["Range", report.from, report.to].map(csvCell).join(","));
  lines.push(["Base currency", b].map(csvCell).join(","));
  lines.push("");

  lines.push(["Summary"].join(","));
  lines.push([`Output VAT (${b})`, major(report.output.vatMinor)].map(csvCell).join(","));
  lines.push([`Input VAT (${b})`, major(report.input.vatMinor)].map(csvCell).join(","));
  lines.push([`Net VAT due (${b})`, major(report.netVatMinor)].map(csvCell).join(","));
  lines.push("");

  lines.push(
    ["Output VAT — by rate", "Rate %", `Net (${b})`, `VAT (${b})`, `Gross (${b})`]
      .map(csvCell)
      .join(","),
  );
  for (const r of report.output.byRate) {
    lines.push(
      ["", String(r.rate), major(r.netMinor), major(r.vatMinor), major(r.grossMinor)]
        .map(csvCell)
        .join(","),
    );
  }
  lines.push("");

  lines.push(
    ["Input VAT — by rate", "Rate %", `Net (${b})`, `VAT (${b})`, `Gross (${b})`]
      .map(csvCell)
      .join(","),
  );
  for (const r of report.input.byRate) {
    lines.push(
      ["", String(r.rate), major(r.netMinor), major(r.vatMinor), major(r.grossMinor)]
        .map(csvCell)
        .join(","),
    );
  }
  lines.push("");

  lines.push(
    ["Output VAT — by category", "Category", `Net (${b})`, `VAT (${b})`]
      .map(csvCell)
      .join(","),
  );
  for (const c of report.output.byCategory) {
    lines.push(
      ["", c.category, major(c.netMinor), major(c.vatMinor)].map(csvCell).join(","),
    );
  }
  lines.push("");

  lines.push(
    ["Input VAT — by category", "Category", `Net (${b})`, `VAT (${b})`]
      .map(csvCell)
      .join(","),
  );
  for (const c of report.input.byCategory) {
    lines.push(
      ["", c.category, major(c.netMinor), major(c.vatMinor)].map(csvCell).join(","),
    );
  }

  return lines.join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

const INK = rgb(0.078, 0.125, 0.11);
const GREEN = rgb(0.122, 0.361, 0.271);
const MUTED = rgb(0.486, 0.502, 0.475);
const SAND = rgb(0.91, 0.89, 0.831);

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const BOTTOM = MARGIN + 6;

function rule(page: PDFPage, y: number): void {
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 0.5,
    color: SAND,
  });
}

interface Ctx {
  doc: PDFDocument;
  font: PDFFont;
  bold: PDFFont;
  page: PDFPage;
  y: number;
}

function ensureSpace(ctx: Ctx, needed: number): void {
  if (ctx.y - needed < BOTTOM) {
    ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
    ctx.y = PAGE_H - MARGIN;
  }
}

function drawText(
  ctx: Ctx,
  text: string,
  opts: { x: number; size: number; font: PDFFont; color?: ReturnType<typeof rgb> },
): void {
  ctx.page.drawText(text, {
    x: opts.x,
    y: ctx.y,
    size: opts.size,
    font: opts.font,
    color: opts.color ?? INK,
  });
}

/**
 * One-page (usually) FTA-shaped VAT report PDF. Header → summary box →
 * per-rate breakdown for Output and Input → per-category breakdown.
 */
export async function vatReportToPdf(report: VatReport): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const ctx: Ctx = { doc, font, bold, page, y: PAGE_H - MARGIN };
  const b = report.baseCurrency;

  drawText(ctx, "Daily Expenses", { x: MARGIN, size: 18, font: bold, color: GREEN });
  ctx.y -= 18;
  drawText(
    ctx,
    `VAT report · ${report.period} · ${report.from} – ${report.to} · amounts in ${b}`,
    { x: MARGIN, size: 10, font, color: MUTED },
  );
  ctx.y -= 24;

  // Summary box (three big numbers)
  drawText(ctx, "Summary", { x: MARGIN, size: 12, font: bold });
  ctx.y -= 14;
  rule(ctx.page, ctx.y);
  ctx.y -= 14;

  const summaryRows: Array<[string, number]> = [
    [`Output VAT (collected)`, report.output.vatMinor],
    [`Input VAT (reclaimable)`, report.input.vatMinor],
    [`Net VAT due`, report.netVatMinor],
  ];
  for (const [label, value] of summaryRows) {
    drawText(ctx, label, { x: MARGIN, size: 11, font });
    const valueStr = `${b} ${major(value)}`;
    const valueWidth = bold.widthOfTextAtSize(valueStr, 11);
    drawText(ctx, valueStr, {
      x: PAGE_W - MARGIN - valueWidth,
      size: 11,
      font: bold,
    });
    ctx.y -= 16;
  }
  ctx.y -= 8;

  drawRateSection(ctx, "Output VAT — by rate", report.output.byRate, b);
  drawRateSection(ctx, "Input VAT — by rate", report.input.byRate, b);

  drawCategorySection(ctx, "Output VAT — by category", report.output.byCategory, b);
  drawCategorySection(ctx, "Input VAT — by category", report.input.byCategory, b);

  return doc.save();
}

function drawRateSection(
  ctx: Ctx,
  title: string,
  rows: VatReport["output"]["byRate"],
  baseCurrency: string,
): void {
  ensureSpace(ctx, 60);
  drawText(ctx, title, { x: MARGIN, size: 11, font: ctx.bold });
  ctx.y -= 14;
  rule(ctx.page, ctx.y);
  ctx.y -= 12;

  if (rows.length === 0) {
    drawText(ctx, "Nothing in this period.", { x: MARGIN, size: 9, font: ctx.font, color: MUTED });
    ctx.y -= 18;
    return;
  }

  // Column anchors (right-aligned amount columns).
  const xRate = MARGIN;
  const xNetRight = MARGIN + 240;
  const xVatRight = MARGIN + 360;
  const xGrossRight = PAGE_W - MARGIN;

  drawText(ctx, "Rate %", { x: xRate, size: 9, font: ctx.bold, color: MUTED });
  drawText(ctx, `Net (${baseCurrency})`, {
    x: xNetRight - ctx.bold.widthOfTextAtSize(`Net (${baseCurrency})`, 9),
    size: 9, font: ctx.bold, color: MUTED,
  });
  drawText(ctx, `VAT (${baseCurrency})`, {
    x: xVatRight - ctx.bold.widthOfTextAtSize(`VAT (${baseCurrency})`, 9),
    size: 9, font: ctx.bold, color: MUTED,
  });
  drawText(ctx, `Gross (${baseCurrency})`, {
    x: xGrossRight - ctx.bold.widthOfTextAtSize(`Gross (${baseCurrency})`, 9),
    size: 9, font: ctx.bold, color: MUTED,
  });
  ctx.y -= 12;

  for (const r of rows) {
    ensureSpace(ctx, 14);
    drawText(ctx, `${r.rate}%`, { x: xRate, size: 9, font: ctx.font });
    const net = major(r.netMinor);
    drawText(ctx, net, {
      x: xNetRight - ctx.font.widthOfTextAtSize(net, 9),
      size: 9, font: ctx.font,
    });
    const vat = major(r.vatMinor);
    drawText(ctx, vat, {
      x: xVatRight - ctx.font.widthOfTextAtSize(vat, 9),
      size: 9, font: ctx.font,
    });
    const gross = major(r.grossMinor);
    drawText(ctx, gross, {
      x: xGrossRight - ctx.font.widthOfTextAtSize(gross, 9),
      size: 9, font: ctx.font,
    });
    ctx.y -= 13;
  }
  ctx.y -= 10;
}

function drawCategorySection(
  ctx: Ctx,
  title: string,
  rows: VatReport["output"]["byCategory"],
  baseCurrency: string,
): void {
  ensureSpace(ctx, 60);
  drawText(ctx, title, { x: MARGIN, size: 11, font: ctx.bold });
  ctx.y -= 14;
  rule(ctx.page, ctx.y);
  ctx.y -= 12;

  if (rows.length === 0) {
    drawText(ctx, "Nothing in this period.", { x: MARGIN, size: 9, font: ctx.font, color: MUTED });
    ctx.y -= 18;
    return;
  }

  const xCat = MARGIN;
  const xNetRight = MARGIN + 320;
  const xVatRight = PAGE_W - MARGIN;

  drawText(ctx, "Category", { x: xCat, size: 9, font: ctx.bold, color: MUTED });
  drawText(ctx, `Net (${baseCurrency})`, {
    x: xNetRight - ctx.bold.widthOfTextAtSize(`Net (${baseCurrency})`, 9),
    size: 9, font: ctx.bold, color: MUTED,
  });
  drawText(ctx, `VAT (${baseCurrency})`, {
    x: xVatRight - ctx.bold.widthOfTextAtSize(`VAT (${baseCurrency})`, 9),
    size: 9, font: ctx.bold, color: MUTED,
  });
  ctx.y -= 12;

  for (const r of rows) {
    ensureSpace(ctx, 14);
    drawText(ctx, r.category, { x: xCat, size: 9, font: ctx.font });
    const net = major(r.netMinor);
    drawText(ctx, net, {
      x: xNetRight - ctx.font.widthOfTextAtSize(net, 9),
      size: 9, font: ctx.font,
    });
    const vat = major(r.vatMinor);
    drawText(ctx, vat, {
      x: xVatRight - ctx.font.widthOfTextAtSize(vat, 9),
      size: 9, font: ctx.font,
    });
    ctx.y -= 13;
  }
  ctx.y -= 10;
}
