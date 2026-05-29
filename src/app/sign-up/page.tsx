"use client";

/**
 * Sign-up page (FR-1). Creates the account via /api/auth/sign-up, then signs the
 * user in (same session path as sign-in) and navigates to the dashboard. Base
 * currency is chosen here and fixed for now (docs/auth.md). Dirham design system.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { CURRENCIES, DEFAULT_BASE_CURRENCY } from "@/lib/currencies";

const inputClass =
  "w-full rounded-sm border border-sand px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-soft";

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
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-6 text-center">
        <h1 className="text-[28px] font-semibold tracking-tight text-ink">
          Dir<span className="text-gold">ham</span>
        </h1>
        <p className="mt-1 text-sm text-muted">Create your account</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-sand bg-card p-6 shadow-sm"
        aria-label="Sign up"
      >
        {error !== null && (
          <p
            role="alert"
            className="rounded-md bg-red-bg px-4 py-3 text-sm text-red-ink"
          >
            {error}
          </p>
        )}

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

        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-sm font-medium text-ink"
          >
            Password{" "}
            <span className="font-normal text-muted">
              (min 10 chars, a letter and a digit)
            </span>
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="baseCurrency"
            className="mb-1 block text-sm font-medium text-ink"
          >
            Base currency{" "}
            <span className="font-normal text-muted">(fixed after signup)</span>
          </label>
          <select
            id="baseCurrency"
            required
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
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-green px-4 py-2.5 text-sm font-medium text-card transition-[transform,opacity] hover:opacity-90 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-green-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Creating account…" : "Create Account"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-green hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
