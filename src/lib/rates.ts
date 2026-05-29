// Exchange-rate lookup. Provider: exchangerate.host.
// See docs/decisions/providers.md.
//
// Cache policy: 1-hour in-memory TTL per pair; fall back to last good value for
// up to 24 hours on fetch failure; return null when nothing is available.
// In-flight deduplication: concurrent requests for the same pair share one fetch
// (thundering-herd protection).
// Server-only — never call from a client component.

const cache = new Map<string, { rate: number; fetchedAt: number }>();
const inflight = new Map<string, Promise<number | null>>();
const CACHE_TTL    = 60 * 60 * 1000;        // 1 hour
const FALLBACK_TTL = 24 * 60 * 60 * 1000;   // 24 hours

/**
 * Returns how many units of `to` equal one unit of `from`.
 * Returns null when the rate is unavailable and no recent cache entry exists
 * (the form will prompt the user to enter the rate manually in that case).
 *
 * Concurrent requests for the same pair are deduplicated — only one outbound
 * fetch is made regardless of how many callers are waiting.
 */
export async function getRate(from: string, to: string): Promise<number | null> {
  if (from === to) return 1;

  const key = `${from}:${to}`;
  const cached = cache.get(key);
  const now = Date.now();

  if (cached && now - cached.fetchedAt < CACHE_TTL) {
    return cached.rate;
  }

  // Deduplicate concurrent in-flight fetches for the same pair.
  const existing = inflight.get(key);
  if (existing) return existing;

  const fetchPromise = (async (): Promise<number | null> => {
    try {
      const base =
        process.env.EXCHANGERATE_API_BASE ?? "https://api.exchangerate.host";
      const url = `${base}/convert?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&amount=1`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as { success?: boolean; result?: number };
      if (data.success !== true || typeof data.result !== "number") {
        throw new Error("Unexpected response shape");
      }

      cache.set(key, { rate: data.result, fetchedAt: Date.now() });
      return data.result;
    } catch {
      // Serve last good cached value for up to 24 hours on transient failure.
      if (cached && Date.now() - cached.fetchedAt < FALLBACK_TTL) {
        return cached.rate;
      }
      return null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, fetchPromise);
  return fetchPromise;
}
