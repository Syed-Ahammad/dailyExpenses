// POST /api/receipts/ocr — extract amount/merchant/date from a stored receipt.
// FR-26 (OCR extraction of amount and merchant).
//
// Auth + rate limit (15/min on `receiptsOcr`) are enforced upstream by the
// middleware. The route refuses any URL that isn't a Cloudinary URL we just
// produced — this is the SSRF guard, since the AWS-side fetch is server-side.
// Failures resolve to {} rather than throwing because the entry flow must
// continue working when OCR is unavailable.

import { NextRequest } from "next/server";
import { z } from "zod";
import { getUserId } from "@/lib/auth";
import {
  fetchReceiptBytes,
  isOurCloudinaryUrl,
} from "@/lib/cloudinary";
import { extractReceipt } from "@/lib/ocr";
import { logger } from "@/lib/logger";

const inputSchema = z.object({
  receiptUrl: z.string().url(),
});

export async function POST(request: NextRequest) {
  try {
    // Touch the session so an unauthenticated request still 401s if middleware
    // is bypassed (defense in depth).
    await getUserId();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Validation failed" },
        { status: 400 },
      );
    }

    if (!isOurCloudinaryUrl(parsed.data.receiptUrl)) {
      return Response.json(
        { error: "receiptUrl must point to our Cloudinary host" },
        { status: 400 },
      );
    }

    const bytes = await fetchReceiptBytes(parsed.data.receiptUrl);
    const extraction = await extractReceipt(bytes);
    return Response.json(extraction, { status: 200 });
  } catch (err) {
    logger.error("POST /api/receipts/ocr failed", { err });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
