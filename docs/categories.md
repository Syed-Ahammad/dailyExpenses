# Categories

The canonical list of allowed transaction categories. Every place in the
codebase that names a category — Mongoose validation, Zod schemas, the
AI categorization prompt, the dashboard breakdown, monthly reports —
draws from this list.

## Source of truth

The runtime source of truth is **`src/lib/categories.ts`**, which exports:

- `EXPENSE_CATEGORIES` — `as const` tuple of allowed expense categories.
- `INCOME_CATEGORIES` — `as const` tuple of allowed income categories.
- `ExpenseCategory`, `IncomeCategory`, `Category` — derived TypeScript
  union types.
- `isExpenseCategory(value)` / `isIncomeCategory(value)` — type guards.

This document mirrors that file in human-readable form. If the two
disagree, the code is correct and this doc is stale — update the doc.

## Expense categories

| Category                 | Examples                                            |
|--------------------------|-----------------------------------------------------|
| Transport                | Careem, Uber, fuel, parking, Salik                  |
| Food & Dining            | Client lunches, coffee, groceries used for the biz  |
| Office Supplies          | Stationery, printer ink, small fixtures             |
| Software & Subscriptions | SaaS tools, hosting, domain names, AI APIs          |
| Professional Services    | Lawyers, accountants, contractors                   |
| Marketing & Advertising  | Ads, sponsored posts, design work, swag             |
| Rent & Utilities         | Office rent, electricity, water, cooling            |
| Phone & Internet         | Mobile bill, home internet, office internet         |
| Travel                   | Flights, hotels, visas for business travel          |
| Equipment                | Laptops, monitors, cameras — depreciable assets     |
| Bank Fees                | Wire transfer fees, FX margin, card processing      |
| Government & Visa Fees   | Trade licence, FTA fees, visa renewals              |
| Education & Training     | Courses, books, conferences                         |
| Healthcare               | Medical insurance, doctor visits                    |
| Insurance                | Business insurance, professional indemnity          |
| Entertainment            | Client entertainment, team outings                  |
| Other                    | Anything genuinely uncategorisable                  |

## Income categories

| Category        | Examples                                |
|-----------------|-----------------------------------------|
| Client Invoice  | Paid invoice from a client              |
| Refund          | Vendor refund, returned subscription    |
| Interest        | Bank interest                           |
| Other Income    | Anything genuinely uncategorisable      |

## Rules

- **`Other` and `Other Income` are intentional escape hatches.** Users
  who can't find a fit are expected to use them, not to be blocked.
- **The list is fixed per-release.** A new category requires a code
  change (`src/lib/categories.ts`) plus this doc.
- **Changes are breaking.** Renaming `Transport` to `Travel — local`
  invalidates existing transaction documents, the AI prompt's expected
  outputs, dashboard aggregations, and budget rows. Treat any rename as
  a data migration, not a string change.
- **The AI categorize endpoint must constrain its output to this list.**
  See `src/lib/categorize.ts` — the prompt builds the list from
  `EXPENSE_CATEGORIES`, and the response is validated against it before
  being returned.

## Future

If the list grows past ~25 items, consider a two-level scheme
(category → sub-category). This is **not** committed work.
