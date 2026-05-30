# API Structure

REST-style API routes for Multi-Currency, implemented as Next.js App Router
route handlers under `src/app/api/`.

## Conventions

- All amounts in requests and responses are in minor units (fils).
- All routes require an authenticated session except where noted.
- Routes resolve the current user from the session, never from a
  client-supplied user ID.
- Errors return a JSON body `{ "error": "message" }` with an
  appropriate HTTP status.
- Successful creation returns HTTP 201; other success returns 200.

## Status codes

| Code | Meaning                                  |
|------|------------------------------------------|
| 200  | Success                                  |
| 201  | Resource created                         |
| 400  | Invalid or missing input                 |
| 401  | Not authenticated                        |
| 403  | Authenticated but not allowed            |
| 404  | Resource not found                       |
| 429  | Rate limit exceeded                      |
| 500  | Server error                             |

## Endpoints

### Transactions

#### GET /api/expenses

List transactions, most recent first, limit 500.

Query parameters (optional):

- `from` — ISO date; include transactions on or after this date.
- `to` — ISO date; include transactions on or before this date.

Response 200:

```
{ "items": [ { ...transaction }, ... ] }
```

#### POST /api/expenses

Create one transaction.

Request body:

```
{
  "type": "expense",
  "amountMinor": 5025,
  "currency": "AED",
  "rateToBase": 1,
  "category": "Transport",
  "paymentMethod": "card",
  "note": "Careem to DIFC",
  "isVatable": false,
  "vatRate": 0,
  "categorySource": "manual",
  "occurredAt": "2026-05-24T10:00:00Z"
}
```

`amountMinor` and `category` are required. Response 201 with the
created record.

#### GET /api/expenses/:id

Fetch one transaction owned by the current user. Response 200, or 404
if not found.

#### PATCH /api/expenses/:id

Update fields of a transaction. Request body contains only the fields
to change. Response 200 with the updated record.

#### DELETE /api/expenses/:id

Delete a transaction. Response 200 with `{ "deleted": true }`.

### Dashboard

#### GET /api/dashboard

Aggregated totals for the current day, week, and month, plus a
per-category breakdown and budget warnings.

Response 200:

```
{
  "totals": {
    "expenseToday": 0,
    "expenseWeek": 0,
    "expenseMonth": 0,
    "incomeMonth": 0,
    "balanceMonth": 0
  },
  "byCategory": [ { "category": "Transport", "spent": 3400 } ],
  "warnings": [ { "category": "Transport", "level": "over", "percent": 112 } ]
}
```

### Budgets

#### GET /api/budgets

List the current user's budgets.

#### POST /api/budgets

Create a budget. Body: `category`, `limitMinorBase` (in minor units of
the user's base currency), optional `warnAtPercent`. Fails with 400 if
a budget for that category already exists.

#### PATCH /api/budgets/:id

Update a budget's limit or warning threshold.

#### DELETE /api/budgets/:id

Remove a budget.

### Categorization

#### POST /api/categorize

Suggest a category for a transaction note.

Request body:

```
{ "note": "Careem ride to client meeting", "merchant": "" }
```

Response 200:

```
{ "category": "Transport", "confidence": "high" }
```

This route calls the AI provider server-side and is rate-limited.

### Receipts

#### POST /api/receipts/upload

Upload a receipt image or PDF (FR-25). Multipart form data with a single
`file` field. Allowed types: `image/jpeg`, `image/png`, `image/webp`,
`application/pdf`. Maximum size 5 MB.

Response 201:

```
{ "url": "https://res.cloudinary.com/<cloud>/.../receipt.jpg" }
```

The returned URL is what should be persisted to `transactions.receiptUrl` on
the next `POST /api/expenses` or `PATCH /api/expenses/:id` call. Rate-limited
per user.

#### POST /api/receipts/ocr

Extract amount/merchant/date from a previously uploaded receipt (FR-26).

Request body:

```
{ "receiptUrl": "https://res.cloudinary.com/<cloud>/.../receipt.jpg" }
```

The URL must point at our Cloudinary host — arbitrary URLs are rejected to
prevent server-side request forgery.

Response 200 (fields are individually optional — anything Textract couldn't
extract is omitted):

```
{
  "amountMinor": 12450,
  "currency": "AED",
  "merchant": "Carrefour",
  "occurredAt": "2026-05-24"
}
```

OCR failure resolves to `{}` rather than an error — the entry form must keep
working when OCR is unavailable. Rate-limited per user (tighter than upload,
since each call has a Textract per-page cost).

### Export (later phase)

#### GET /api/export?month=YYYY-MM&format=csv|pdf

Generate a downloadable monthly report. Returns the file with the
appropriate content type.

### Auth (later phase)

Authentication routes are provided by NextAuth under
`/api/auth/...` and are not hand-written.

## Route file layout

```
src/app/api/
  expenses/route.ts          — GET list, POST create
  expenses/[id]/route.ts     — GET, PATCH, DELETE one
  dashboard/route.ts         — GET aggregated dashboard
  budgets/route.ts           — GET list, POST create
  budgets/[id]/route.ts      — PATCH, DELETE one
  categorize/route.ts        — POST suggest category
  receipts/upload/route.ts   — POST upload receipt (Cloudinary)
  receipts/ocr/route.ts      — POST OCR receipt (Textract)
  export/route.ts            — GET monthly export
  auth/[...nextauth]/route.ts — NextAuth handler
```
