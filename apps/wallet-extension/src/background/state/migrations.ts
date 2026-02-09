import type { WalletState } from '../../types'

/**
 * Current state schema version.
 * Increment this when making breaking changes to the state shape.
 */
export const STATE_VERSION = 1

/**
 * State with version information for migration tracking
 */
export interface VersionedState extends WalletState {
  _version: number
}

/**
 * Migration functions registry.
 * Each key is the target version, and the function transforms
 * state from (key - 1) to key.
 */
const migrations: Record<number, (state: Record<string, unknown>) => Record<string, unknown>> = {
  // version 0 → 1: Initial versioning - add _version field
  1: (state) => ({
    ...state,
    _version: 1,
  }),
  // Future migrations:
  // 2: (state) => ({ ...state, newField: defaultValue, _version: 2 }),
}

/**
 * Apply migrations to bring state up to current version.
 * Handles unversioned (legacy) state by treating it as version 0.
 *
 * @param state - Raw state from storage (may be unversioned)
 * @returns Migrated state at current version
 */
export function migrateState(state: Record<string, unknown>): Record<string, unknown> {
  let currentVersion = (state?._version as number) ?? 0
  let migratedState = { ...state }

  while (currentVersion < STATE_VERSION) {
    currentVersion++
    const migration = migrations[currentVersion]
    if (migration) {
      migratedState = migration(migratedState)
    } else {
      // No migration defined, just bump version
      migratedState = { ...migratedState, _version: currentVersion }
    }
  }

  return migratedState
}
