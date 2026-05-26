# Changelog

All notable changes to Multi-Currency. Newest entries at the top.

Format: each release has a version, a date, and changes grouped as
Added, Changed, Fixed, or Removed. Versions follow semantic versioning
(major.minor.patch).

## [Unreleased]

Work in progress, not yet released.

### Added

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
- Budget management UI.
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
