// GET /api/export?month=YYYY-MM&format=csv|pdf — download a monthly report.
// FR-22 (CSV). PDF (FR-23) is a later phase → 501. Scoped to the session user;
// the route is also auth-guarded by middleware.

import { NextRequest } from "next/server";
import { getUserId } from "@/lib/auth";
import { exportMonthlyCsv, monthRangeUtc } from "@/lib/export";
import { logger } from "@/lib/logger";

/** Current month as YYYY-MM (UTC) — used when no month is supplied. */
function currentMonthUtc(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const format = (searchParams.get("format") ?? "csv").toLowerCase();
    const month = searchParams.get("month") ?? currentMonthUtc();

    if (format === "pdf") {
      return Response.json(
        { error: "PDF export is not available yet" },
        { status: 501 },
      );
    }
    if (format !== "csv") {
      return Response.json(
        { error: "Unsupported format (use csv)" },
        { status: 400 },
      );
    }
    if (!monthRangeUtc(month)) {
      return Response.json(
        { error: "Invalid month (expected YYYY-MM)" },
        { status: 400 },
      );
    }

    const userId = await getUserId();
    const csv = await exportMonthlyCsv(userId, month);

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="expenses-${month}.csv"`,
      },
    });
  } catch (err) {
    logger.error("GET /api/export failed", { err });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
