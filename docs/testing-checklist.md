# Testing Checklist

Checks to run before each release. Group items by area; mark each as
passing before deploying to production.

## Authentication (phase 2)

- A new user can sign up with a valid email and password.
- Sign up rejects an email that is already registered.
- A user can sign in with correct credentials.
- Sign in rejects wrong credentials.
- A user can sign out.
- A signed-out user is redirected away from the dashboard.
- Password reset by email works end to end.

## Data isolation

- A user cannot read another user's transactions.
- A user cannot edit or delete another user's transactions.
- A user cannot read or modify another user's budgets.
- API routes ignore any client-supplied user ID.

## Transaction entry

- An expense can be created with all fields.
- Income can be created with all fields.
- The form rejects a zero or empty amount.
- The form rejects a negative amount.
- A transaction can be edited and the change persists.
- A transaction can be deleted.
- A note over the length limit is rejected.

## Money and currency

- An amount entered as 50.25 is stored as 5025 minor units.
- Displayed amounts divide minor units by 100 correctly.
- Signup persists the user's chosen base currency (`users.baseCurrency`).
- A foreign-currency transaction stores its `rateToBase` at entry time.
- Dashboard totals are correct in the user's base currency across
  mixed input currencies.
- Two users with different base currencies see the same transactions
  aggregated independently in each user's own base.
- No rounding error appears after many transactions.

## Totals and dashboard

- The daily total includes only today's expenses.
- The weekly total includes only the current week.
- The monthly total includes only the current month.
- The balance equals monthly income minus monthly expense.
- The category breakdown sums match the monthly expense total.
- The dashboard loads in under one second for a typical dataset.

## Budgets

- A budget can be created for a category.
- A second budget for the same category is rejected.
- A budget can be edited and removed.
- A "near limit" warning appears at the warning threshold.
- An "over budget" alert appears at or past the limit.
- Removing a budget clears its warnings.

## AI categorization

- Entering a note produces a category suggestion.
- The user can override the suggested category.
- The category source is recorded correctly.
- If the AI call fails, the user can still pick a category manually
  and submit.
- The categorize route is rate-limited.

## Export (phase 2)

- A CSV export contains all transactions for the selected month.
- A PDF export contains the same data and is readable.
- Exports include VAT fields.
- An export for a month with no data produces a valid empty file.

## Receipts (phase 4)

- A receipt photo can be uploaded and is stored with the transaction.
- OCR pre-fills amount and merchant.
- The user can correct OCR results before saving.

## Security and validation

- API routes reject malformed JSON.
- API routes reject missing required fields.
- Secrets are not present in any client-side bundle.
- Rate limiting blocks excessive requests.

## Cross-device

- The interface is usable on a phone screen.
- The interface is usable on a desktop screen.
- Forms and buttons work with touch and with mouse.

## Pre-release

- All of the above relevant to the current phase pass.
- The changelog is updated.
- Environment variables are set in the deployment target.
- A previous working deployment is available for rollback.
