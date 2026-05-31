// Plan definitions and feature-gate helpers (FR-27, FR-28).
//
// Two tiers: "free" (default) and "pro" (Stripe subscription).
// Features are defined as a plain object so UI and routes share the same source.

export type Plan = "free" | "pro";

export interface PlanFeatures {
  receiptOcr: boolean;
  vatExport: boolean; // CSV + PDF downloads of the VAT report
}

export const PLAN_FEATURES: Record<Plan, PlanFeatures> = {
  free: {
    receiptOcr: false,
    vatExport: false,
  },
  pro: {
    receiptOcr: true,
    vatExport: true,
  },
};

export const PLAN_LABELS: Record<Plan, string> = {
  free: "Free",
  pro: "Pro",
};

/** Monthly price displayed in the billing UI (informational; actual price set in Stripe). */
export const PRO_PRICE_DISPLAY = "$9 / month";

/** Human-readable feature list shown in the billing UI. */
export const FREE_FEATURES = [
  "Unlimited transactions",
  "AI category suggestions",
  "Multi-currency entry with live FX rates",
  "Monthly budget limits with alerts",
  "Dashboard totals and per-category breakdown",
  "CSV and PDF monthly export",
  "Receipt photo storage",
  "VAT summary (on-screen)",
  "14-day guest trial (no sign-up required)",
];

export const PRO_FEATURES = [
  "Everything in Free",
  "Receipt OCR — auto-extract amount and merchant",
  "VAT report CSV download (accountant-ready)",
  "VAT report PDF download (accountant-ready)",
];
