// VAT report helpers (Phase 5, FR-29).
//
// Parses report periods ("YYYY-Qn" or "YYYY-MM") into UTC date ranges and
// aggregates a user's transactions into the totals an accountant needs:
// output VAT (collected on income), input VAT (paid on expenses), and the
// net VAT due. All money math runs on integer minor units (NFR-1); the
// caller converts to a display string only at the UI/file edge.
//
// Assumption: transaction amounts are VAT-INCLUSIVE. A user typing "105"
// for a 5% VAT row records 100 net + 5 VAT, not 105 net + 5.25 VAT. This is
// how amounts look on UAE receipts and on most issued invoices. If we add
// an explicit "amount excludes VAT" flag later, this is the place to branch.

export interface PeriodRange {
  /** ISO start (UTC, inclusive). */
  start: Date;
  /** ISO end (UTC, exclusive). */
  end: Date;
  /** Period label normalised back from the parsed shape. */
  label: string;
  /** "quarter" for YYYY-Qn, "month" for YYYY-MM. */
  kind: "quarter" | "month";
}

/**
 * Parse "YYYY-MM" or "YYYY-Qn" into a half-open UTC range. Returns null for
 * malformed input so the route can reject with 400 instead of 500.
 */
export function parsePeriod(period: string): PeriodRange | null {
  const trimmed = period.trim().toUpperCase();

  const quarter = /^(\d{4})-Q([1-4])$/.exec(trimmed);
  if (quarter) {
    const year = Number(quarter[1]);
    const q = Number(quarter[2]);
    const startMonth = (q - 1) * 3; // Q1 → 0 (Jan), Q2 → 3 (Apr), etc.
    return {
      start: new Date(Date.UTC(year, startMonth, 1)),
      end: new Date(Date.UTC(year, startMonth + 3, 1)),
      label: `${year}-Q${q}`,
      kind: "quarter",
    };
  }

  const month = /^(\d{4})-(\d{2})$/.exec(trimmed);
  if (month) {
    const year = Number(month[1]);
    const m = Number(month[2]);
    if (m < 1 || m > 12) return null;
    return {
      start: new Date(Date.UTC(year, m - 1, 1)),
      end: new Date(Date.UTC(year, m, 1)),
      label: `${year}-${String(m).padStart(2, "0")}`,
      kind: "month",
    };
  }

  return null;
}

/** Current quarter in YYYY-Qn (UTC) — used as the default in the picker. */
export function currentQuarter(): string {
  const now = new Date();
  const q = Math.floor(now.getUTCMonth() / 3) + 1;
  return `${now.getUTCFullYear()}-Q${q}`;
}

/** Minimum transaction shape the aggregation needs (mirrors lean Mongo docs). */
export interface VatTransaction {
  type: "expense" | "income";
  amountMinor: number;
  rateToBase: number;
  category: string;
  isVatable?: boolean;
  vatRate?: number;
  occurredAt: Date | string;
}

export interface RateBreakdown {
  /** VAT percentage (e.g. 5). */
  rate: number;
  /** Net (taxable base) in base-currency minor units. */
  netMinor: number;
  /** VAT portion in base-currency minor units. */
  vatMinor: number;
  /** Gross (net + VAT) in base-currency minor units. */
  grossMinor: number;
}

export interface CategoryBreakdown {
  category: string;
  netMinor: number;
  vatMinor: number;
}

export interface VatTotals {
  /** Sum of input/output across all rates, in base-currency minor units. */
  vatMinor: number;
  /** Sum of net (taxable base) across all rates. */
  netMinor: number;
  /** Sum of gross (net + VAT). */
  grossMinor: number;
  /** Per-rate split — handy for an accountant filing FTA returns. */
  byRate: RateBreakdown[];
  /** Per-category split, for the user's own review (not a filing field). */
  byCategory: CategoryBreakdown[];
}

export interface VatReport {
  period: string;
  kind: "quarter" | "month";
  /** Inclusive start ISO date (YYYY-MM-DD). */
  from: string;
  /** Exclusive end ISO date (YYYY-MM-DD). */
  to: string;
  baseCurrency: string;
  /** VAT collected on income — what the user owes the tax authority. */
  output: VatTotals;
  /** VAT paid on expenses — what the user can reclaim. */
  input: VatTotals;
  /** Output − Input, in base-currency minor units. Positive = owed. */
  netVatMinor: number;
}

/**
 * Split a VAT-inclusive amount into net + VAT, both in minor units.
 * Rounding once at the boundary keeps `net + vat === gross` for whole-rupee
 * use, with tiny rounding leftover assigned to VAT (the conservative side
 * for an accountant).
 */
function splitInclusive(grossMinor: number, ratePct: number) {
  if (ratePct <= 0) {
    return { netMinor: grossMinor, vatMinor: 0 };
  }
  const vat = Math.round((grossMinor * ratePct) / (100 + ratePct));
  return { netMinor: grossMinor - vat, vatMinor: vat };
}

interface RateAcc {
  netMinor: number;
  vatMinor: number;
  grossMinor: number;
}
interface CatAcc {
  netMinor: number;
  vatMinor: number;
}

function emptyTotals(): VatTotals {
  return {
    vatMinor: 0,
    netMinor: 0,
    grossMinor: 0,
    byRate: [],
    byCategory: [],
  };
}

/**
 * Build the VAT report for a user's transactions within a period. Only
 * VAT-flagged rows contribute; non-VATable transactions are ignored entirely
 * (they don't show in input/output totals or in the breakdowns).
 */
export function buildVatReport(
  txs: VatTransaction[],
  range: PeriodRange,
  baseCurrency: string,
): VatReport {
  const out = emptyTotals();
  const inp = emptyTotals();
  const outByRate = new Map<number, RateAcc>();
  const inpByRate = new Map<number, RateAcc>();
  const outByCat = new Map<string, CatAcc>();
  const inpByCat = new Map<string, CatAcc>();

  for (const tx of txs) {
    if (!tx.isVatable) continue;
    const rate = typeof tx.vatRate === "number" ? tx.vatRate : 0;

    const grossBaseMinor = Math.round(tx.amountMinor * tx.rateToBase);
    const { netMinor, vatMinor } = splitInclusive(grossBaseMinor, rate);

    const totals = tx.type === "income" ? out : inp;
    const byRate = tx.type === "income" ? outByRate : inpByRate;
    const byCat = tx.type === "income" ? outByCat : inpByCat;

    totals.vatMinor += vatMinor;
    totals.netMinor += netMinor;
    totals.grossMinor += grossBaseMinor;

    const ra = byRate.get(rate) ?? { netMinor: 0, vatMinor: 0, grossMinor: 0 };
    ra.netMinor += netMinor;
    ra.vatMinor += vatMinor;
    ra.grossMinor += grossBaseMinor;
    byRate.set(rate, ra);

    const ca = byCat.get(tx.category) ?? { netMinor: 0, vatMinor: 0 };
    ca.netMinor += netMinor;
    ca.vatMinor += vatMinor;
    byCat.set(tx.category, ca);
  }

  out.byRate = sortedRates(outByRate);
  inp.byRate = sortedRates(inpByRate);
  out.byCategory = sortedCategories(outByCat);
  inp.byCategory = sortedCategories(inpByCat);

  return {
    period: range.label,
    kind: range.kind,
    from: range.start.toISOString().slice(0, 10),
    to: range.end.toISOString().slice(0, 10),
    baseCurrency,
    output: out,
    input: inp,
    netVatMinor: out.vatMinor - inp.vatMinor,
  };
}

function sortedRates(map: Map<number, RateAcc>): RateBreakdown[] {
  return [...map.entries()]
    .map(([rate, v]) => ({ rate, ...v }))
    .sort((a, b) => a.rate - b.rate);
}

function sortedCategories(map: Map<string, CatAcc>): CategoryBreakdown[] {
  return [...map.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.vatMinor - a.vatMinor);
}
