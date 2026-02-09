/**
 * Message Validation Schema
 *
 * Runtime validation for messages crossing trust boundaries:
 * - inpage -> content script
 * - content script -> background
 * - background -> content script
 *
 * Prevents malformed or malicious message injection.
 */

import type { ExtensionMessage, MessageType } from '../../types'

/**
 * Maximum allowed message payload size in bytes (1MB)
 */
const MAX_PAYLOAD_SIZE = 1024 * 1024

/**
 * All valid message types as a Set for O(1) lookup
 */
const VALID_MESSAGE_TYPES: ReadonlySet<string> = new Set<string>([
  'RPC_REQUEST',
  'RPC_RESPONSE',
  'STATE_UPDATE',
  'CONNECT_REQUEST',
  'CONNECT_RESPONSE',
  'DISCONNECT',
  'OPEN_POPUP',
  'APPROVAL_REQUEST',
  'APPROVAL_RESPONSE',
  'LOCK',
  'UNLOCK',
  'GET_KEYRING_STATE',
  'KEYRING_STATE',
  'CREATE_NEW_WALLET',
  'WALLET_CREATED',
  'RESTORE_WALLET',
  'WALLET_RESTORED',
  'UNLOCK_WALLET',
  'WALLET_UNLOCKED',
  'LOCK_WALLET',
  'WALLET_LOCKED',
  'IMPORT_PRIVATE_KEY',
  'ACCOUNT_IMPORTED',
  'ADD_HD_ACCOUNT',
  'ACCOUNT_ADDED',
  'GET_MNEMONIC',
  'MNEMONIC',
  'MNEMONIC_ERROR',
  'SET_AUTO_LOCK_TIMEOUT',
  'AUTO_LOCK_TIMEOUT_SET',
  'GET_AUTO_LOCK_TIMEOUT',
  'AUTO_LOCK_TIMEOUT',
  'SET_METAMASK_MODE',
  'METAMASK_MODE_SET',
  'GET_METAMASK_MODE',
  'METAMASK_MODE',
  'GET_APPROVAL',
  'APPROVAL_DATA',
  'APPROVAL_RESULT',
  'ADD_NETWORK',
  'NETWORK_ADDED',
  'NETWORK_ERROR',
  'REMOVE_NETWORK',
  'NETWORK_REMOVED',
  'UPDATE_NETWORK',
  'NETWORK_UPDATED',
  'SELECT_NETWORK',
  'NETWORK_SELECTED',
  'EXPORT_PRIVATE_KEY',
  'PRIVATE_KEY_EXPORTED',
  'PRIVATE_KEY_ERROR',
  'GET_CONNECTED_SITES',
  'CONNECTED_SITES',
  'DISCONNECT_SITE',
  'SITE_DISCONNECTED',
  'GET_LINKED_BANK_ACCOUNTS',
  'LINK_BANK_ACCOUNT',
  'UNLINK_BANK_ACCOUNT',
  'SYNC_BANK_ACCOUNT',
  'BANK_TRANSFER',
  'GET_ONRAMP_ORDERS',
  'GET_ONRAMP_QUOTE',
  'CREATE_ONRAMP_ORDER',
  'CANCEL_ONRAMP_ORDER',
  'GET_PENDING_APPROVALS',
  'APPROVAL_ADDED',
  'APPROVAL_RESOLVED',
  'METAMASK_MODE_CHANGED',
  'PROVIDER_EVENT',
  'GET_TOKEN_BALANCES',
  'TOKEN_BALANCES',
  'GET_TRANSACTION_HISTORY',
  'TRANSACTION_HISTORY',
  'CHECK_INDEXER_STATUS',
  'INDEXER_STATUS',
  'GET_ASSETS',
  'ASSETS',
  'ADD_TOKEN',
  'TOKEN_ADDED',
  'REMOVE_TOKEN',
  'TOKEN_REMOVED',
  'SET_TOKEN_VISIBILITY',
  'TOKEN_VISIBILITY_SET',
])

/**
 * Message types allowed from external (dApp) origins via content script.
 * Only RPC and connection messages should come from untrusted sources.
 */
const EXTERNAL_ALLOWED_TYPES: ReadonlySet<string> = new Set<string>([
  'RPC_REQUEST',
  'CONNECT_REQUEST',
  'DISCONNECT',
])

/**
 * Validate the basic structure of an ExtensionMessage.
 * Returns the validated message or null if invalid.
 */
export function validateExtensionMessage(data: unknown): ExtensionMessage | null {
  if (data === null || data === undefined || typeof data !== 'object') {
    return null
  }

  const msg = data as Record<string, unknown>

  // Validate 'type' field
  if (typeof msg.type !== 'string' || !VALID_MESSAGE_TYPES.has(msg.type)) {
    return null
  }

  // Validate 'id' field
  if (typeof msg.id !== 'string' || msg.id.length === 0 || msg.id.length > 128) {
    return null
  }

  // Validate 'payload' exists (can be any type including undefined for some messages)
  // but must not be a function or symbol
  if (typeof msg.payload === 'function' || typeof msg.payload === 'symbol') {
    return null
  }

  // Size check: prevent oversized messages
  try {
    const serialized = JSON.stringify(msg.payload)
    if (serialized && serialized.length > MAX_PAYLOAD_SIZE) {
      return null
    }
  } catch {
    // Payload contains non-serializable data (BigInt, circular refs, etc.)
    // This is acceptable for internal messages but we still validate structure
  }

  // Validate optional 'origin' field
  if (msg.origin !== undefined && typeof msg.origin !== 'string') {
    return null
  }

  return {
    type: msg.type as MessageType,
    id: msg.id as string,
    payload: msg.payload,
    origin: msg.origin as string | undefined,
  }
}

/**
 * Validate a message from an external (dApp) origin.
 * Only allows message types that external sources should send.
 */
export function validateExternalMessage(data: unknown): ExtensionMessage | null {
  const message = validateExtensionMessage(data)
  if (!message) return null

  if (!EXTERNAL_ALLOWED_TYPES.has(message.type)) {
    return null
  }

  return message
}

/**
 * Validate an RPC request payload structure.
 * Ensures the payload has method and optional params.
 */
export function validateRpcPayload(
  payload: unknown
): { method: string; params?: unknown[]; id?: number | string } | null {
  if (payload === null || payload === undefined || typeof payload !== 'object') {
    return null
  }

  const rpc = payload as Record<string, unknown>

  // method must be a non-empty string
  if (typeof rpc.method !== 'string' || rpc.method.length === 0 || rpc.method.length > 256) {
    return null
  }

  // params must be undefined, null, or an array
  if (rpc.params !== undefined && rpc.params !== null && !Array.isArray(rpc.params)) {
    return null
  }

  // id is optional but must be string or number if present
  if (
    rpc.id !== undefined &&
    rpc.id !== null &&
    typeof rpc.id !== 'string' &&
    typeof rpc.id !== 'number'
  ) {
    return null
  }

  return {
    method: rpc.method as string,
    params: rpc.params as unknown[] | undefined,
    id: rpc.id as number | string | undefined,
  }
}

/**
 * Validate a postMessage envelope from the inpage script.
 * The envelope has a 'target' and 'data' field.
 */
export function validatePostMessageEnvelope(
  eventData: unknown
): { target: string; data: ExtensionMessage } | null {
  if (eventData === null || eventData === undefined || typeof eventData !== 'object') {
    return null
  }

  const envelope = eventData as Record<string, unknown>

  if (typeof envelope.target !== 'string') {
    return null
  }

  // For inpage -> content script messages
  if (envelope.target !== 'stablenet-contentscript') {
    return null
  }

  const message = validateExternalMessage(envelope.data)
  if (!message) {
    return null
  }

  return {
    target: envelope.target,
    data: message,
  }
}
