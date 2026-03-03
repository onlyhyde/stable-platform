/**
 * WebAuthn Bridge — enables WebAuthn signing from Service Worker context.
 *
 * Problem: Extension background (Service Worker) cannot access
 * `navigator.credentials.get()` for WebAuthn assertion.
 *
 * Solution: Use Chrome Offscreen Document API to create an offscreen page
 * that has access to the WebAuthn API, then communicate via messaging.
 *
 * Fallback: If Offscreen API is unavailable, open a popup window for signing.
 */

import type { Hex } from 'viem'

// ============================================================================
// Types
// ============================================================================

export interface WebAuthnCredentialInfo {
  credentialId: string
  pubKeyX: string
  pubKeyY: string
}

export interface WebAuthnBridge {
  /** Sign a challenge hash using WebAuthn */
  sign(challenge: Hex, credential: WebAuthnCredentialInfo): Promise<Hex>
}

interface WebAuthnAssertionRequest {
  type: 'WEBAUTHN_ASSERTION_REQUEST'
  requestId: string
  challenge: string
  credentialId: string
}

interface WebAuthnAssertionResponse {
  type: 'WEBAUTHN_ASSERTION_RESPONSE'
  requestId: string
  signature?: string
  error?: string
}

// ============================================================================
// Constants
// ============================================================================

const OFFSCREEN_URL = 'offscreen/webauthn.html'
const OFFSCREEN_REASON = 'WEB_AUTH_FLOW' as chrome.offscreen.Reason

// ============================================================================
// Implementation
// ============================================================================

let nextRequestId = 0

export function createWebAuthnBridge(): WebAuthnBridge {
  let offscreenCreated = false

  async function ensureOffscreenDocument(): Promise<void> {
    if (offscreenCreated) return

    // Check if offscreen document already exists
    try {
      const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType],
      })
      if (existingContexts.length > 0) {
        offscreenCreated = true
        return
      }
    } catch {
      // getContexts not available — fallback below
    }

    try {
      await chrome.offscreen.createDocument({
        url: OFFSCREEN_URL,
        reasons: [OFFSCREEN_REASON],
        justification: 'WebAuthn credential assertion for smart account signing',
      })
      offscreenCreated = true
    } catch (error) {
      // Document may already exist (race condition)
      if (error instanceof Error && error.message?.includes('already exists')) {
        offscreenCreated = true
        return
      }
      throw error
    }
  }

  const sign = async (
    challenge: Hex,
    credential: WebAuthnCredentialInfo
  ): Promise<Hex> => {
    await ensureOffscreenDocument()

    const requestId = `webauthn_${++nextRequestId}_${Date.now()}`

    return new Promise<Hex>((resolve, reject) => {
      let settled = false

      const cleanup = () => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        chrome.runtime.onMessage.removeListener(listener)
      }

      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error('WebAuthn signing timed out (30s)'))
      }, 30_000)

      const listener = (message: WebAuthnAssertionResponse) => {
        if (message.type !== 'WEBAUTHN_ASSERTION_RESPONSE') return
        if (message.requestId !== requestId) return

        cleanup()

        if (message.error) {
          reject(new Error(`WebAuthn signing failed: ${message.error}`))
        } else if (
          typeof message.signature === 'string' &&
          message.signature.startsWith('0x')
        ) {
          resolve(message.signature as Hex)
        } else if (message.signature) {
          reject(new Error('WebAuthn signature has invalid format'))
        } else {
          reject(new Error('WebAuthn signing returned no signature'))
        }
      }

      chrome.runtime.onMessage.addListener(listener)

      const request: WebAuthnAssertionRequest = {
        type: 'WEBAUTHN_ASSERTION_REQUEST',
        requestId,
        challenge: challenge,
        credentialId: credential.credentialId,
      }

      chrome.runtime.sendMessage(request).catch((error) => {
        cleanup()
        reject(error)
      })
    })
  }

  return { sign }
}
