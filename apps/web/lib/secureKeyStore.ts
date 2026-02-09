/**
 * SecureKeyStore — In-memory private key vault with XOR encryption.
 *
 * Security properties:
 * - Key is XOR'd with a random one-time pad immediately on entry
 * - Plaintext never stored in React state/ref (invisible to DevTools)
 * - Auto-clears after configurable timeout (default 60s)
 * - Uint8Array buffers zeroed on clear (best-effort memory wipe)
 * - retrieveAndClear() for one-shot signing flows
 */

const DEFAULT_AUTO_CLEAR_MS = 60_000

class SecureKeyStore {
  private _encrypted: Uint8Array | null = null
  private _pad: Uint8Array | null = null
  private _clearTimer: ReturnType<typeof setTimeout> | null = null
  private _onClear: (() => void) | null = null

  /**
   * Store a private key encrypted in memory.
   * Any previously stored key is cleared first.
   */
  store(key: string, autoClearMs = DEFAULT_AUTO_CLEAR_MS): void {
    this.clear()

    const encoder = new TextEncoder()
    const keyBytes = encoder.encode(key)
    const pad = crypto.getRandomValues(new Uint8Array(keyBytes.length))

    const encrypted = new Uint8Array(keyBytes.length)
    for (let i = 0; i < keyBytes.length; i++) {
      encrypted[i] = keyBytes[i] ^ pad[i]
    }

    // Best-effort wipe of the plaintext bytes
    keyBytes.fill(0)

    this._encrypted = encrypted
    this._pad = pad

    if (autoClearMs > 0) {
      this._clearTimer = setTimeout(() => {
        this.clear()
      }, autoClearMs)
    }
  }

  /**
   * Decrypt and return the stored key without clearing it.
   * Returns null if no key is stored.
   */
  retrieve(): string | null {
    if (!this._encrypted || !this._pad) return null

    const decrypted = new Uint8Array(this._encrypted.length)
    for (let i = 0; i < this._encrypted.length; i++) {
      decrypted[i] = this._encrypted[i] ^ this._pad[i]
    }

    const decoder = new TextDecoder()
    const key = decoder.decode(decrypted)

    // Best-effort wipe of the temporary decrypted buffer
    decrypted.fill(0)

    return key
  }

  /**
   * Decrypt, return, and immediately clear the stored key.
   * Preferred for one-shot signing operations.
   */
  retrieveAndClear(): string | null {
    const key = this.retrieve()
    this.clear()
    return key
  }

  /** Whether a key is currently stored. */
  get hasKey(): boolean {
    return this._encrypted !== null
  }

  /** Register a callback invoked when the key is cleared (e.g. timeout). */
  onClear(callback: (() => void) | null): void {
    this._onClear = callback
  }

  /** Securely wipe stored key material and cancel auto-clear timer. */
  clear(): void {
    if (this._clearTimer) {
      clearTimeout(this._clearTimer)
      this._clearTimer = null
    }

    if (this._encrypted) {
      this._encrypted.fill(0)
      this._encrypted = null
    }

    if (this._pad) {
      this._pad.fill(0)
      this._pad = null
    }

    this._onClear?.()
  }
}

/** Singleton vault for private key storage during EIP-7702 signing flows. */
export const secureKeyStore = new SecureKeyStore()
