# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

The project is scaffolded: Next.js 14 + TypeScript strict, Tailwind v3, ESLint, Mongoose, Zod, NextAuth v5 (config only — not yet wired). Models exist for `User`, `Transaction`, `Budget`, `Subscription`. Every planned API route exists as a 501 stub so the routing tree is in place; Phase-1 logic is not yet implemented. Placeholder pages live at `/`, `/dashboard`, `/budgets`, `/reports`. `npm run dev`, `npm run lint`, `npm run build`, `tsc --noEmit` all pass. shadcn/ui is **not** installed (shadcn 4.x requires Tailwind v4 — pin shadcn 2.x compatible CLI or upgrade Tailwind when wiring forms).

## What this product is

Multi-Currency — a subscription web app for UAE freelancers / small businesses to record expenses and income, stay within per-category budgets, and produce VAT-aware monthly records for an accountant. Single full-time solo developer. See `docs/project-scope.md` for in-scope vs deliberate exclusions (no double-entry, no bank syncing, no tax advice, no native mobile).

The roadmap (`docs/roadmap.md`) is phased; **VAT-aware reporting (phase 5) is the primary monetizable feature** and should be pulled forward if paying users ask.

## Tech stack

Next.js 14 (App Router, **TypeScript strict**), React, Tailwind, shadcn/ui, Recharts, MongoDB + Mongoose, NextAuth v5 (phase 2), Anthropic Claude **Haiku** for categorization, Vercel + Atlas hosting, Sentry. Node ≥ 18.17. Zod for input validation. Full auth design in `docs/auth.md`, provider choices in `docs/decisions/providers.md`, canonical category list in `docs/categories.md` / `src/lib/categories.ts`.

## Commands (once scaffolded)

```
npm run dev      # local dev server (reads .env.local)
npm run build    # production build
npm run start    # serve production build
npm run lint     # next lint
```

Deploys are GitHub → Vercel auto-deploy on push to `main`. PR branches get preview URLs. Rollback = re-promote a prior Vercel deployment.

## Required env vars

`MONGODB_URI`, `ANTHROPIC_API_KEY`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `SENTRY_DSN`. Live in `.env.local` locally and in Vercel project settings for Production. Use a **separate Atlas database for preview/staging**.

## Architectural rules that span files

These are decisions baked into the data model, API, and UI together — getting any of them wrong corrupts data or breaks isolation.

### Money is integer minor units

Stored as integers, with the factor of 100 used across nearly every currency the app supports (1 AED = 100 fils, 1 USD = 100 cents, 1 GBP = 100 pence, etc.). **Never use floats for money.** This applies end-to-end: DB (`amountMinor`, `limitMinorBase`), API request/response bodies, and internal calculations. Convert to display value (`/100`) only at the UI edge. `50.25` major units ↔ `5025` minor units. See `docs/database-schema.md` and `docs/api-structure.md` "Conventions".

### Each user picks their base currency

`users.baseCurrency` (ISO 4217) is chosen at signup — **no currency is hardcoded as base.** All aggregations and budget limits are expressed in the user's base currency.

### Multi-currency: store rate at entry time

A transaction carries `currency` + `rateToBase` (the rate **at the moment of entry**, not at query time). All dashboard totals aggregate in the user's base via `amountMinor * rateToBase`. Never re-fetch a historical rate to recompute past totals.

### Per-user scoping is enforced server-side

Every user-owned document has a `userId` field and is indexed on it. API routes resolve the current user from the NextAuth session — **never trust a client-supplied user ID**. This rule covers transactions, budgets, and subscriptions. Until NextAuth lands (phase 2), `src/lib/` should expose a `getUserId()` that returns a hardcoded demo user; replacing this helper is the single seam for turning on auth.

### Budget ↔ transaction join is by query, not foreign key

Budgets relate to transactions by matching `userId + category`; there is no hard FK. The dashboard endpoint aggregates monthly spend per category (in the user's base currency) and compares against the budget's `limitMinorBase` / `warnAtPercent`. Warnings (`near`/`over`) are computed server-side and returned from `GET /api/dashboard` — don't compute them on the client.

### Categorization is server-side and rate-limited

`POST /api/categorize` calls Claude Haiku from the server. The Anthropic key must never reach the client. Track `categorySource` on each transaction (`manual` | `ai_suggested` | `ai_confirmed`) so suggestion quality can be measured. If the AI call fails, the entry flow falls back to manual category selection — **the form must never be blocked by an AI failure**.

### Mongoose connection caching

Next.js dev mode and serverless functions both re-import modules; a naive `mongoose.connect()` leaks connections. `src/lib/mongodb.ts` caches the connection on `global` (the standard Next.js + Mongoose pattern) and returns it.

## Layout conventions

Full target layout is in `docs/folder-structure.md`. Key rules:

- API endpoints live at `src/app/api/<resource>/route.ts` (and `[id]/route.ts` for item routes). Status codes follow `docs/api-structure.md` (201 on create, 200 elsewhere; errors as `{ "error": "message" }`).
- Pages live at `src/app/<route>/page.tsx`.
- React components use PascalCase `.tsx`; non-component files use camelCase/lowercase `.ts`.
- Business logic and external integrations (Mongo, Anthropic, exchange rates, exports) go in `src/lib/`, not in routes or components.
- Each Mongo collection gets one file under `src/models/`.

## Requirement IDs

Functional requirements are numbered `FR-1`…`FR-28` in `docs/requirements.md` and referenced from `docs/features-list.md`. When implementing or changing behavior, cite the FR number in commit messages and PR descriptions so the spec ↔ code link stays traceable.

## Non-functional bars to keep

- Dashboard loads under 1s for a few thousand transactions (NFR-2) — index `userId + occurredAt` desc.
- Responsive on phone (NFR-3) — every page is mobile-first.
- API routes validate input and reject malformed payloads (NFR-4); rate-limit the AI route in particular (NFR-5).

## Documentation

`docs/` is the single source of truth for product intent. When changing behavior that contradicts a doc, update the doc in the same change. The changelog (`docs/changelog.md`) gets a new `[Unreleased]` entry per user-facing change; rename to a version on release.

# Project Agent Instructions

## 🧠 Identity
You are an elite full-stack engineer specializing in Next.js, MERN stack,
TypeScript, and REST/GraphQL APIs. You write production-grade code only.

## 🎯 Core Behavior Rules
- ALWAYS read existing code before writing new code
- NEVER over-engineer — implement exactly what is asked, nothing more
- ALWAYS prefer editing existing files over creating new ones
- NEVER delete files without explicit confirmation
- ALWAYS run tests after making changes
- Think step by step before writing any code

## 📁 Project Stack
- Frontend: Next.js 14+ (App Router), TypeScript strict, Tailwind CSS, shadcn/ui
- Backend: Next.js Route Handlers (`src/app/api/<resource>/route.ts`), MongoDB (Mongoose) — **no Express**
- Auth: NextAuth v5 (Credentials + bcryptjs + JWT sessions) — see `docs/auth.md`
- Validation: Zod schemas in `src/lib/validation.ts`
- Categories (source of truth): `src/lib/categories.ts` — see `docs/categories.md`
- Providers: see `docs/decisions/providers.md` (exchangerate.host, AWS Textract, Stripe, Resend)
- Testing: Jest, Playwright (not yet set up)

## 🔧 Code Standards
- Use TypeScript strict mode always
- Functional components only (no class components)
- async/await over .then() chains
- Handle ALL errors with try/catch
- Add JSDoc comments on all exported functions
- Follow REST naming conventions for APIs

## ⚠️ Safety Rules
- NEVER push to main branch directly
- NEVER drop database collections without confirmation
- NEVER hardcode secrets — use .env always
- NEVER use console.log in production code — use proper logger
- For destructive operations: STOP and ask user first

## 🔁 Workflow
1. Understand the task fully before starting
2. Read relevant existing files first
3. Plan the approach in 3-5 bullet points
4. Implement with minimal changes
5. Write/update tests
6. Summarize what changed and why

## 💡 When Stuck
- Search codebase before asking
- Use Context7 MCP for up-to-date docs
- Prefer official docs over Stack Overflow patterns
