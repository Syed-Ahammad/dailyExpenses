// POST /api/receipts/upload — upload a receipt image/PDF to Cloudinary.
// FR-25 (attach a receipt photo to a transaction).
//
// Auth is enforced by middleware (401 if no session). Rate-limited by the
// `receiptsUpload` rule (30/min, keyed by userId). The route is intentionally
// thin: it validates the file shape, hands the bytes to the Cloudinary
// helper, and returns the resulting URL. Persisting receiptUrl onto a
// transaction is the form's job, not this route's.

import { NextRequest } from "next/server";
import { getUserId } from "@/lib/auth";
import { uploadReceipt } from "@/lib/cloudinary";
import { logger } from "@/lib/logger";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return Response.json({ error: "Invalid form data" }, { status: 400 });
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json(
        { error: "Missing 'file' field" },
        { status: 400 },
      );
    }

    if (file.size === 0) {
      return Response.json({ error: "Empty file" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return Response.json(
        { error: "Receipt must be 5 MB or smaller" },
        { status: 400 },
      );
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return Response.json(
        { error: "Receipt must be a JPEG, PNG, WEBP image or PDF" },
        { status: 400 },
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const { url } = await uploadReceipt(bytes, userId);

    return Response.json({ url }, { status: 201 });
  } catch (err) {
    logger.error("POST /api/receipts/upload failed", { err });
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
