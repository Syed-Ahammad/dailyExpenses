# Requirements

Functional and non-functional requirements for Multi-Currency. Each functional
requirement has an ID (FR-n) for reference in other documents.

## Functional requirements

### Accounts and authentication

- FR-1: A user can sign up with an email, password, and **base
  currency** (ISO 4217 code, e.g. `AED`, `USD`, `GBP`).
- FR-2: A user can sign in and sign out.
- FR-3: All data is scoped to the signed-in user; no user can read or
  modify another user's data.
- FR-4: A user can reset a forgotten password by email.

### Transaction entry

- FR-5: A user can record an expense with amount, category, note,
  payment method, and date.
- FR-6: A user can record income with the same fields.
- FR-7: A user can edit a transaction they created.
- FR-8: A user can delete a transaction they created.
- FR-9: A user can record a transaction in any currency. If the
  transaction currency differs from the user's base currency, the
  system stores the exchange rate **at entry time** (`rateToBase`).

### Totals and dashboard

- FR-10: The system shows the total expense for the current day,
  current week, and current month.
- FR-11: The system shows total income for the current month.
- FR-12: The system shows the balance (income minus expense) for the
  current month.
- FR-13: The system shows a per-category breakdown of spending for the
  current month.
- FR-14: All totals are aggregated in the **user's base currency**
  (`users.baseCurrency`) regardless of the original transaction
  currency, using each transaction's stored `rateToBase`.

### Budgets

- FR-15: A user can set a monthly spending limit for a category.
- FR-16: A user can edit or remove a category's budget.
- FR-17: The system shows a warning when category spending reaches a
  configurable threshold (default 80 percent) of its limit.
- FR-18: The system shows an over-limit alert when category spending
  meets or exceeds its limit.

### AI categorization

- FR-19: When a user enters a transaction note, the system can suggest
  a category from a fixed category list.
- FR-20: The user can accept or override the suggested category.
- FR-21: The system records whether a category was set manually,
  AI-suggested, or AI-suggested and then confirmed.

### Export and reporting

- FR-22: A user can export a month's transactions to CSV.
- FR-23: A user can export a month's transactions to PDF.
- FR-24: Exports include VAT-relevant fields so the output is usable
  by an accountant.

### Receipts (later phase)

- FR-25: A user can attach a receipt photo to a transaction.
- FR-26: The system can extract amount and merchant from a receipt
  photo using OCR.

### Billing (later phase)

- FR-27: A user can subscribe to a paid plan.
- FR-28: The system restricts higher-tier features to subscribers on
  the relevant plan.

## Non-functional requirements

- NFR-1: Money is stored as integers in minor units (fils) to avoid
  floating-point rounding errors.
- NFR-2: Dashboard data loads in under one second for a typical user
  (a few thousand transactions).
- NFR-3: The interface is responsive and usable on a phone.
- NFR-4: API routes validate all input and reject malformed payloads.
- NFR-5: API routes are rate-limited, especially those calling the
  AI provider.
- NFR-6: Secrets (database URI, API keys) are never exposed to the
  browser.
- NFR-7: The database is backed up regularly.
- NFR-8: Production errors are captured by an error-tracking service.

## Constraints

- Single full-time developer.
- Each user has one base currency (selected at signup).
- UAE tax context only at launch for VAT/FTA features.
- Managed hosting (Vercel, MongoDB Atlas).
