"use client";

/**
 * Sign-up page (FR-1). Creates the account via /api/auth/sign-up, then signs the
 * user in (same session path as sign-in) and navigates to the dashboard. Base
 * currency is chosen here and fixed for now (docs/auth.md). Daily Expenses design system.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { CURRENCIES, DEFAULT_BASE_CURRENCY } from "@/lib/currencies";

const inputClass =
  "w-full rounded-md border border-sand bg-card px-3 py-2.5 text-sm text-ink " +
  "placeholder:text-muted transition-colors " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-green-soft " +
  "disabled:bg-paper disabled:text-muted disabled:cursor-not-allowed";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [baseCurrency, setBaseCurrency] = useState(DEFAULT_BASE_CURRENCY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, baseCurrency }),
      });
      if (res.status !== 201) {
        const json = (await res.json()) as { error?: string };
        setError(json.error ?? "Could not create account.");
        return;
      }
      // Establish a session the same way as sign-in, then go to the dashboard.
      const signInRes = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (signInRes?.error) {
        // Account created but auto sign-in failed — send them to sign in.
        router.push("/sign-in");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center overflow-y-auto bg-paper px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-md bg-green font-display text-lg font-bold text-card">
            D
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
            Daily <span className="text-gold">Expenses</span>
          </h1>
          <p className="mt-1 text-sm text-muted">Create your account</p>
        </div>

        {/* Form card */}
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-lg border border-sand bg-card p-7 shadow-md"
          aria-label="Sign up"
        >
          {error !== null && (
            <p
              role="alert"
              className="rounded-md bg-red-bg px-3 py-2.5 text-sm text-red-ink"
            >
              {error}
            </p>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-ink"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              disabled={submitting}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-ink"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              disabled={submitting}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
            <p className="text-xs text-muted">
              Min 10 characters, at least one letter and one digit.
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="baseCurrency"
              className="block text-sm font-medium text-ink"
            >
              Base currency
            </label>
            <select
              id="baseCurrency"
              required
              disabled={submitting}
              value={baseCurrency}
              onChange={(e) => setBaseCurrency(e.target.value)}
              className={`${inputClass} bg-card`}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted">Cannot be changed after signup.</p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-green px-4 py-2.5 text-sm font-medium text-card transition-[transform,opacity] hover:opacity-90 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-green-soft focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="font-medium text-green hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
