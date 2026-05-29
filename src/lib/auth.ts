// NextAuth (v5) wiring + the per-user auth seams (getUserId, getUserBaseCurrency).
//
// This module runs on the Node runtime (it uses Mongoose + bcrypt in the
// Credentials authorize callback), so it must NOT be imported by the Edge
// middleware — the middleware imports the DB-free auth.config.ts instead.
//
// getUserId() / getUserBaseCurrency() are the single seam every owned-resource
// route already calls. Phase 2 swaps their bodies from a hardcoded demo user to
// the real session — routes are untouched. See docs/auth.md.

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { connectMongo } from "./mongodb";
import { signInSchema } from "./validation";
import { DEFAULT_BASE_CURRENCY } from "./currencies";
import { UserModel } from "@/models/User";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const parsed = signInSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        await connectMongo();
        const user = await UserModel.findOne({ email }).lean();

        // Always run a bcrypt compare — even when the user is missing — against a
        // dummy hash, so response time can't reveal whether an email exists
        // (timing-based enumeration). docs/auth.md sign-in step 2.
        const hash = user?.passwordHash ?? DUMMY_HASH;
        const ok = await bcrypt.compare(password, hash);
        if (!user || !ok) return null;

        return {
          id: String(user._id),
          email: user.email,
          name: user.name ?? null,
          baseCurrency: user.baseCurrency,
        };
      },
    }),
  ],
});

// A valid bcrypt hash of a random string, used only to equalize timing for the
// "user not found" path. Never matches a real password.
const DUMMY_HASH =
  "$2a$12$C6UzMDM.H6dfI/f/IKcEeO3Z7Vc1l1n1l1n1l1n1l1n1l1n1l1n1u";

/**
 * Returns the current user's id from the session. Every owned-resource route
 * MUST call this and filter Mongo queries by the result. Never trust a
 * client-supplied userId. Throws if there is no session (routes are guarded by
 * middleware, so this is a defense-in-depth assertion that should not trigger).
 */
export async function getUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthenticated: no session user id");
  }
  return session.user.id;
}

/**
 * Returns the current user's base currency (ISO 4217) from the session,
 * falling back to the app default if somehow absent.
 */
export async function getUserBaseCurrency(): Promise<string> {
  const session = await auth();
  return session?.user?.baseCurrency ?? DEFAULT_BASE_CURRENCY;
}
