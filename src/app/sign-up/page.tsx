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

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"/>
      <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58Z"/>
    </svg>
  );
}

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

        <div className="space-y-4">
          {/* Google sign-up */}
          <button
            type="button"
            onClick={() => signIn("google", { redirectTo: "/dashboard" })}
            className="flex w-full items-center justify-center gap-3 rounded-md border border-sand bg-card px-4 py-2.5 text-sm font-medium text-ink shadow-sm transition-[transform,opacity] hover:bg-paper active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-green-soft"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-sand" />
            <span className="text-xs text-muted">or sign up with email</span>
            <div className="h-px flex-1 bg-sand" />
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
        </div>

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
