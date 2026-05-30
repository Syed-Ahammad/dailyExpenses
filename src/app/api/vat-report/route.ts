// GET /api/vat-report — period VAT summary for the signed-in user (FR-29).
//
// ?period=YYYY-Qn (quarterly, default cadence) or ?period=YYYY-MM (monthly).
// ?format=json (default), csv, or pdf controls the response shape.
//
// Auth + per-user scoping go through the existing getUserId() seam — never
// trust a client-supplied user id. The aggregation lives in src/lib/vat.ts.

import { NextRequest } from "next/server";
import { connectMongo } from "@/lib/mongodb";
import { getUserId } from "@/lib/auth";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currencies";
import { TransactionModel } from "@/models/Transaction";
import { UserModel } from "@/models/User";
import { buildVatReport, parsePeriod, type VatTransaction } from "@/lib/vat";
import { vatReportToCsv, vatReportToPdf } from "@/lib/vatExport";
import { logger } from "@/lib/logger";

type Format = "json" | "csv" | "pdf";

function parseFormat(raw: string | null): Format | null {
  if (raw === null || raw === "json") return "json";
  if (raw === "csv" || raw === "pdf") return raw;
  return null;
}

export async function GET(request: NextRequest) {
  try {
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

    await connectMongo();
    const userId = await getUserId();

    const [user, txs] = await Promise.all([
      UserModel.findById(userId).lean<{ baseCurrency?: string } | null>(),
      TransactionModel.find({
        userId,
        // Half-open: [start, end). isVatable is included even when false so we
        // can let the helper filter — keeps the DB query simple.
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

    // format === "pdf"
    const pdf = await vatReportToPdf(report);
    return new Response(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="vat-${report.period}.pdf"`,
      },
    });
  } catch (err) {
    logger.error("GET /api/vat-report failed", { err });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
