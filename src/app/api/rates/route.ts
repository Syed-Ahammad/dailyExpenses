// GET /api/rates?from=USD&to=AED
// Returns { rate: number } or { rate: null } when the provider is unavailable.
// The form pre-fills rateToBase on a successful response; a null response leaves
// the field editable so the user can enter the rate manually (FR-9).

import { type NextRequest } from "next/server";
import { getRate } from "@/lib/rates";

/** ISO 4217 currency codes are 3 uppercase letters. */
const CURRENCY_RE = /^[A-Z]{3}$/;

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from")?.toUpperCase();
  const to   = req.nextUrl.searchParams.get("to")?.toUpperCase();

  if (!from || !to) {
    return Response.json(
      { error: "`from` and `to` query params are required" },
      { status: 400 },
    );
  }

  if (!CURRENCY_RE.test(from) || !CURRENCY_RE.test(to)) {
    return Response.json(
      { error: "Currency codes must be 3 letters (ISO 4217)" },
      { status: 400 },
    );
  }

  const rate = await getRate(from, to);
  return Response.json({ rate });
}
