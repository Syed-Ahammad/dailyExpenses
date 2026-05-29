"use client";

/**
 * Reset-password page (FR-4, confirm step). Reads the token from the URL query
 * (?token=…) and posts it with the new password to /api/auth/reset/confirm.
 * On success it sends the user to sign in.
 *
 * The token is read from window.location (not useSearchParams) to avoid a
 * Suspense boundary; this is a client-only page.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const inputClass =
  "w-full rounded-sm border border-sand px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-soft";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token"));
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("This reset link is missing its token.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      if (res.ok) {
        setDone(true);
        setTimeout(() => router.push("/sign-in"), 1500);
      } else {
        const json = (await res.json()) as { error?: string };
        setError(json.error ?? "Could not reset password.");
      }
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
        <p className="mt-1 text-sm text-muted">Choose a new password</p>
      </div>

      <div className="rounded-lg border border-sand bg-card p-6 shadow-sm">
        {done ? (
          <p className="text-sm text-ink">
            Your password has been reset. Redirecting you to sign in…
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" aria-label="Reset password">
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
                htmlFor="password"
                className="mb-1 block text-sm font-medium text-ink"
              >
                New password{" "}
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
                htmlFor="confirm"
                className="mb-1 block text-sm font-medium text-ink"
              >
                Confirm new password
              </label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-green px-4 py-2.5 text-sm font-medium text-card transition-[transform,opacity] hover:opacity-90 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-green-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Resetting…" : "Reset Password"}
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
