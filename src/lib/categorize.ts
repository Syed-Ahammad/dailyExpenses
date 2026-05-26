// AI category suggestion via Anthropic Claude Haiku.
// Phase 3 implementation. Stubbed for Phase 1.

import type { Category } from "./categories";

export interface CategorizeResult {
  category: Category;
  confidence: "low" | "medium" | "high";
}

export async function suggestCategory(
  _note: string,
  _merchant?: string,
): Promise<CategorizeResult> {
  throw new Error("suggestCategory not implemented");
}
