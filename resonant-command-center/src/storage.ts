/**
 * Safe localStorage utilities with JSON.parse guards.
 */

/**
 * Safely parse JSON with a fallback. Never throws.
 */
export function safeJsonParse<T>(json: string | null | undefined, fallback?: T): T {
  if (json == null || json === '') return (fallback ?? {}) as T;
  try {
    return JSON.parse(json) as T;
  } catch {
    return (fallback ?? {}) as T;
  }
}

/**
 * Parse JSON or return empty object. Convenience wrapper.
 */
export function safeJsonParseOr<T = Record<string, unknown>>(
  json: string | null | undefined
): T {
  return safeJsonParse<T>(json, {} as T);
}
