// Cloudinary helper for the receipt upload flow (Phase 4, FR-25).
//
// Server-side only. The API secret must never reach the client; callers post
// multipart form data to /api/receipts/upload, which calls uploadReceipt()
// below to stream the bytes to Cloudinary.

import { v2 as cloudinary } from "cloudinary";
import { logger } from "@/lib/logger";

const RECEIPTS_FOLDER =
  process.env.CLOUDINARY_RECEIPTS_FOLDER || "daily-expenses/receipts";

let configured = false;

/**
 * Configure the Cloudinary SDK lazily. The SDK reads the env vars itself, but
 * we set them explicitly so a misconfigured deploy fails loudly with a clear
 * error instead of silently uploading to an unintended account.
 */
function ensureConfigured(): void {
  if (configured) return;

  // CLOUDINARY_URL (cloudinary://key:secret@cloud_name) is the SDK's preferred
  // form and overrides the three discrete vars when present.
  const url = process.env.CLOUDINARY_URL;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!url && (!cloudName || !apiKey || !apiSecret)) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_URL or " +
        "CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET.",
    );
  }

  if (!url) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
  }
  configured = true;
}

export interface ReceiptUpload {
  /** Public HTTPS URL of the stored receipt — what we persist to receiptUrl. */
  url: string;
  /** Cloudinary public_id (used to detect our own URLs server-side). */
  publicId: string;
}

/**
 * Upload a receipt image or PDF to Cloudinary and return the public URL.
 *
 * Cloudinary auto-detects images vs PDFs via `resource_type: "auto"`. We scope
 * everything under a per-user folder so an admin browsing the dashboard can
 * see whose receipt is whose.
 */
export async function uploadReceipt(
  bytes: Buffer,
  userId: string,
): Promise<ReceiptUpload> {
  ensureConfigured();

  const result = await new Promise<{ secure_url: string; public_id: string }>(
    (resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `${RECEIPTS_FOLDER}/${userId}`,
          resource_type: "auto",
        },
        (err, res) => {
          if (err || !res) {
            reject(err ?? new Error("Cloudinary returned no result"));
            return;
          }
          resolve({ secure_url: res.secure_url, public_id: res.public_id });
        },
      );
      stream.end(bytes);
    },
  );

  return { url: result.secure_url, publicId: result.public_id };
}

/**
 * True if `url` belongs to our configured Cloudinary account. Used by the OCR
 * route to refuse arbitrary URLs (SSRF guard) — we only OCR things we stored.
 */
export function isOurCloudinaryUrl(url: string): boolean {
  ensureConfigured();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (parsed.host !== "res.cloudinary.com") return false;

  const cloudName =
    cloudinary.config().cloud_name ?? process.env.CLOUDINARY_CLOUD_NAME ?? "";
  if (!cloudName) return false;
  // Cloudinary URL form: https://res.cloudinary.com/<cloud>/image/upload/...
  return parsed.pathname.startsWith(`/${cloudName}/`);
}

/**
 * Fetch a receipt's raw bytes from Cloudinary. Caller is responsible for
 * gating the URL with isOurCloudinaryUrl() first.
 */
export async function fetchReceiptBytes(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    logger.error("Failed to fetch receipt bytes", { status: res.status, url });
    throw new Error(`Failed to fetch receipt (${res.status})`);
  }
  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}
