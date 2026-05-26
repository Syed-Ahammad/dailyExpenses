// POST /api/categorize — Anthropic Haiku category suggestion. Phase 3.
// Server-side only: Anthropic key must never reach the client.
// Rate limit: 20/min/user (see docs/auth.md).

export async function POST() {
  return Response.json({ error: "not implemented" }, { status: 501 });
}
