/**
 * currencies.ts — Single source of truth for supported currencies.
 *
 * All currencies in this app use ×100 minor units (1 major = 100 minor).
 * This is a known simplification: 0-decimal currencies (e.g. JPY, KRW) would
 * normally use ×1, and 3-decimal currencies (e.g. KWD, BHD, OMR) would use
 * ×1000. The app intentionally keeps the uniform ×100 model to avoid
 * per-currency branching complexity — see docs/database-schema.md "money model".
 *
 * Any currency added here becomes valid in Zod validation (validation.ts),
 * the add-transaction form dropdown, and future FX rate lookups.
 */

/** A supported currency with its ISO 4217 code and English display name. */
export interface Currency {
  code: string;
  name: string;
}

/**
 * Curated list of ~36 major ISO-4217 currencies, sorted alphabetically by code.
 * This is the single source of truth for which currency codes the app accepts.
 *
 * NOTE: All currencies are stored as ×100 minor units regardless of their
 * real-world decimal places (JPY, KRW = 0 decimals; KWD, BHD, OMR = 3 decimals).
 * This is a deliberate simplification — do not add per-currency decimal logic here.
 */
export const CURRENCIES = [
  { code: "AED", name: "UAE Dirham" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "BDT", name: "Bangladeshi Taka" },
  { code: "BHD", name: "Bahraini Dinar" },
  { code: "BRL", name: "Brazilian Real" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "DKK", name: "Danish Krone" },
  { code: "EGP", name: "Egyptian Pound" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound Sterling" },
  { code: "HKD", name: "Hong Kong Dollar" },
  { code: "IDR", name: "Indonesian Rupiah" },
  { code: "INR", name: "Indian Rupee" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "KES", name: "Kenyan Shilling" },
  { code: "KRW", name: "South Korean Won" },
  { code: "KWD", name: "Kuwaiti Dinar" },
  { code: "LKR", name: "Sri Lankan Rupee" },
  { code: "MXN", name: "Mexican Peso" },
  { code: "MYR", name: "Malaysian Ringgit" },
  { code: "NGN", name: "Nigerian Naira" },
  { code: "NOK", name: "Norwegian Krone" },
  { code: "NZD", name: "New Zealand Dollar" },
  { code: "OMR", name: "Omani Rial" },
  { code: "PHP", name: "Philippine Peso" },
  { code: "PKR", name: "Pakistani Rupee" },
  { code: "QAR", name: "Qatari Riyal" },
  { code: "SAR", name: "Saudi Riyal" },
  { code: "SEK", name: "Swedish Krona" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "THB", name: "Thai Baht" },
  { code: "TRY", name: "Turkish Lira" },
  { code: "USD", name: "US Dollar" },
  { code: "ZAR", name: "South African Rand" },
] as const satisfies readonly Currency[];

/** Flat array of supported currency codes derived from CURRENCIES. */
export const CURRENCY_CODES: readonly string[] = CURRENCIES.map((c) => c.code);

/**
 * Returns true if the given string is a supported currency code.
 * Used by Zod validation to reject unknown codes at the API boundary.
 */
export function isSupportedCurrency(code: string): boolean {
  return (CURRENCY_CODES as readonly string[]).includes(code);
}

/**
 * Default base currency used when no per-user base currency is configured.
 * Phase 2: this becomes user.baseCurrency from the auth session.
 */
export const DEFAULT_BASE_CURRENCY = "USD";
