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
  "w-full rounded-sm border border-sand px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-soft";

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
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-6 text-center">
        <h1 className="text-[28px] font-semibold tracking-tight text-ink">
          Daily <span className="text-gold">Expenses</span>
        </h1>
        <p className="mt-1 text-sm text-muted">Sign in to your account</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-sand bg-card p-6 shadow-sm"
        aria-label="Sign in"
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
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-green px-4 py-2.5 text-sm font-medium text-card transition-[transform,opacity] hover:opacity-90 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-green-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Signing in…" : "Sign In"}
        </button>

        <p className="text-center text-sm">
          <Link
            href="/forgot-password"
            className="font-medium text-muted hover:text-ink hover:underline"
          >
            Forgot password?
          </Link>
        </p>
      </form>

      <p className="mt-4 text-center text-sm text-muted">
        Don&apos;t have an account?{" "}
        <Link href="/sign-up" className="font-medium text-green hover:underline">
          Sign up
        </Link>
      </p>
    </main>
  );
}
