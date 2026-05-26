// Canonical category list. Single source of truth for:
//   - Mongoose schemas (Transaction.category validation)
//   - Zod validators (validation.ts)
//   - AI prompt construction (categorize.ts)
//   - Dashboard and report aggregation grouping
//
// Any change here is a breaking schema change for analytics — see docs/categories.md.

export const EXPENSE_CATEGORIES = [
  "Transport",
  "Food & Dining",
  "Office Supplies",
  "Software & Subscriptions",
  "Professional Services",
  "Marketing & Advertising",
  "Rent & Utilities",
  "Phone & Internet",
  "Travel",
  "Equipment",
  "Bank Fees",
  "Government & Visa Fees",
  "Education & Training",
  "Healthcare",
  "Insurance",
  "Entertainment",
  "Other",
] as const;

export const INCOME_CATEGORIES = [
  "Client Invoice",
  "Refund",
  "Interest",
  "Other Income",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];
export type Category = ExpenseCategory | IncomeCategory;

export function isExpenseCategory(value: string): value is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}

export function isIncomeCategory(value: string): value is IncomeCategory {
  return (INCOME_CATEGORIES as readonly string[]).includes(value);
}
