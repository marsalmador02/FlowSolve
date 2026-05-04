// Utility helpers shared by flow execution, rendering, and diagnostics.

// Parse a JSON string safely and return null on malformed input.
export function parseJson<T>(txt?: string): T | null {
  if (!txt) {
    return null;
  }
  try {
    return JSON.parse(txt) as T;
  } catch {
    return null;
  }
}

// Compute an aggregate score from goalValues while handling infeasible payloads.
export function resultScore(result: any): number {
  if (!result || result.isFeasible === false) {
    return Number.NEGATIVE_INFINITY / 2;
  }
  if (!Array.isArray(result.goalValues)) {
    return Number.NEGATIVE_INFINITY / 2;
  }
  return result.goalValues.reduce((acc: number, v: any) => acc + (typeof v === 'number' ? v : 0), 0);
}
