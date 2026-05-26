// NextAuth handler. Wired up in Phase 2 — for now returns 501.
// When implementing: replace with `export { GET, POST } from "@/lib/auth";`
// after auth.ts exports handlers from NextAuth(authConfig).

export async function GET() {
  return Response.json({ error: "not implemented" }, { status: 501 });
}

export async function POST() {
  return Response.json({ error: "not implemented" }, { status: 501 });
}
