// Edge-safe NextAuth base config — NO database, bcrypt, or Node-only imports.
// This is imported by both the middleware (Edge runtime) and the full auth.ts
// (Node runtime), so it must stay free of anything that can't run on the Edge.
// The Credentials provider (which uses Mongoose + bcrypt) is added in auth.ts.
//
// See docs/auth.md for the full design.

import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  // JWT sessions: stateless, suits Vercel functions. 30-day rolling window.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/sign-in" },
  // Explicit secret + trustHost so both the Edge and Node instances agree and
  // host inference works outside Vercel (local dev, previews).
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  providers: [], // real provider(s) added in auth.ts (Node runtime)
  callbacks: {
    // Persist the user id + base currency into the JWT at sign-in so later
    // requests can read them without a DB hit.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        if (user.baseCurrency) token.baseCurrency = user.baseCurrency;
      }
      return token;
    },
    // Expose id + baseCurrency on the session object consumed by the seams.
    session({ session, token }) {
      if (typeof token.id === "string") session.user.id = token.id;
      if (typeof token.baseCurrency === "string") {
        session.user.baseCurrency = token.baseCurrency;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
