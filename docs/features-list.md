# Features List

All features, grouped by build phase, with current status.
Status values: Done, In progress, Planned.

## Phase 1 — Core loop

| Feature                              | Status      | Requirement |
|--------------------------------------|-------------|-------------|
| Expense entry                        | Done        | FR-5        |
| Income entry                         | Done        | FR-6        |
| Daily / weekly / monthly totals      | Done        | FR-10, FR-11|
| Income vs expense balance            | Done        | FR-12       |
| Per-category breakdown               | Done        | FR-13       |
| Multi-Currency aggregation across currencies    | Done        | FR-14       |
| Standalone HTML preview              | Done        | —           |

## Phase 2 — Accounts and records

| Feature                              | Status      | Requirement |
|--------------------------------------|-------------|-------------|
| Sign up / sign in / sign out         | Done        | FR-1, FR-2  |
| Per-user data scoping                | Done        | FR-3        |
| Password reset                       | Planned     | FR-4        |
| Edit transaction                     | Done        | FR-7        |
| Delete transaction                   | Done        | FR-8        |
| Budget create / edit / remove        | Done        | FR-15, FR-16|
| Budget warning at threshold          | Done        | FR-17       |
| Over-limit alert                     | Done        | FR-18       |
| CSV export                           | Planned     | FR-22       |
| PDF export                           | Planned     | FR-23       |

## Phase 3 — Currency and AI

| Feature                              | Status      | Requirement |
|--------------------------------------|-------------|-------------|
| Multi-currency entry with live rates | Planned     | FR-9        |
| AI category suggestion in the form   | Planned     | FR-19, FR-20|
| Category source tracking             | Planned     | FR-21       |

## Phase 4 — Receipts (paid add-on)

| Feature                              | Status      | Requirement |
|--------------------------------------|-------------|-------------|
| Receipt photo upload                 | Planned     | FR-25       |
| OCR extraction of amount / merchant  | Planned     | FR-26       |

## Phase 5 — VAT reporting and billing

| Feature                              | Status      | Requirement |
|--------------------------------------|-------------|-------------|
| VAT-aware monthly report             | Planned     | FR-24       |
| Subscription plans                   | Planned     | FR-27       |
| Plan-based feature gating            | Planned     | FR-28       |

## Notes

- VAT reporting is the primary monetizable feature. It is scheduled in
  phase 5 but should be brought forward if paying users ask for it.
- Receipt OCR is positioned as a higher-tier feature, not a free one.
