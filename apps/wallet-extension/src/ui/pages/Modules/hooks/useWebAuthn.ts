import { encodeWebAuthnSignature, type WebAuthnSignatureData } from '@stablenet/core'
import { useCallback, useState } from 'react'
import type { Hex } from 'viem'
import { createLogger } from '../../../../shared/utils/logger'

const logger = createLogger('WebAuthn')

// ============================================================================
// Types
// ============================================================================

export interface WebAuthnCredential {
  id: string
  credentialId: Hex
  pubKeyX: bigint
  pubKeyY: bigint
  createdAt: string
}

export interface UseWebAuthnOptions {
  rpId?: string
  rpName?: string
}

export interface UseWebAuthnReturn {
  /** Sign a challenge using WebAuthn */
  sign: (challenge: Uint8Array, credentialId?: Hex) => Promise<Hex>
  /** Check if WebAuthn is supported */
  isSupported: boolean
  /** Loading state */
  isLoading: boolean
  /** Error state */
  error: string | null
}

// ============================================================================
// Hook
// ============================================================================

export function useWebAuthn(options: UseWebAuthnOptions = {}): UseWebAuthnReturn {
  const { rpId = window.location.hostname, rpName: _rpName = 'StableNet Wallet' } = options
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSupported =
    typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials

  const sign = useCallback(
    async (challenge: Uint8Array, credentialId?: Hex): Promise<Hex> => {
      if (!isSupported) {
        throw new Error('WebAuthn is not supported in this browser')
      }

      setIsLoading(true)
      setError(null)

      try {
        // Prepare allowCredentials if specific credential is requested
        const allowCredentials: PublicKeyCredentialDescriptor[] | undefined = credentialId
          ? [
              {
                type: 'public-key',
                id: hexToUint8Array(credentialId).buffer as ArrayBuffer,
              },
            ]
          : undefined

        // Get assertion options
        const getOptions: CredentialRequestOptions = {
          publicKey: {
            challenge: challenge.buffer as ArrayBuffer,
            rpId,
            allowCredentials,
            userVerification: 'preferred',
            timeout: 60000,
          },
        }

        // Get assertion
        const assertion = (await navigator.credentials.get(
          getOptions
        )) as PublicKeyCredential | null

        if (!assertion) {
          throw new Error('Failed to get WebAuthn assertion')
        }

        const response = assertion.response as AuthenticatorAssertionResponse

        // Parse signature data
        const signatureData = parseAssertionResponse(response, challenge)

        // Encode signature using SDK utility
        const encodedSignature = encodeWebAuthnSignature(signatureData)

        return encodedSignature
      } catch (err) {
        const message = err instanceof Error ? err.message : 'WebAuthn signing failed'
        setError(message)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [isSupported, rpId]
  )

  return {
    sign,
    isSupported,
    isLoading,
    error,
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert hex string to Uint8Array
 */
function hexToUint8Array(hex: string): Uint8Array<ArrayBuffer> {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex
  const buffer = new ArrayBuffer(cleanHex.length / 2)
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

/**
 * Convert Uint8Array to hex string
 */
function uint8ArrayToHex(bytes: Uint8Array<ArrayBuffer>): Hex {
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}` as Hex
}

/**
 * Parse authenticator assertion response
 */
function parseAssertionResponse(
  response: AuthenticatorAssertionResponse,
  _challenge: Uint8Array
): WebAuthnSignatureData {
  // Get authenticator data - ensure we have ArrayBuffer
  const authDataBuffer =
    response.authenticatorData instanceof ArrayBuffer
      ? response.authenticatorData
      : (response.authenticatorData as unknown as { buffer: ArrayBuffer }).buffer
  const authenticatorData = uint8ArrayToHex(
    new Uint8Array(authDataBuffer) as Uint8Array<ArrayBuffer>
  )

  // Get client data JSON - ensure we have ArrayBuffer
  const clientDataBuffer =
    response.clientDataJSON instanceof ArrayBuffer
      ? response.clientDataJSON
      : (response.clientDataJSON as unknown as { buffer: ArrayBuffer }).buffer
  const clientDataJSON = uint8ArrayToHex(
    new Uint8Array(clientDataBuffer) as Uint8Array<ArrayBuffer>
  )

  // Parse client data to find challenge and type indices
  const clientDataStr = new TextDecoder().decode(response.clientDataJSON)

  // Find challenge index in the raw JSON
  const challengeIndex = clientDataStr.indexOf('"challenge"')
  const typeIndex = clientDataStr.indexOf('"type"')

  // Parse signature (DER encoded -> r, s) - ensure we have ArrayBuffer
  const sigBuffer =
    response.signature instanceof ArrayBuffer
      ? response.signature
      : (response.signature as unknown as { buffer: ArrayBuffer }).buffer
  const { r, s } = parseDERSignature(new Uint8Array(sigBuffer) as Uint8Array<ArrayBuffer>)

  return {
    authenticatorData,
    clientDataJSON,
    challengeIndex: challengeIndex !== -1 ? challengeIndex : 0,
    typeIndex: typeIndex !== -1 ? typeIndex : 0,
    r,
    s,
  }
}

/**
 * Parse DER encoded ECDSA signature to r, s components
 */
function parseDERSignature(der: Uint8Array<ArrayBuffer>): { r: bigint; s: bigint } {
  // DER format: 0x30 [total-length] 0x02 [r-length] [r] 0x02 [s-length] [s]
  let offset = 0

  // Check sequence tag (0x30)
  if (der[offset++] !== 0x30) {
    throw new Error('Invalid DER signature: missing sequence tag')
  }

  // Skip total length
  let totalLength: number = der[offset++] ?? 0
  if (totalLength & 0x80) {
    // Long form length
    const lengthBytes = totalLength & 0x7f
    totalLength = 0
    for (let i = 0; i < lengthBytes; i++) {
      totalLength = (totalLength << 8) | (der[offset++] ?? 0)
    }
  }

  // Parse r
  if (der[offset++] !== 0x02) {
    throw new Error('Invalid DER signature: missing r integer tag')
  }
  const rLength: number = der[offset++] ?? 0
  let rBytes: Uint8Array<ArrayBuffer> = new Uint8Array(der.buffer, der.byteOffset + offset, rLength)
  offset += rLength

  // Parse s
  if (der[offset++] !== 0x02) {
    throw new Error('Invalid DER signature: missing s integer tag')
  }
  const sLength: number = der[offset++] ?? 0
  let sBytes: Uint8Array<ArrayBuffer> = new Uint8Array(der.buffer, der.byteOffset + offset, sLength)

  // Remove leading zeros
  while (rBytes.length > 1 && rBytes[0] === 0) {
    rBytes = new Uint8Array(rBytes.buffer, rBytes.byteOffset + 1, rBytes.length - 1)
  }
  while (sBytes.length > 1 && sBytes[0] === 0) {
    sBytes = new Uint8Array(sBytes.buffer, sBytes.byteOffset + 1, sBytes.length - 1)
  }

  // Pad to 32 bytes for P-256
  const rPadded = padTo32Bytes(rBytes)
  const sPadded = padTo32Bytes(sBytes)

  const r = BigInt(uint8ArrayToHex(rPadded))
  const s = BigInt(uint8ArrayToHex(sPadded))

  return { r, s }
}

/**
 * Pad bytes to 32 bytes (P-256 curve)
 */
function padTo32Bytes(bytes: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  if (bytes.length === 32) return bytes
  if (bytes.length > 32) {
    const buffer = new ArrayBuffer(32)
    const result = new Uint8Array(buffer)
    result.set(new Uint8Array(bytes.buffer, bytes.byteOffset + bytes.length - 32, 32))
    return result
  }
  const buffer = new ArrayBuffer(32)
  const padded = new Uint8Array(buffer)
  padded.set(bytes, 32 - bytes.length)
  return padded
}

// ============================================================================
// Storage Helpers
// ============================================================================

const WEBAUTHN_STORAGE_KEY = 'stablenet_webauthn_credentials'

/**
 * Save WebAuthn credential to storage
 */
export async function saveWebAuthnCredential(
  accountAddress: string,
  credential: WebAuthnCredential
): Promise<void> {
  try {
    const existing = await loadWebAuthnCredentials(accountAddress)
    const updated = [...existing.filter((c) => c.id !== credential.id), credential]

    await chrome.storage.local.set({
      [WEBAUTHN_STORAGE_KEY]: {
        ...((await chrome.storage.local.get(WEBAUTHN_STORAGE_KEY))[WEBAUTHN_STORAGE_KEY] || {}),
        [accountAddress.toLowerCase()]: updated,
      },
    })
  } catch (error) {
    logger.error('Failed to save WebAuthn credential:', error)
  }
}

/**
 * Load WebAuthn credentials from storage
 */
export async function loadWebAuthnCredentials(
  accountAddress: string
): Promise<WebAuthnCredential[]> {
  try {
    const result = await chrome.storage.local.get(WEBAUTHN_STORAGE_KEY)
    const allCredentials = (result[WEBAUTHN_STORAGE_KEY] || {}) as Record<string, WebAuthnCredential[]>
    return allCredentials[accountAddress.toLowerCase()] || []
  } catch (error) {
    logger.error('Failed to load WebAuthn credentials:', error)
    return []
  }
}

/**
 * Remove WebAuthn credential from storage
 */
export async function removeWebAuthnCredential(
  accountAddress: string,
  credentialId: string
): Promise<void> {
  try {
    const existing = await loadWebAuthnCredentials(accountAddress)
    const updated = existing.filter((c) => c.id !== credentialId)

    await chrome.storage.local.set({
      [WEBAUTHN_STORAGE_KEY]: {
        ...((await chrome.storage.local.get(WEBAUTHN_STORAGE_KEY))[WEBAUTHN_STORAGE_KEY] || {}),
        [accountAddress.toLowerCase()]: updated,
      },
    })
  } catch (error) {
    logger.error('Failed to remove WebAuthn credential:', error)
  }
}
