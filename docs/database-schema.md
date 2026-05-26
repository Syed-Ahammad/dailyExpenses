# Database Schema

MongoDB collections for Multi-Currency, modeled with Mongoose.

## Conventions

- Money is stored as integers in minor units. For AED, 1 = 100 fils;
  for USD, 1 = 100 cents; the same factor of 100 applies to most
  currencies. A value of `5025` means 50.25 units of whatever currency
  is on the field.
- Every user-owned document has a `userId` field and is indexed on it.
- Timestamps (`createdAt`, `updatedAt`) are added automatically.
- Each user picks their **base currency** (`users.baseCurrency`) at
  signup. All aggregated totals are reported in that currency.

## Collection: users

Managed by the authentication layer (NextAuth with a database adapter).

| Field          | Type   | Notes                                          |
|----------------|--------|------------------------------------------------|
| `_id`          | ObjectId | Primary key                                  |
| `email`        | String | Unique, lowercased                             |
| `passwordHash` | String | bcryptjs hash; never stored in plain text      |
| `name`         | String | Optional display name                          |
| `baseCurrency` | String | ISO 4217 (e.g. `AED`, `USD`, `GBP`). Required. |
| `createdAt`    | Date   | Account creation time                          |

## Collection: transactions

One document per expense or income entry.

| Field            | Type    | Required | Notes                                  |
|------------------|---------|----------|----------------------------------------|
| `_id`            | ObjectId| yes      | Primary key                            |
| `userId`         | String  | yes      | Owner; indexed                         |
| `type`           | String  | yes      | `expense` or `income`                  |
| `amountMinor`    | Number  | yes      | Amount in minor units (fils), >= 0     |
| `currency`       | String  | yes      | ISO 4217 code (e.g. `AED`, `USD`)      |
| `rateToBase`     | Number  | yes      | Exchange rate to the user's base currency at entry time |
| `category`       | String  | yes      | Spending/earning category              |
| `paymentMethod`  | String  | no       | cash, card, bank_transfer, wallet, cheque, other |
| `note`           | String  | no       | Free text, max 500 chars               |
| `isVatable`      | Boolean | no       | Whether VAT applies; default false     |
| `vatRate`        | Number  | no       | VAT percentage, e.g. 5                 |
| `categorySource` | String  | no       | manual, ai_suggested, ai_confirmed     |
| `receiptUrl`     | String  | no       | Stored receipt image (later phase)     |
| `occurredAt`     | Date    | yes      | When the transaction happened          |
| `createdAt`      | Date    | auto     | Record creation time                   |
| `updatedAt`      | Date    | auto     | Last modification time                 |

Indexes:

- `userId` (single field)
- `userId + occurredAt` descending (dashboard date-range queries)

Derived value: amount in the user's base currency =
`amountMinor * rateToBase`. The rate is the one captured **at entry
time** — never re-fetch a historical rate to recompute past totals.

## Collection: budgets

One document per category per user.

| Field            | Type    | Required | Notes                                  |
|------------------|---------|----------|----------------------------------------|
| `_id`            | ObjectId| yes      | Primary key                            |
| `userId`         | String  | yes      | Owner; indexed                         |
| `category`       | String  | yes      | Category the limit applies to          |
| `limitMinorBase` | Number  | yes      | Monthly cap in minor units of the user's base currency |
| `warnAtPercent`  | Number  | no       | Warning threshold; default 80          |
| `createdAt`      | Date    | auto     | Record creation time                   |
| `updatedAt`      | Date    | auto     | Last modification time                 |

Indexes:

- `userId + category` unique (one budget per category per user)

## Collection: subscriptions (later phase)

Tracks a user's paid plan.

| Field            | Type    | Notes                                   |
|------------------|---------|------------------------------------------|
| `_id`            | ObjectId| Primary key                             |
| `userId`         | String  | Owner; indexed                          |
| `plan`           | String  | e.g. free, standard, pro                |
| `status`         | String  | active, past_due, cancelled             |
| `providerId`     | String  | ID from the billing provider            |
| `currentPeriodEnd`| Date   | When the current paid period ends       |

## Relationships

- A user has many transactions.
- A user has many budgets (at most one per category).
- A user has at most one active subscription.
- A budget relates to transactions by matching `userId` and `category`;
  there is no hard foreign key. Budget-versus-spend comparison is done
  by aggregation at query time.

## Entity diagram (text)

```
users (1) ──< (many) transactions
users (1) ──< (many) budgets
users (1) ──< (0..1) subscriptions

budgets.category  ⇄  transactions.category   (compared at query time)
```
