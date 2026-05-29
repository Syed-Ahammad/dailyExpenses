"use client";

import { signOut } from "next-auth/react";

/** Quiet text button that clears the session and returns to sign-in (FR-2). */
export default function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ redirectTo: "/sign-in" })}
      className="shrink-0 rounded-pill px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-sand hover:text-ink focus:outline-none focus:ring-2 focus:ring-green-soft"
    >
      Sign out
    </button>
  );
}
