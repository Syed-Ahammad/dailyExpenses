"use client";

/**
 * Sign-in page (FR-2). Calls NextAuth's Credentials provider client-side with
 * redirect:false so we can surface a friendly error, then navigates to the
 * dashboard on success. Styled with the Daily Expenses design system.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

const inputClass =
  "w-full rounded-md border border-sand bg-card px-3 py-2.5 text-sm text-ink " +
  "placeholder:text-muted transition-colors " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-green-soft " +
  "disabled:bg-paper disabled:text-muted disabled:cursor-not-allowed";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        setError("Invalid email or password.");
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
          <p className="mt-1 text-sm text-muted">Sign in to your account</p>
        </div>

        {/* Form card */}
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-lg border border-sand bg-card p-7 shadow-md"
          aria-label="Sign in"
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
            <div className="flex items-baseline justify-between">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-ink"
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-muted hover:text-ink hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={submitting}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-green px-4 py-2.5 text-sm font-medium text-card transition-[transform,opacity] hover:opacity-90 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-green-soft focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" className="font-medium text-green hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
