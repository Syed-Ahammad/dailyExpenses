"use client";

/**
 * Accept a share invite from a URL token (FR-32).
 * User must be signed in — middleware redirects to sign-in first if not.
 */

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

type Status = "idle" | "accepting" | "success" | "error";

export default function ShareAcceptPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";

  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [ownerId, setOwnerId] = useState("");

  // Auto-submit the token as soon as the page loads.
  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("No invite token found. Check the link and try again.");
      return;
    }

    setStatus("accepting");
    fetch("/api/sharing/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => r.json())
      .then((json: { ownerId?: string; error?: string }) => {
        if (json.ownerId) {
          setOwnerId(json.ownerId);
          setStatus("success");
        } else {
          setErrorMsg(json.error ?? "Could not accept the invite.");
          setStatus("error");
        }
      })
      .catch(() => {
        setErrorMsg("Something went wrong. Please try again.");
        setStatus("error");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm rounded-xl border border-sand bg-card p-8 shadow-sm text-center">
        <h1 className="font-display text-xl font-semibold text-ink mb-3">
          Shared access
        </h1>

        {(status === "idle" || status === "accepting") && (
          <p className="text-sm text-muted">Accepting your invite…</p>
        )}

        {status === "success" && (
          <>
            <p className="text-sm text-green font-medium mb-4">
              Access granted! You can now view this account.
            </p>
            <button
              onClick={() => router.push(`/shared/${ownerId}`)}
              className="w-full rounded-md bg-green px-4 py-2.5 text-sm font-medium text-card hover:opacity-90"
            >
              View shared account →
            </button>
            <p className="mt-3 text-xs text-muted">
              Or{" "}
              <Link href="/dashboard" className="underline hover:text-ink">
                go to your own dashboard
              </Link>
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <p className="text-sm text-red-ink mb-4">{errorMsg}</p>
            <Link
              href="/dashboard"
              className="text-sm text-green underline hover:opacity-80"
            >
              ← Back to dashboard
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
