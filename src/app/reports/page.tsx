/**
 * Reports page — monthly transactions export (FR-22, FR-23) + VAT report (FR-29).
 * Protected by middleware; base currency comes from the session seam.
 */

import Link from "next/link";
import { getUserBaseCurrency } from "@/lib/auth";
import ExportPanel from "@/components/ExportPanel";
import VatReportPanel from "@/components/VatReportPanel";
import SignOutButton from "@/components/SignOutButton";

// Reads the session (base currency) — render per request.
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const baseCurrency = await getUserBaseCurrency();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink sm:text-[34px]">
            Reports
          </h1>
          <p className="mt-1 text-sm text-muted">
            Export your records, in {baseCurrency}.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Link
            href="/dashboard"
            className="rounded-pill px-3 py-1.5 text-sm font-medium text-green transition-colors hover:bg-green-soft focus:outline-none focus:ring-2 focus:ring-green-soft"
          >
            ← Dashboard
          </Link>
          <SignOutButton />
        </div>
      </div>

      <div className="space-y-6">
        <VatReportPanel baseCurrency={baseCurrency} />
        <ExportPanel baseCurrency={baseCurrency} />
      </div>
    </main>
  );
}
