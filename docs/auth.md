# Authentication & Authorization

How Daily Expenses handles sign-up, sign-in, sessions, password reset, and
per-user data isolation. Implemented in **phase 2**; this document is
the spec the implementation must match.

## Decision summary

| Concern        | Choice                                  |
|----------------|------------------------------------------|
| Library        | NextAuth v5 (App Router native)         |
| Provider       | Credentials (email + password)          |
| Password hash  | bcryptjs, cost factor 12                |
| Session        | JWT strategy (stateless, 30-day rolling)|
| Reset transport| Custom token + Resend email             |
| Rate limiting  | Upstash Ratelimit                       |

## Sign-up

1. User submits email + password + **base currency** (ISO 4217 code).
2. Email is lowercased and trimmed; must match a basic format check.
3. Password rules: minimum 10 characters, must contain at least one
   letter and one digit. No maximum length. No forced rotation.
4. Base currency must be a valid 3-letter uppercase ISO 4217 code.
   The signup form suggests AED (UAE default) but offers a searchable
   list (USD, GBP, EUR, SAR, INR, …).
5. If the email is already taken, return 409 with
   `{ "error": "email already in use" }`.
6. Password is hashed with `bcrypt.hash(password, 12)`.
7. A `users` document is created with `baseCurrency` persisted.
8. A session is established the same way as sign-in (see below).

> Phase 2 ships with base currency **fixed at signup**. A later phase
> may allow changing it; that change requires deciding whether
> historical `rateToBase` values are recomputed or left as-is (see
> `docs/database-schema.md`).

## Sign-in

Credentials provider. The `authorize()` callback:

1. Fetches the user by email.
2. Compares the submitted password with the stored hash via
   `bcrypt.compare()`. **Always run the compare** — even when the user
   does not exist — to prevent timing-based email enumeration.
3. Returns the user object on success, `null` on failure.

NextAuth then issues a JWT and sets the session cookie.

## Sessions

- **Strategy**: JWT. Chosen because Vercel functions are stateless;
  database sessions would add a read per request without giving us
  server-side invalidation we actually need at this stage.
- **Cookie**: `HttpOnly`, `Secure` in production, `SameSite=Lax`,
  `Path=/`.
- **Lifetime**: 30 days, rolling (each authenticated request resets the
  countdown).
- **Secret**: `NEXTAUTH_SECRET` — generate with
  `openssl rand -base64 32`. Required in every environment.

## Sign-out

Standard NextAuth `signOut()` clears the session cookie. No server-side
state to revoke (JWT strategy).

## Password reset

NextAuth does not ship password reset for the Credentials provider, so
this is a custom flow.

1. `POST /api/auth/reset/request` — body: `{ email }`. Always responds
   200 with no body, regardless of whether the email exists, to avoid
   enumeration.
2. If the email exists, generate a token: 32 random bytes (crypto.randomBytes),
   base64url encoded. Store its SHA-256 hash in
   `passwordResetTokens`: `{ userId, tokenHash, expiresAt, usedAt }`.
   Expiry: 1 hour from issue.
3. Send an email via Resend with a link to
   `/reset?token=<plain-token>`.
4. `POST /api/auth/reset/confirm` — body: `{ token, newPassword }`.
   - Look up token by SHA-256 hash. Reject if missing, expired, or used.
   - Validate new password against the same rules as sign-up.
   - Hash and update `users.passwordHash`. Mark token `usedAt = now`.
   - Invalidate any other active reset tokens for that user.

## CSRF

- NextAuth's own routes handle CSRF via its built-in token. Don't disable.
- For our state-changing app routes (POST/PATCH/DELETE), we rely on:
  - `SameSite=Lax` cookies (blocks cross-site cookie attachment on
    state-changing requests).
  - An `Origin` / `Referer` header check on POST/PATCH/DELETE: reject
    requests where origin does not match the app's host.
- This is sufficient for a session-cookie-based app with no third-party
  embedding. Revisit if we add iframe embeds or third-party widgets.

## Rate limiting

Use Upstash Ratelimit (Redis-backed, free tier sufficient for early
launch). Limits:

| Route                         | Limit               | Window | Keyed by  |
|-------------------------------|---------------------|--------|-----------|
| `POST /api/auth/sign-in`      | 10                  | 1 min  | IP        |
| `POST /api/auth/sign-up`      | 5                   | 1 min  | IP        |
| `POST /api/auth/reset/*`      | 5                   | 1 hour | IP+email  |
| `POST /api/categorize`        | 20                  | 1 min  | userId    |
| `POST /api/expenses`          | 60                  | 1 min  | userId    |
| `POST /api/budgets`           | 30                  | 1 min  | userId    |

Returns 429 with `{ "error": "rate limit exceeded" }`.

## Per-user data isolation

The single most important auth-adjacent rule:

1. **Every owned-resource route must call `getUserId()` from
   `src/lib/auth.ts`** to obtain the current user id.
2. **All Mongo queries must filter by that userId**. Reads, writes,
   deletes — no exception.
3. **Never trust a body, query, or path-supplied userId.** If the
   client sends one, ignore it.
4. **Never log a userId at level `info`.** Use `warn`/`error` only
   when the userId is part of a security-relevant event.

Phase 1: `getUserId()` returns a hardcoded `"demo-user"`. **This is the
single seam for turning auth on** — when phase 2 lands, only that
function changes; routes do not.

## Cookies and headers

In production:

- All cookies: `HttpOnly`, `Secure`, `SameSite=Lax`.
- Response headers via `next.config.mjs`:
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`

## Out of scope (for now)

- OAuth providers (Google, GitHub, etc.) — possible later.
- Magic-link sign-in — possible later.
- Two-factor authentication — revisit when a paying user requests it.
- Account deletion / data export — required for UAE PDPL compliance;
  scheduled but unscheduled at the moment.
