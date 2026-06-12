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
