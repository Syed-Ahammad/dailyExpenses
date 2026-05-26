# Project Scope

Defines what the project is, who it serves, and what it deliberately
excludes. This is the reference for deciding whether a new request
belongs in the project.

## Product summary

multi-currency is a subscription-based web application that lets a UAE-based
freelancer or small business record day-to-day expenses and income,
see where money goes, stay within budget, and produce clean, VAT-aware
records for an accountant at tax time.

## Target user

The launch user is a freelancer or small business owner in the UAE who
invoices clients, incurs business expenses across more than one
currency, and has VAT and corporate-tax obligations.

General consumers are out of scope for launch. A pared-down free tier
may serve them later, but no product decision is made for them now.

## Goals

- Make daily expense entry fast enough that users keep it up.
- Give an at-a-glance picture of spending versus income.
- Prevent overspending through per-category budget limits.
- Produce export-ready, VAT-aware monthly records.
- Reduce manual effort over time with AI categorization and OCR.

## In scope

- Expense and income entry (amount, category, note, payment method, date).
- Automatic daily, weekly, and monthly totals.
- Income-versus-expense dashboard with running balance.
- Per-category monthly budget limits with warnings.
- Multi-currency transaction entry; each user selects their own base
  reporting currency at signup (no currency is hardcoded).
- AI-assisted expense categorization.
- CSV and PDF export of monthly records.
- VAT-aware reporting for accountants.
- Receipt photo upload with OCR (later phase, higher tier).
- User accounts, authentication, and subscription billing.

## Out of scope

These are deliberate exclusions, not missing work:

- A consumer-grade personal budgeting product.
- Full double-entry accounting, payroll, or invoicing.
- Direct bank-account or credit-card transaction syncing.
- Filing taxes for the user or giving tax advice.
- A native mobile app at launch (the web app is responsive).
- Tax regimes outside the UAE at launch.

## Success criteria

- Starter phase: a user can record transactions and see correct
  daily, weekly, and monthly totals with a running balance.
- Product: real UAE freelancers use it weekly and some pay for it.

## Assumptions and constraints

- Built and maintained by a solo developer working full-time.
- Hosted on managed services (Vercel, MongoDB Atlas).
- Each user selects their base currency at signup (the AED default is
  suggested for UAE-based users); all reporting is in that currency.
- Revenue is expected to ramp slowly; the roadmap is ordered so a
  usable, launchable product exists early.
