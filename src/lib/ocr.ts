// Receipt OCR helper — wraps AWS Textract AnalyzeExpense (Phase 4, FR-26).
//
// Server-side only. AWS_ACCESS_KEY_ID/SECRET are never exposed to the browser.
// AnalyzeExpense is purpose-built for receipts/invoices and returns named
// SummaryFields we can map cleanly to our transaction shape.
//
// All failures resolve to empty fields, never throw, because the entry flow
// must keep working even when OCR is unavailable (CLAUDE.md "Categorization
// is server-side and rate-limited" — same principle applies here).

import {
  TextractClient,
  AnalyzeExpenseCommand,
  type ExpenseField,
} from "@aws-sdk/client-textract";
import { isSupportedCurrency } from "@/lib/currencies";
import { logger } from "@/lib/logger";

/** Fields we try to extract. Anything missing stays undefined. */
export interface ReceiptExtraction {
  /** Total in integer minor units (×100) — see currencies.ts money model. */
  amountMinor?: number;
  /** ISO 4217 currency code if Textract identified one and we support it. */
  currency?: string;
  /** Vendor/merchant name — usually maps to the transaction note. */
  merchant?: string;
  /** ISO date (YYYY-MM-DD) parsed from INVOICE_RECEIPT_DATE if present. */
  occurredAt?: string;
}

let cachedClient: TextractClient | null = null;

function getClient(): TextractClient {
  if (cachedClient) return cachedClient;
  const region = process.env.AWS_REGION || "me-central-1";
  cachedClient = new TextractClient({ region });
  return cachedClient;
}

/** Map of summary-field type → field, picking the first occurrence. */
function indexSummaryFields(fields: ExpenseField[]): Map<string, ExpenseField> {
  const out = new Map<string, ExpenseField>();
  for (const f of fields) {
    const type = f.Type?.Text;
    if (typeof type === "string" && !out.has(type)) {
      out.set(type, f);
    }
  }
  return out;
}

/**
 * Strip currency symbols and group separators, parse to a major-unit float,
 * then convert to integer minor units. Returns undefined on anything weird.
 */
function parseAmountMinor(raw: string): number | undefined {
  // Drop common currency symbols/letters and whitespace.
  const cleaned = raw.replace(/[^0-9.,-]/g, "").trim();
  if (cleaned.length === 0) return undefined;

  // Heuristic: if the string has both `,` and `.`, the last one is the decimal.
  // If only `,`, treat it as the decimal (European style). Otherwise plain parse.
  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    const lastDot = cleaned.lastIndexOf(".");
    const lastComma = cleaned.lastIndexOf(",");
    const decimalSep = lastDot > lastComma ? "." : ",";
    const thousandsSep = decimalSep === "." ? "," : ".";
    normalized = cleaned.split(thousandsSep).join("");
    if (decimalSep === ",") normalized = normalized.replace(",", ".");
  } else if (cleaned.includes(",") && !cleaned.includes(".")) {
    // Treat comma as decimal only if it looks like one (≤ 2 digits after).
    const idx = cleaned.lastIndexOf(",");
    if (cleaned.length - idx - 1 <= 2) {
      normalized = cleaned.replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  }

  const value = parseFloat(normalized);
  if (!isFinite(value) || value <= 0) return undefined;
  return Math.round(value * 100);
}

/**
 * Pick a 3-letter ISO 4217 code if Textract's currency hint resolves to one we
 * support. Textract may also embed symbols (AED, $, د.إ) — we only commit
 * when there is an unambiguous ISO code.
 */
function parseCurrency(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const match = raw.toUpperCase().match(/[A-Z]{3}/);
  if (!match) return undefined;
  const code = match[0];
  return isSupportedCurrency(code) ? code : undefined;
}

/**
 * Normalize a receipt date to YYYY-MM-DD. Returns undefined if we can't
 * confidently parse it — the form will keep its default of "today".
 */
function parseDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

function getFieldValue(f: ExpenseField | undefined): string | undefined {
  const text = f?.ValueDetection?.Text?.trim();
  return text && text.length > 0 ? text : undefined;
}

/**
 * Run Textract AnalyzeExpense on the receipt bytes and return whatever we
 * could extract. Always resolves — errors are logged and produce {}.
 */
export async function extractReceipt(
  bytes: Buffer,
): Promise<ReceiptExtraction> {
  try {
    const client = getClient();
    const response = await client.send(
      new AnalyzeExpenseCommand({ Document: { Bytes: bytes } }),
    );

    const summary = response.ExpenseDocuments?.[0]?.SummaryFields ?? [];
    if (summary.length === 0) return {};

    const byType = indexSummaryFields(summary);
    // AnalyzeExpense exposes TOTAL most reliably; fall back to AMOUNT_PAID.
    const totalField = byType.get("TOTAL") ?? byType.get("AMOUNT_PAID");
    const vendorField = byType.get("VENDOR_NAME");
    const dateField = byType.get("INVOICE_RECEIPT_DATE");

    const totalText = getFieldValue(totalField);
    const amountMinor = totalText ? parseAmountMinor(totalText) : undefined;

    // Currency hint can come from the TOTAL field's Currency.Code, or from the
    // raw text of the total (e.g. "AED 124.50").
    const currencyHint =
      totalField?.Currency?.Code ??
      (totalText ? totalText : undefined);
    const currency = parseCurrency(currencyHint ?? undefined);

    const merchant = getFieldValue(vendorField);
    const occurredAt = parseDate(getFieldValue(dateField));

    return {
      ...(amountMinor !== undefined && { amountMinor }),
      ...(currency !== undefined && { currency }),
      ...(merchant !== undefined && { merchant }),
      ...(occurredAt !== undefined && { occurredAt }),
    };
  } catch (err) {
    logger.error("Textract AnalyzeExpense failed", { err });
    return {};
  }
}
