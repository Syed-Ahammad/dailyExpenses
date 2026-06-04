// GET /api/shared/:ownerId/vat-report — VAT report for a shared owner (FR-33).
// Same logic as /api/vat-report but scoped to the verified owner's data.

import { NextRequest } from "next/server";
import { connectMongo } from "@/lib/mongodb";
import { getUserId } from "@/lib/auth";
import { verifyViewerAccess } from "@/lib/sharing";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currencies";
import { TransactionModel } from "@/models/Transaction";
import { UserModel } from "@/models/User";
import { buildVatReport, parsePeriod, type VatTransaction } from "@/lib/vat";
import { vatReportToCsv, vatReportToPdf } from "@/lib/vatExport";
import { logger } from "@/lib/logger";

type Format = "json" | "csv" | "pdf";
type RouteContext = { params: Promise<{ ownerId: string }> };

function parseFormat(raw: string | null): Format | null {
  if (raw === null || raw === "json") return "json";
  if (raw === "csv" || raw === "pdf") return raw;
  return null;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { ownerId } = await params;

    await connectMongo();
    const userId = await getUserId();

    if (!(await verifyViewerAccess(userId, ownerId))) {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const periodParam = searchParams.get("period");
    const formatParam = parseFormat(searchParams.get("format"));

    if (!periodParam) {
      return Response.json(
        { error: "`period` query param is required (YYYY-Qn or YYYY-MM)" },
        { status: 400 },
      );
    }
    if (formatParam === null) {
      return Response.json(
        { error: "`format` must be json, csv, or pdf" },
        { status: 400 },
      );
    }

    const range = parsePeriod(periodParam);
    if (!range) {
      return Response.json(
        { error: "Invalid `period` — use YYYY-Qn (e.g. 2026-Q2) or YYYY-MM" },
        { status: 400 },
      );
    }

    const [user, txs] = await Promise.all([
      UserModel.findById(ownerId).lean<{ baseCurrency?: string } | null>(),
      TransactionModel.find({
        userId: ownerId,
        occurredAt: { $gte: range.start, $lt: range.end },
      })
        .sort({ occurredAt: 1 })
        .lean<VatTransaction[]>(),
    ]);

    const baseCurrency = user?.baseCurrency ?? DEFAULT_BASE_CURRENCY;
    const report = buildVatReport(txs, range, baseCurrency);

    if (formatParam === "json") {
      return Response.json(report, { status: 200 });
    }

    if (formatParam === "csv") {
      const body = vatReportToCsv(report);
      return new Response(body, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="vat-${report.period}.csv"`,
        },
      });
    }

    const pdf = await vatReportToPdf(report);
    return new Response(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="vat-${report.period}.pdf"`,
      },
    });
  } catch (err) {
    logger.error("GET /api/shared/[ownerId]/vat-report failed", { err });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
