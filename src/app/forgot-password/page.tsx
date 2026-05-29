"use client";

/**
 * Forgot-password page (FR-4, request step). Posts the email to
 * /api/auth/reset/request, which always responds 200 — so we always show the
 * same "if it exists, we sent a link" message (no account enumeration).
 */

import { useState } from "react";
import Link from "next/link";

const inputClass =
  "w-full rounded-sm border border-sand px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-soft";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch("/api/auth/reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Intentionally ignored — we show the same message either way.
    } finally {
      setSubmitting(false);
      setSent(true);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-6 text-center">
        <h1 className="text-[28px] font-semibold tracking-tight text-ink">
          Daily <span className="text-gold">Expenses</span>
        </h1>
        <p className="mt-1 text-sm text-muted">Reset your password</p>
      </div>

      <div className="rounded-lg border border-sand bg-card p-6 shadow-sm">
        {sent ? (
          <p className="text-sm text-ink">
            If an account exists for that email, we&apos;ve sent a link to reset
            your password. The link expires in 1 hour.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" aria-label="Forgot password">
            <p className="text-sm text-muted">
              Enter your email and we&apos;ll send you a reset link.
            </p>
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium text-ink"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-green px-4 py-2.5 text-sm font-medium text-card transition-[transform,opacity] hover:opacity-90 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-green-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Sending…" : "Send Reset Link"}
            </button>
          </form>
        )}
      </div>

      <p className="mt-4 text-center text-sm text-muted">
        <Link href="/sign-in" className="font-medium text-green hover:underline">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
