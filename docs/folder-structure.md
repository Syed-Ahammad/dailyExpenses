# Folder Structure

How the Multi-Currency codebase is organized. This is the target structure for
the full project; the current starter kit contains a subset.

## Top level

```
Multi-Currency/
  docs/                  — project documentation (this folder)
  public/                — static assets served as-is
  src/                   — application source code
  .env.local             — local secrets (never committed)
  .gitignore
  next.config.js
  package.json
  README.md
```

## src/

```
src/
  app/                   — Next.js App Router pages and API routes
  components/            — shared React components
  lib/                   — non-UI logic and helpers
  models/                — Mongoose schemas and models
  styles/                — global styles
```

## src/app/

```
src/app/
  layout.tsx             — root layout
  page.tsx               — marketing / landing page
  dashboard/
    page.tsx             — main dashboard
  budgets/
    page.tsx             — budget management
  reports/
    page.tsx             — export and reports
  api/
    expenses/route.ts
    expenses/[id]/route.ts
    dashboard/route.ts
    budgets/route.ts
    budgets/[id]/route.ts
    categorize/route.ts
    export/route.ts
    auth/[...nextauth]/route.ts
```

## src/components/

Reusable UI pieces shared across pages.

```
src/components/
  ui/                    — low-level primitives (button, input, card)
  StatCard.tsx           — a single headline total
  EntryForm.tsx          — the add-transaction form
  CategoryBar.tsx        — a category spend bar
  BudgetWarning.tsx      — a budget warning banner
  TransactionList.tsx    — recent activity list
```

## src/lib/

Logic that is not a React component.

```
src/lib/
  mongodb.ts             — cached database connection
  auth.ts                — NextAuth configuration + getUserId() seam
  categories.ts          — canonical category list (source of truth)
  categorize.ts          — AI category suggestion helper (phase 3)
  rates.ts               — exchange-rate lookup (phase 3)
  export.ts              — CSV / PDF generation (phase 2)
  validation.ts          — shared Zod schemas
  logger.ts              — small structured JSON logger
```

## src/models/

Mongoose models, one file per collection.

```
src/models/
  Transaction.ts
  Budget.ts
  Subscription.ts        — phase 5
```

## Naming conventions

- React component files use PascalCase `.tsx` (`EntryForm.tsx`).
- Non-component files use camelCase or lowercase `.ts` (`mongodb.ts`).
- API route files are always named `route.ts`, per Next.js convention.
- Dynamic route segments use square brackets (`[id]`).

## Where things go

- A new page → a folder under `src/app/` with a `page.tsx`.
- A new API endpoint → a `route.ts` under `src/app/api/`.
- A reusable UI piece → `src/components/`.
- Business logic or an external integration → `src/lib/`.
- A new database collection → a model in `src/models/`.
