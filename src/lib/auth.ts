// NextAuth configuration + getUserId() seam.
//
// Phase 1: getUserId() returns a hardcoded demo user so feature work can
// proceed without auth wired up. Phase 2 replaces the body with a real
// session lookup; this single helper is the auth-on switch.
//
// See docs/auth.md for the full auth design.

import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  providers: [],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/sign-in" },
};

const DEMO_USER_ID = "demo-user";

/**
 * Returns the current user's id. Every owned-resource API route MUST call
 * this and filter Mongo queries by the returned value. Never trust a
 * client-supplied userId.
 */
export async function getUserId(): Promise<string> {
  return DEMO_USER_ID;
}
