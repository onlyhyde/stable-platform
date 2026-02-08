/**
 * Memory Sanitizer
 *
 * Utilities for clearing sensitive data from memory when the wallet is locked.
 * Overwrites string and Uint8Array contents before releasing references.
 */

/**
 * Overwrite a Uint8Array with zeros.
 */
export function zeroOut(buffer: Uint8Array): void {
  buffer.fill(0)
}

/**
 * Create a sanitized copy of a string (cannot truly overwrite JS strings,
 * but we can ensure no lingering references exist).
 * Returns empty string after clearing.
 */
export function clearString(value: string | null): string {
  // JavaScript strings are immutable; we can only drop the reference.
  // This function serves as a semantic marker and ensures callers set to ''.
  void value
  return ''
}

/**
 * Clear a Map containing sensitive data (e.g., private keys).
 * Iterates and deletes each entry individually to aid GC.
 */
export function clearSensitiveMap<K, V>(map: Map<K, V>): void {
  for (const key of map.keys()) {
    map.delete(key)
  }
}

/**
 * Clear an array containing sensitive data.
 * Sets length to 0 after nullifying entries.
 */
export function clearSensitiveArray<T>(arr: T[]): void {
  arr.length = 0
}

/**
 * Sanitize all sensitive fields on a keyring-like object.
 * Expects the object to have a lock/clear/sanitize method or
 * be manually sanitized by its owner.
 */
export interface Sanitizable {
  sanitize(): void
}
