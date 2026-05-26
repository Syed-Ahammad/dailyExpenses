# Tech Stack

The technologies used to build and run Multi-Currency, and the reason for each
choice.

## Summary

| Layer            | Choice                  | Reason                                        |
|------------------|-------------------------|-----------------------------------------------|
| Language         | TypeScript (Node.js)    | Type safety across UI and API                 |
| Framework        | Next.js 14 (App Router) | One codebase for UI and API                   |
| UI library       | React                   | Component model; required by Next.js          |
| Styling          | Tailwind CSS            | Fast, consistent styling                      |
| Components       | shadcn/ui               | Accessible, unstyled-by-default components    |
| Charts           | Recharts                | Simple React charting for the dashboard       |
| Database         | MongoDB                 | Flexible schema for an evolving product       |
| ODM              | Mongoose                | Schema validation and modeling for MongoDB    |
| Auth             | NextAuth v5 (Credentials + JWT) | App-Router native, stateless on Vercel|
| Password hashing | bcryptjs                | Standard, well-audited                        |
| Input validation | Zod                     | Schema-first request validation               |
| AI               | Anthropic Claude API    | Expense categorization; Haiku is cheap/fast   |
| Billing          | Stripe                  | Subscriptions, AED support (phase 5)          |
| Transactional email | Resend               | Password reset, future receipts (phase 2)     |
| Receipt OCR      | AWS Textract            | Receipt extraction in `me-central-1` (phase 4)|
| Hosting (app)    | Vercel                  | Zero-config Next.js deploys                   |
| Hosting (db)     | MongoDB Atlas           | Managed MongoDB with a free tier              |
| Error tracking   | Sentry (`@sentry/nextjs`)| Production error visibility                  |
| Version control  | Git + GitHub            | Standard source control                       |

## Why Next.js

Next.js lets the frontend and the API live in one project and one
deployment. API routes run server-side, so secrets and database access
stay off the client. The App Router supports server components for fast
initial loads and client components where interactivity is needed.

## Why MongoDB and Mongoose

The product's schema will change as features are added (VAT fields,
receipts, subscriptions). MongoDB's flexible documents make that
cheaper than rigid migrations early on. Mongoose adds schema
validation, default values, and indexes on top.

## Why NextAuth

Authentication is easy to get wrong. NextAuth handles sessions,
password flows, and provider integration with well-tested code, rather
than hand-rolling auth.

## Why Claude for categorization

Categorizing a short expense note into one of a fixed list is a small,
fast classification task. The Haiku model is inexpensive per call and
quick to respond, which keeps both cost and latency low.

## Versions and requirements

- Node.js 18.17 or newer.
- Next.js 14.x.
- TypeScript 5.x, `strict` mode + `noUncheckedIndexedAccess`.
- A modern browser for the client.

## Key dependencies

| Package                     | Purpose                                  |
|-----------------------------|------------------------------------------|
| `next`                      | Framework                                |
| `react`, `react-dom`        | UI library                               |
| `mongoose`                  | MongoDB modeling                         |
| `next-auth@beta`            | Authentication (phase 2)                 |
| `bcryptjs`                  | Password hashing (phase 2)               |
| `zod`                       | Input validation                         |
| `@anthropic-ai/sdk`         | Claude Haiku categorization              |
| `recharts`                  | Dashboard charts                         |
| `tailwindcss`               | Styling                                  |
| `stripe`                    | Subscription billing (phase 5)           |
| `resend`                    | Transactional email (phase 2)            |
| `@aws-sdk/client-textract`  | Receipt OCR (phase 4)                    |
| `@sentry/nextjs`            | Error tracking                           |

## Services and accounts needed

- A MongoDB Atlas account and cluster.
- An Anthropic API key.
- A Vercel account for deployment.
- A GitHub repository.
- A Sentry account for error tracking.
- A billing provider account (phase 5).

## Things deliberately not used

- No separate backend server; Next.js Route Handlers are sufficient.
  Specifically: **no Express, no Fastify, no Nest.** All API endpoints
  live as `src/app/api/<resource>/route.ts` files.
- No SQL database; the schema benefits from MongoDB's flexibility.
- No native mobile framework at launch; the web app is responsive.
- No custom hand-rolled JWT auth; NextAuth handles sessions.
