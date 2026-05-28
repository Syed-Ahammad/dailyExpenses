// NextAuth configuration + auth seams (getUserId, getUserBaseCurrency).
//
// Phase 1: both helpers return hardcoded demo values so feature work can
// proceed without auth wired up. Phase 2 replaces each body with a real
// session lookup; these helpers are the single auth-on switch.
//
// See docs/auth.md for the full auth design.

import type { NextAuthConfig } from "next-auth";
import { isSupportedCurrency, DEFAULT_BASE_CURRENCY } from "./currencies";

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

/**
 * Returns the current user's base currency (ISO 4217 code).
 *
 * Phase 1: reads DEFAULT_BASE_CURRENCY from the environment variable of the
 * same name, validated against the supported-currency list. Falls back to
 * the DEFAULT_BASE_CURRENCY constant from currencies.ts if the env var is
 * absent or holds an unsupported code.
 *
 * Phase 2: replace the body with `user.baseCurrency` from the auth session —
 * this helper is the single seam for per-user base currency.
 */
export async function getUserBaseCurrency(): Promise<string> {
  const envCode = process.env.DEFAULT_BASE_CURRENCY?.toUpperCase().trim();
  if (envCode && isSupportedCurrency(envCode)) {
    return envCode;
  }
  return DEFAULT_BASE_CURRENCY;
}
