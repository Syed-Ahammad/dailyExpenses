// GET /api/shared/:ownerId/export?month=YYYY-MM&format=csv|pdf
// Download an owner's monthly report as a read-only viewer (FR-33).

import { NextRequest } from "next/server";
import { connectMongo } from "@/lib/mongodb";
import { getUserId } from "@/lib/auth";
import { verifyViewerAccess } from "@/lib/sharing";
import { exportMonthlyCsv, exportMonthlyPdf, monthRangeUtc } from "@/lib/export";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ ownerId: string }> };

function currentMonthUtc(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { ownerId } = await params;

    await connectMongo();
    const userId = await getUserId();

    if (!(await verifyViewerAccess(userId, ownerId))) {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const format = (searchParams.get("format") ?? "csv").toLowerCase();
    const month = searchParams.get("month") ?? currentMonthUtc();

    if (format !== "csv" && format !== "pdf") {
      return Response.json(
        { error: "Unsupported format (use csv or pdf)" },
        { status: 400 },
      );
    }
    if (!monthRangeUtc(month)) {
      return Response.json(
        { error: "Invalid month (expected YYYY-MM)" },
        { status: 400 },
      );
    }

    if (format === "pdf") {
      const pdf = await exportMonthlyPdf(ownerId, month);
      return new Response(new Uint8Array(pdf), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="expenses-${month}.pdf"`,
        },
      });
    }

    const csv = await exportMonthlyCsv(ownerId, month);
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="expenses-${month}.csv"`,
      },
    });
  } catch (err) {
    logger.error("GET /api/shared/[ownerId]/export failed", { err });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
