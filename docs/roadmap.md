# Roadmap

The planned path for Multi-Currency, from the current starter kit to a
revenue-generating product. Phases are ordered so a usable product
exists as early as possible.

## Phase 1 — Core loop (complete)

The minimum loop that makes the app usable on its own.

- Expense and income entry.
- Daily, weekly, and monthly totals.
- Income-versus-expense balance.
- Per-category breakdown.

Outcome: a single user can track money and see correct totals.

## Phase 2 — Accounts and records

Make the app real and multi-user, and produce records people can keep.

- NextAuth authentication: sign up, sign in, sign out, password reset.
- Per-user data scoping across every route.
- Edit and delete transactions.
- Budget management UI: create, edit, remove limits.
- Budget warnings and over-limit alerts in the interface.
- CSV and PDF export of monthly records.

Outcome: real users can sign up and export records for an accountant.

## Phase 3 — Currency and AI

Reduce friction and support the multi-currency reality of UAE users.

- Live multi-currency entry with exchange-rate lookup.
- AI categorization wired into the entry form.
- Category-source tracking to measure suggestion quality.

Outcome: faster entry and accurate cross-currency totals.

## Phase 4 — Receipts

A higher-tier feature that removes manual data entry.

- Receipt photo upload.
- OCR extraction of amount and merchant.

Outcome: users can capture expenses by photographing a receipt.

## Phase 5 — VAT reporting and billing

Turn the product into a business.

- VAT-aware monthly reporting suitable for accountants.
- Subscription plans.
- Plan-based feature gating.

Outcome: the product earns recurring revenue, anchored on the VAT
reporting feature.

## Sequencing notes

- VAT reporting is the strongest reason a UAE small business would
  pay. It is placed in phase 5 only because billing and accounts must
  exist first. If paying or near-paying users ask for it, bring it
  forward.
- Receipt OCR has a real running cost per scan; keep it on a paid
  tier rather than a free one.
- Each phase should ship and be shown to real users before the next
  begins. Feedback reorders the backlog within a phase.

## Beyond phase 5 (candidate ideas, not committed)

These are possibilities to weigh later, not commitments:

- A native mobile app.
- Recurring-transaction templates.
- Accountant or multi-user shared access.
- Support for tax regimes beyond the UAE.

## Guiding principle

Ship a usable slice early, get it in front of real UAE freelancers,
and let their feedback — not a fixed plan — drive what comes next.
