/**
 * State management utilities
 *
 * Provides deep merge, origin normalization, and other helpers
 * for consistent state management.
 */

/**
 * Check if value is a plain object (not array, null, etc.)
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Deep merge two objects
 * Arrays are replaced, not merged
 * Undefined values in source are skipped
 *
 * @param target - Base object
 * @param source - Object to merge into target
 * @returns New merged object (immutable)
 */
export function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target } as T

  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceValue = source[key]
    const targetValue = target[key]

    // Skip undefined values
    if (sourceValue === undefined) {
      continue
    }

    // If both are plain objects, deep merge
    if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
      ;(result as Record<string, unknown>)[key as string] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      )
    } else {
      // Otherwise replace (including arrays)
      ;(result as Record<string, unknown>)[key as string] = sourceValue
    }
  }

  return result
}

/**
 * Normalize origin for consistent comparison
 * - Converts to lowercase
 * - Removes trailing slash
 * - Extracts origin from full URL if needed
 *
 * @param origin - Origin string to normalize
 * @returns Normalized origin string
 */
export function normalizeOrigin(origin: string): string {
  try {
    // Handle full URLs by extracting origin
    const url = new URL(origin)
    return url.origin.toLowerCase()
  } catch {
    // If not a valid URL, just lowercase and remove trailing slash
    return origin.toLowerCase().replace(/\/$/, '')
  }
}

/**
 * Compare two origins after normalization
 *
 * @param origin1 - First origin
 * @param origin2 - Second origin
 * @returns true if origins match
 */
export function originsMatch(origin1: string, origin2: string): boolean {
  return normalizeOrigin(origin1) === normalizeOrigin(origin2)
}
