// Module augmentation so the session + JWT carry our custom fields
// (the user id and their chosen base currency). See src/lib/auth.config.ts.
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      baseCurrency: string;
    } & DefaultSession["user"];
  }

  // The object returned by the Credentials `authorize()` callback.
  interface User {
    baseCurrency?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    baseCurrency?: string;
  }
}
