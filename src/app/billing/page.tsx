"use client";

/**
 * Billing page (FR-27). Shows the user's current plan, feature comparison,
 * and upgrade / manage buttons that hit the Stripe Checkout / Portal routes.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FREE_FEATURES,
  PRO_FEATURES,
  PRO_PRICE_DISPLAY,
  PLAN_LABELS,
  type Plan,
} from "@/lib/plans";

interface SubscriptionInfo {
  plan: Plan;
  status: string | null;
  currentPeriodEnd: string | null;
}

function CheckIcon() {
  return (
    <svg
      className="mt-0.5 h-4 w-4 shrink-0 text-green"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 8l3.5 3.5L13 4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlanCard({
  name,
  price,
  features,
  isCurrent,
  badge,
  children,
}: {
  name: string;
  price: string;
  features: string[];
  isCurrent: boolean;
  badge?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`relative flex flex-col rounded-lg border p-6 shadow-sm ${
        isCurrent
          ? "border-green bg-card ring-1 ring-green"
          : "border-sand bg-card"
      }`}
    >
      {badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-green px-3 py-0.5 text-xs font-semibold text-card">
          {badge}
        </span>
      )}
      {isCurrent && (
        <span className="absolute right-4 top-4 rounded-full bg-green/10 px-2.5 py-0.5 text-xs font-medium text-green">
          Current plan
        </span>
      )}
      <h2 className="font-display text-xl font-semibold text-ink">{name}</h2>
      <p className="mt-1 text-2xl font-bold text-ink">{price}</p>
      <ul className="mt-5 flex-1 space-y-2.5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-muted">
            <CheckIcon />
            {f}
          </li>
        ))}
      </ul>
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}

export default function BillingPage() {
  const [info, setInfo] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/subscription")
      .then((r) => r.json())
      .then((d: SubscriptionInfo) => setInfo(d))
      .catch(() => setInfo({ plan: "free", status: null, currentPeriodEnd: null }))
      .finally(() => setLoading(false));

    // Show success toast when returning from Stripe Checkout.
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "1") {
      window.history.replaceState({}, "", "/billing");
    }
  }, []);

  async function handleCheckout() {
    setActing(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        setError(json.error ?? "Could not start checkout. Please try again.");
        return;
      }
      window.location.href = json.url;
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setActing(false);
    }
  }

  async function handlePortal() {
    setActing(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        setError(json.error ?? "Could not open billing portal. Please try again.");
        return;
      }
      window.location.href = json.url;
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setActing(false);
    }
  }

  const isPro = info?.plan === "pro";
  const renewsLabel =
    info?.currentPeriodEnd
      ? `Renews ${new Date(info.currentPeriodEnd).toLocaleDateString("en-AE", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}`
      : null;

  return (
    <main className="min-h-dvh bg-paper px-4 py-10">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-2">
          <Link
            href="/dashboard"
            className="text-sm text-muted hover:text-ink"
          >
            ← Dashboard
          </Link>
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          Billing
        </h1>
        <p className="mt-1 text-sm text-muted">
          {isPro
            ? `You're on the ${PLAN_LABELS.pro} plan.${renewsLabel ? ` ${renewsLabel}.` : ""}`
            : "Upgrade to Pro to unlock receipt OCR and downloadable VAT reports."}
        </p>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-md bg-red-bg px-4 py-2.5 text-sm text-red-ink"
          >
            {error}
          </p>
        )}

        {/* Plan cards */}
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {/* Free */}
          <PlanCard
            name="Free"
            price="$0 / month"
            features={FREE_FEATURES}
            isCurrent={!isPro}
          >
            {!isPro && (
              <p className="text-center text-sm text-muted">
                Your current plan
              </p>
            )}
          </PlanCard>

          {/* Pro */}
          <PlanCard
            name="Pro"
            price={PRO_PRICE_DISPLAY}
            features={PRO_FEATURES}
            isCurrent={isPro}
            badge="Recommended"
          >
            {loading ? (
              <div className="h-10 animate-pulse rounded-md bg-sand" />
            ) : isPro ? (
              <button
                onClick={handlePortal}
                disabled={acting}
                className="w-full rounded-md border border-sand bg-paper px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-sand disabled:cursor-not-allowed disabled:opacity-50"
              >
                {acting ? "Opening portal…" : "Manage subscription"}
              </button>
            ) : (
              <button
                onClick={handleCheckout}
                disabled={acting}
                className="w-full rounded-md bg-green px-4 py-2.5 text-sm font-medium text-card transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-soft focus-visible:ring-offset-2"
              >
                {acting ? "Redirecting…" : `Upgrade to Pro — ${PRO_PRICE_DISPLAY}`}
              </button>
            )}
          </PlanCard>
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          Payments are processed by Stripe. Cancel anytime — your data is yours.
        </p>
      </div>
    </main>
  );
}
