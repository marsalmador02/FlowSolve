/**
 * Safely parses a JSON string and returns null if invalid.
 */
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
