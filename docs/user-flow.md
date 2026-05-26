# User Flow

The main journeys a user takes through Multi-Currency. Each flow lists the
steps and the screens involved.

## 1. First-time setup

1. User lands on the marketing page and clicks Sign up.
2. User enters email, password, and selects a **base currency** from
   an ISO 4217 list (AED suggested by default; user can pick USD, GBP,
   EUR, SAR, INR, etc.).
3. User submits the form.
4. System creates the account with the chosen base currency and signs
   the user in.
5. User is taken to an empty dashboard with a prompt to add a first
   entry.
6. (Optional) User sets budgets for a few categories. Budget limits
   are entered in the user's base currency.

## 2. Recording an expense

1. From the dashboard, user opens the Add Entry form.
2. User selects type "Expense".
3. User enters the amount and selects a payment method.
4. User types a note. The system suggests a category from the note.
5. User accepts the suggested category or picks another.
6. User submits the form.
7. The dashboard totals and category breakdown update immediately.
8. If the entry pushes a category near or over its budget, a warning
   appears.

## 3. Recording income

1. From the dashboard, user opens the Add Entry form.
2. User selects type "Income".
3. User enters the amount, source category, and a note.
4. User submits.
5. The monthly income total and balance update.

## 4. Recording a foreign-currency expense

1. User opens the Add Entry form.
2. User selects a currency other than their base currency.
3. The system fetches the current exchange rate to the user's base
   currency.
4. User enters the amount in the foreign currency.
5. On submit, the system stores the amount, the currency, and the
   `rateToBase` captured at entry time.
6. Dashboard totals show the converted value in the user's base
   currency.

## 5. Setting and hitting a budget

1. User opens the Budgets screen.
2. User picks a category and sets a monthly limit.
3. User saves the budget.
4. As the user records expenses in that category through the month,
   the category bar fills.
5. At the warning threshold, a "near limit" warning appears on the
   dashboard.
6. At or past the limit, an "over budget" alert appears.

## 6. Exporting monthly records

1. User opens the Reports or Export screen.
2. User selects a month.
3. User chooses CSV or PDF.
4. The system generates the file with all transactions and VAT fields
   for that month.
5. User downloads the file and sends it to their accountant.

## 7. Editing or deleting a transaction

1. User opens Recent Activity or the transaction list.
2. User selects a transaction.
3. User edits a field and saves, or deletes the transaction.
4. Dashboard totals and budgets recalculate.

## 8. Attaching a receipt (later phase)

1. While recording or editing an expense, user uploads a receipt photo.
2. The system runs OCR and pre-fills amount and merchant.
3. User reviews the pre-filled values and corrects if needed.
4. User saves; the receipt image is stored with the transaction.

## Error and edge cases

- Submitting the form with a zero or empty amount is rejected with an
  inline message.
- If the exchange-rate lookup fails, the user can enter the rate
  manually.
- If AI categorization fails, the user simply picks a category by hand;
  the flow is never blocked.
- A signed-out user trying to reach the dashboard is redirected to
  sign in.
