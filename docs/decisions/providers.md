# Provider Decisions

Third-party service choices that shape the data model or a route's
implementation. Each entry: **what was picked**, **why**, and **what
would make us reconsider**.

These are "decided, not deliberated forever" — they can be revisited
when the revisit-if condition fires.

## Exchange rates — `exchangerate.host`

**Choice**: `https://api.exchangerate.host`.

**Why**: Free, no API key, no quota for typical usage, supports all
currencies a UAE freelancer would invoice in, returns AED base directly.
Used by `src/lib/rates.ts` (`getRateToAED`).

**Cache policy**: in-memory 1-hour TTL per currency code. Re-fetched on
miss; on fetch failure, fall back to the last cached value if within
24 hours, otherwise return `null` and let the form prompt the user to
enter the rate manually.

**Revisit if**: reliability drops (>1% failure rate over a week), or
the service starts charging. Replacement candidate:
`openexchangerates.org` (paid, more reliable, AED supported).

## Receipt OCR — AWS Textract

**Choice**: AWS Textract (`@aws-sdk/client-textract`), region
`me-central-1` (UAE).

**Why**: Best accuracy for receipt-style documents in our testing
window, supports Arabic out of the box, region availability in UAE
keeps data local. Used by phase 4 receipt upload flow.

**Cost note**: ~$1.50 per 1,000 pages for `AnalyzeExpense`. This is
why OCR is positioned as a **paid-tier feature**, not free.

**Free-tier fallback**: `tesseract.js` runs in the browser at zero
infrastructure cost. Lower accuracy, no Arabic support, but acceptable
for a free-tier teaser. Not implemented at scaffold time — wire if
free-tier OCR is added.

**Revisit if**: per-page cost erodes unit economics on the paid tier,
or Textract's Arabic accuracy is insufficient. Candidates: Google
Document AI, Azure Document Intelligence.

## Billing — Stripe

**Choice**: Stripe (`stripe` npm package).

**Why**: Mature, supports AED, native subscription primitives, webhook
ecosystem, well-known to UAE customers. Used by phase 5 subscription
flow.

**Schema impact**: `subscriptions.providerId` stores the Stripe
subscription id. `STRIPE_WEBHOOK_SECRET` validates webhook signatures
on `POST /api/stripe/webhook` (added in phase 5).

**Revisit if**: UAE card acceptance becomes a problem (some local
cards still fail Stripe's risk checks). Candidate: **Tap Payments**
(UAE-native, better local-card support, narrower international reach).
If both are needed, add Tap as a secondary provider rather than
replacing Stripe.

## Transactional email — Resend

**Choice**: Resend (`resend` npm package).

**Why**: Modern DX, React Email integration (templates are JSX),
generous free tier (3,000 emails/month, 100/day), good deliverability.
Used by password reset (phase 2) and any future transactional emails
(receipts, invoices).

**Templates**: write as React Email components under
`src/emails/` (when phase 2 lands).

**Revisit if**: monthly volume exceeds the free tier (~100k+) and the
paid Resend tier doesn't pencil out, or deliverability degrades.
Candidates: AWS SES (cheapest at scale, more setup), Postmark
(deliverability-first).

## Rate limiting — Upstash Ratelimit

**Choice**: Upstash Redis + `@upstash/ratelimit` (added in phase 2).

**Why**: Serverless-native (no connection pooling issues on Vercel),
free tier covers expected launch traffic, sliding-window algorithm.
Used by every state-changing API route per `docs/auth.md`.

**Revisit if**: Vercel ships a built-in primitive that matches our
needs, or Upstash's free tier becomes insufficient.

## Error tracking — Sentry

**Choice**: Sentry (`@sentry/nextjs`).

**Why**: De facto standard for Next.js error tracking, good free tier,
release tracking integrates with Vercel deploys. Used in every
environment.

**Revisit if**: never, unless costs blow up. Sentry is one of those
"boring is good" choices.

## Things deliberately not chosen yet

- **Background jobs** (cron, queues): not needed at scaffold. When VAT
  reports or recurring transactions land, consider Inngest or Vercel Cron.
- **Search**: native Mongo indexing is fine until users have thousands
  of transactions and want full-text note search. Consider Atlas Search
  when that day comes.
- **Analytics**: PostHog or Plausible if/when needed. Not at scaffold.
