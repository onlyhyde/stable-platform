/**
 * Session Storage Encryption (SEC-6)
 *
 * Provides encryption for session storage data to protect sensitive
 * information like keyrings from memory dumps or malicious access.
 *
 * Security Model:
 * - Uses AES-256-GCM for encryption
 * - Derives encryption key from vault salt using PBKDF2
 * - Salt is stored in local storage, session data in session storage
 * - Attacker would need access to both storages to decrypt
 */

import { createLogger } from '../../shared/utils/logger'

const logger = createLogger('SessionCrypto')

// Session encryption constants
const SESSION_PBKDF2_ITERATIONS = 100000
const SESSION_KEY_LENGTH = 256
const SESSION_ENCRYPTION_PURPOSE = 'session-storage-encryption'

/**
 * Encrypted session data structure
 */
export interface EncryptedSessionData {
  /** Base64 encoded encrypted data */
  ciphertext: string
  /** Base64 encoded initialization vector */
  iv: string
  /** Encryption version for future compatibility */
  version: 1
  /** Timestamp when data was encrypted */
  encryptedAt: number
}

/**
 * Check if data is encrypted session data
 */
export function isEncryptedSessionData(data: unknown): data is EncryptedSessionData {
  if (!data || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  return (
    typeof obj.ciphertext === 'string' &&
    typeof obj.iv === 'string' &&
    obj.version === 1 &&
    typeof obj.encryptedAt === 'number'
  )
}

/**
 * Derive session encryption key from vault salt
 *
 * Uses PBKDF2 with a fixed purpose string to derive a key specifically
 * for session encryption. This is separate from the vault encryption key.
 */
export async function deriveSessionKey(salt: Uint8Array): Promise<CryptoKey> {
  // Import the salt combined with purpose as key material
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new Uint8Array([...salt, ...encoder.encode(SESSION_ENCRYPTION_PURPOSE)]),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  // Derive the actual encryption key
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(SESSION_ENCRYPTION_PURPOSE),
      iterations: SESSION_PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: SESSION_KEY_LENGTH,
    },
    false, // Not extractable for security
    ['encrypt', 'decrypt']
  )

  return key
}

/**
 * Encrypt session data
 *
 * @param data - Data to encrypt (will be JSON serialized)
 * @param salt - Vault salt for key derivation
 * @returns Encrypted session data structure
 */
export async function encryptSessionData<T>(
  data: T,
  salt: Uint8Array
): Promise<EncryptedSessionData> {
  try {
    // Derive encryption key
    const key = await deriveSessionKey(salt)

    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(12))

    // Serialize and encode data
    const encoder = new TextEncoder()
    const plaintext = encoder.encode(JSON.stringify(data))

    // Encrypt
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      plaintext
    )

    // Return encrypted data structure
    return {
      ciphertext: arrayBufferToBase64(ciphertext),
      iv: arrayBufferToBase64(iv.buffer),
      version: 1,
      encryptedAt: Date.now(),
    }
  } catch (error) {
    logger.error('Failed to encrypt session data', error)
    throw new Error('Session encryption failed')
  }
}

/**
 * Decrypt session data
 *
 * @param encryptedData - Encrypted session data structure
 * @param salt - Vault salt for key derivation
 * @returns Decrypted data
 */
export async function decryptSessionData<T>(
  encryptedData: EncryptedSessionData,
  salt: Uint8Array
): Promise<T> {
  try {
    // Validate version
    if (encryptedData.version !== 1) {
      throw new Error(`Unsupported encryption version: ${encryptedData.version}`)
    }

    // Derive encryption key
    const key = await deriveSessionKey(salt)

    // Decode ciphertext and IV
    const ciphertext = base64ToArrayBuffer(encryptedData.ciphertext)
    const iv = base64ToArrayBuffer(encryptedData.iv)

    // Decrypt
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(iv),
      },
      key,
      ciphertext
    )

    // Decode and parse
    const decoder = new TextDecoder()
    const json = decoder.decode(plaintext)
    return JSON.parse(json) as T
  } catch (error) {
    logger.error('Failed to decrypt session data', error)
    throw new Error('Session decryption failed')
  }
}

/**
 * Convert ArrayBuffer to Base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

/**
 * Convert Base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

/**
 * Securely clear sensitive data from memory
 * Note: JavaScript doesn't guarantee memory clearing, but this is a best effort
 */
export function secureClear(data: Uint8Array): void {
  crypto.getRandomValues(data)
  data.fill(0)
}
