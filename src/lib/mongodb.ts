// Cached MongoDB connection for Next.js.
// Next.js dev mode and serverless functions re-import modules; without a
// cache on `global`, each request opens a fresh connection and leaks.
// This is the standard Next.js + Mongoose pattern.

import mongoose from "mongoose";
const dns = require("dns") as typeof import("dns"); // CommonJS — bypasses webpack's browser DNS polyfill

// Node.js's c-ares DNS resolver can fail to reach the system DNS server on
// some Windows setups (ECONNREFUSED on querySrv). Force public resolvers so
// mongodb+srv:// SRV lookups succeed. Using require() avoids webpack stubbing
// the dns module with a browser polyfill.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache =
  global.__mongooseCache ?? { conn: null, promise: null };

if (!global.__mongooseCache) {
  global.__mongooseCache = cached;
}

export async function connectMongo(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, { bufferCommands: false })
      .catch((err) => {
        // Clear so the next request retries rather than replaying the same failure.
        cached.promise = null;
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
