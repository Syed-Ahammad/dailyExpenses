// Edge middleware: route protection + a CSRF Origin check.
//
// Uses an Edge-safe NextAuth instance built from the DB-free auth.config (it can
// still read/verify the JWT session cookie without the Credentials provider).
// docs/auth.md "Per-user data isolation" + "CSRF".

import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

const PROTECTED_PAGES = ["/dashboard", "/budgets", "/reports"];
const AUTH_PAGES = ["/sign-in", "/sign-up"];
const STATE_CHANGING = new Set(["POST", "PATCH", "PUT", "DELETE"]);

export default auth((req) => {
  const { nextUrl } = req;
  const { pathname } = nextUrl;
  const isLoggedIn = !!req.auth;

  const isApi = pathname.startsWith("/api/");
  const isAuthApi = pathname.startsWith("/api/auth/");

  // CSRF: reject state-changing app-API requests whose Origin doesn't match the
  // host. A missing Origin (non-browser clients) is allowed; NextAuth's own
  // routes handle their CSRF, so skip /api/auth/*.
  if (isApi && !isAuthApi && STATE_CHANGING.has(req.method)) {
    const origin = req.headers.get("origin");
    if (origin && new URL(origin).host !== nextUrl.host) {
      return Response.json({ error: "Bad origin" }, { status: 403 });
    }
  }

  // Bounce logged-in users away from the auth pages.
  if (AUTH_PAGES.some((p) => pathname.startsWith(p))) {
    if (isLoggedIn) {
      return Response.redirect(new URL("/dashboard", nextUrl));
    }
    return;
  }

  // Protect owned API routes with a 401 JSON (not an HTML redirect).
  if (isApi && !isAuthApi && !isLoggedIn) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Protect app pages with a redirect to sign-in.
  if (!isLoggedIn && PROTECTED_PAGES.some((p) => pathname.startsWith(p))) {
    const signInUrl = new URL("/sign-in", nextUrl);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return Response.redirect(signInUrl);
  }

  return;
});

// Run on everything except Next internals and static assets.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
