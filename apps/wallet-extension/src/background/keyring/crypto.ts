import { pbkdf2 } from '@noble/hashes/pbkdf2'
import { sha256 } from '@noble/hashes/sha256'

/**
 * Cryptographic utilities for keyring encryption
 * Uses Web Crypto API with AES-256-GCM and PBKDF2
 */

const ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256
const IV_LENGTH = 12
const SALT_LENGTH = 32
const ITERATIONS = 100000
const TAG_LENGTH = 128

/**
 * Generate a cryptographically secure random buffer
 */
export function getRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}

/**
 * Derive an encryption key from password using PBKDF2
 */
export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const passwordBuffer = encoder.encode(password)

  // Use noble-hashes for PBKDF2
  const derivedKeyMaterial = pbkdf2(sha256, passwordBuffer, salt, {
    c: ITERATIONS,
    dkLen: KEY_LENGTH / 8,
  })

  // Import as CryptoKey for Web Crypto API
  return crypto.subtle.importKey(
    'raw',
    derivedKeyMaterial.buffer as ArrayBuffer,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt data using AES-256-GCM
 */
export async function encrypt(
  data: string,
  password: string
): Promise<{
  ciphertext: string
  iv: string
  salt: string
  tag: string
}> {
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)

  const salt = getRandomBytes(SALT_LENGTH)
  const iv = getRandomBytes(IV_LENGTH)
  const key = await deriveKey(password, salt)

  const encrypted = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv: iv.buffer as ArrayBuffer,
      tagLength: TAG_LENGTH,
    },
    key,
    dataBuffer
  )

  // AES-GCM appends the auth tag to the ciphertext
  const encryptedArray = new Uint8Array(encrypted)
  const tagStart = encryptedArray.length - TAG_LENGTH / 8
  const ciphertext = encryptedArray.slice(0, tagStart)
  const tag = encryptedArray.slice(tagStart)

  return {
    ciphertext: bufferToHex(ciphertext),
    iv: bufferToHex(iv),
    salt: bufferToHex(salt),
    tag: bufferToHex(tag),
  }
}

/**
 * Decrypt data using AES-256-GCM
 */
export async function decrypt(
  encrypted: {
    ciphertext: string
    iv: string
    salt: string
    tag: string
  },
  password: string
): Promise<string> {
  const ciphertext = hexToBuffer(encrypted.ciphertext)
  const iv = hexToBuffer(encrypted.iv)
  const salt = hexToBuffer(encrypted.salt)
  const tag = hexToBuffer(encrypted.tag)

  const key = await deriveKey(password, salt)

  // Combine ciphertext and tag for AES-GCM
  const combined = new Uint8Array(ciphertext.length + tag.length)
  combined.set(ciphertext, 0)
  combined.set(tag, ciphertext.length)

  const decrypted = await crypto.subtle.decrypt(
    {
      name: ALGORITHM,
      iv: iv.buffer as ArrayBuffer,
      tagLength: TAG_LENGTH,
    },
    key,
    combined.buffer as ArrayBuffer
  )

  const decoder = new TextDecoder()
  return decoder.decode(decrypted)
}

/**
 * Hash a password for verification (not for encryption)
 */
export function hashPassword(password: string, salt: Uint8Array): Uint8Array {
  const encoder = new TextEncoder()
  const passwordBuffer = encoder.encode(password)

  return pbkdf2(sha256, passwordBuffer, salt, {
    c: ITERATIONS,
    dkLen: 32,
  })
}

/**
 * Verify a password against a hash
 */
export function verifyPassword(
  password: string,
  salt: Uint8Array,
  expectedHash: Uint8Array
): boolean {
  const hash = hashPassword(password, salt)
  return constantTimeEqual(hash, expectedHash)
}

/**
 * Constant-time comparison to prevent timing attacks
 */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    const aVal = a[i]
    const bVal = b[i]
    if (aVal !== undefined && bVal !== undefined) {
      result |= aVal ^ bVal
    }
  }

  return result === 0
}

/**
 * Convert buffer to hex string
 */
export function bufferToHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Convert hex string to buffer
 */
export function hexToBuffer(hex: string): Uint8Array {
  const matches = hex.match(/.{1,2}/g)
  if (!matches) {
    throw new Error('Invalid hex string')
  }
  return new Uint8Array(matches.map((byte) => Number.parseInt(byte, 16)))
}

/**
 * Generate a secure random hex string
 */
export function generateRandomHex(length: number): string {
  return bufferToHex(getRandomBytes(length))
}
