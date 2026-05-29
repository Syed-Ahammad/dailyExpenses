// POST /api/categorize — OpenAI gpt-4o-mini category suggestion.
// Server-only: OpenAI key never reaches the client (NFR-6).
// Rate limit: 20/min/user enforced in middleware (NFR-5).
// FR-19, FR-20.

import { type NextRequest } from "next/server";
import OpenAI from "openai";
import { getUserId } from "@/lib/auth";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/categories";
import { logger } from "@/lib/logger";
import { z } from "zod";

const client = new OpenAI();

const categorizeSchema = z.object({
  note: z.string().trim().min(1).max(500),
  type: z.enum(["expense", "income"]),
});

/**
 * POST /api/categorize
 * Body: { note: string, type: "expense" | "income" }
 * Returns: { category: string } — always a valid category from the canonical list.
 * On AI failure the route returns 500; the form falls back to the user's
 * current selection without blocking submission (FR-19).
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = categorizeSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Validation failed" },
        { status: 400 },
      );
    }

    const { note, type } = parsed.data;
    const categories =
      type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

    logger.info("POST /api/categorize", { userId, noteLength: note.length });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 32,
      messages: [
        {
          role: "user",
          content: `Categorize this ${type} transaction. Reply with ONLY the exact category name from the list, nothing else.\n\nTransaction note: "${note}"\n\nValid categories: ${categories.join(", ")}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message.content?.trim() ?? "";

    // Guard against hallucinated categories — fall back to the first valid one.
    const suggestion = (categories as readonly string[]).includes(raw)
      ? raw
      : categories[0] ?? "Other";

    return Response.json({ category: suggestion });
  } catch (err) {
    logger.error("POST /api/categorize failed", { err });
    return Response.json({ error: "Suggestion unavailable" }, { status: 500 });
  }
}
