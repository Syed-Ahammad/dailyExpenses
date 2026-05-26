// Exchange-rate lookup. Provider: exchangerate.host.
// See docs/decisions/providers.md. Phase 3 implementation.
//
// `from` and `to` are ISO 4217 currency codes (e.g. "USD", "AED", "GBP").
// Returns the multiplier to convert one unit of `from` into `to`.

export async function getRate(_from: string, _to: string): Promise<number> {
  throw new Error("getRate not implemented");
}
