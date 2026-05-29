# Changelog

All notable changes to Multi-Currency. Newest entries at the top.

Format: each release has a version, a date, and changes grouped as
Added, Changed, Fixed, or Removed. Versions follow semantic versioning
(major.minor.patch).

## [Unreleased]

Work in progress, not yet released.

### Added

- **Rate limiting (NFR-5)** — per-route request caps enforced centrally in
  middleware on `POST`s: sign-in 10/min, sign-up 5/min, reset 5/hour (keyed by
  IP); categorize 20/min, expenses 60/min, budgets 30/min (keyed by userId,
  else IP). Over-limit returns `429 {"error":"rate limit exceeded"}`. Backed by
  Upstash Redis sliding-window when `UPSTASH_REDIS_REST_URL`/`_TOKEN` are set;
  falls back to an in-memory limiter (dev only, warns once) otherwise. Fails
  open if the limiter errors. Reset is keyed by IP only (middleware can't read
  the body for per-email keying).
- **CSV & PDF export (FR-22, FR-23)** — `GET /api/export?month=YYYY-MM&format=csv|pdf`
  downloads a month's transactions. CSV is RFC-4180 escaped; PDF (via `pdf-lib`)
  is a readable report with income/expense/balance totals and a paginated table.
  Both show each row in its original currency and the base-currency equivalent;
  a `/reports` page with a month picker drives both.
- **Authentication (NextAuth v5 Credentials)** — sign up, sign in, sign out
  with bcrypt hashing and 30-day JWT sessions; base currency chosen at
  signup (FR-1, FR-2). `getUserId()` / `getUserBaseCurrency()` now resolve
  the current user from the session — the demo-user seam is gone (FR-3).
  Middleware protects app pages (redirect) and owned API routes (401) and
  adds an Origin/CSRF check; security response headers via `next.config`.
- **Password reset (FR-4)** — `/forgot-password` request + `/reset` confirm
  flow with single-use, 1-hour SHA-256-hashed tokens (enumeration-safe;
  reused/expired/invalid tokens rejected). Emails via Resend, with a
  dev-only fallback that logs the link when `RESEND_API_KEY` is unset.
  (Rate limiting still pending — needs Upstash.)
- Daily Expenses design system applied across the dashboard and budgets UI: warm
  gold-and-green tokens, Fraunces/Spline Sans, mobile-first, reduced-motion.
- Dashboard core loop: expense/income entry form, daily/weekly/monthly
  totals, income-vs-expense balance, and per-category breakdown
  (FR-5, FR-6, FR-10–FR-14).
- Expenses CRUD API plus **edit and delete transactions** inline in the
  dashboard's recent-transactions list (FR-7, FR-8).
- **Budget management UI** at `/budgets`: create / edit / remove limits
  with live current-month usage and near/over-limit alerts
  (FR-15–FR-18); alerts also surface on the dashboard.
- Configurable base currency via the `getUserBaseCurrency()` seam
  (env-driven, default USD) and a 36-currency picker on entry.
- Next.js 14 + TypeScript scaffold with App Router, Tailwind, ESLint.
- Mongoose schemas (`User`, `Transaction`, `Budget`, `Subscription`)
  with indexes on `userId` and `userId + occurredAt desc`.
- **`users.baseCurrency`** — each user picks their reporting currency
  at signup (ISO 4217). No currency is hardcoded as base.
- Cached MongoDB connection helper in `src/lib/mongodb.ts`.
- Canonical category list in `src/lib/categories.ts` + `docs/categories.md`.
- Zod request schemas with type-aware category validation.
- `getUserId()` seam in `src/lib/auth.ts` (returns demo user until
  phase 2 wires NextAuth).
- 501 stubs for every planned API route so the routing tree exists.
- Placeholder pages for dashboard, budgets, reports.
- `docs/auth.md` — full authentication design.
- `docs/decisions/providers.md` — exchange rate, OCR, billing, email,
  rate-limit provider choices locked in.

### Changed (multi-base-currency support)

- **Removed hardcoded AED base.** `transaction.rateToAED` →
  `transaction.rateToBase`; `budget.limitMinorAED` →
  `budget.limitMinorBase`; `getRateToAED(currency)` →
  `getRate(from, to)`.
- FR-14 now reads: totals aggregate in the user's base currency.
- FR-1 now requires base currency as a signup field.
- `docs/database-schema.md`, `docs/api-structure.md`,
  `docs/requirements.md`, `docs/user-flow.md`, `docs/auth.md`,
  `docs/testing-checklist.md`, `docs/project-scope.md`, `CLAUDE.md`
  updated accordingly.

### Changed

- Project language changed from JavaScript to **TypeScript (strict)**.
  `docs/tech-stack.md` and `docs/folder-structure.md` updated to match.
- `CLAUDE.md` agent-instructions section reconciled with `tech-stack.md`
  (no Express, NextAuth not hand-rolled JWT).

### Planned

- NextAuth authentication and per-user data scoping.
- CSV and PDF export.

## [0.1.0] — 2026-05-24 — *spec-only*

> **Note**: This entry originally described an implemented starter kit,
> but no source files were committed alongside the docs. As of the
> next release, the scaffold is in place; treat 0.1.0 as the
> documentation-set milestone, not a code milestone.

### Added (documentation)

- Project documentation set under `docs/`: scope, tech stack, folder
  structure, requirements, roadmap, API structure, database schema,
  user flows, deployment guide, testing checklist.

---

## How to update this file

- Add changes under `[Unreleased]` as you make them.
- When releasing, rename `[Unreleased]` to the new version with the
  release date, and start a fresh `[Unreleased]` section above it.
- Keep entries short and user-facing where possible.
