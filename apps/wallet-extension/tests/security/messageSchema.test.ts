/**
 * Message Schema Validation Tests
 *
 * Tests runtime validation for messages crossing trust boundaries.
 */

import {
  validateExtensionMessage,
  validateExternalMessage,
  validatePostMessageEnvelope,
  validateRpcPayload,
} from '../../src/shared/validation/messageSchema'

describe('validateExtensionMessage', () => {
  const validMessage = {
    type: 'RPC_REQUEST',
    id: 'msg-123',
    payload: { method: 'eth_chainId' },
  }

  it('should accept valid messages', () => {
    const result = validateExtensionMessage(validMessage)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('RPC_REQUEST')
    expect(result!.id).toBe('msg-123')
  })

  it('should reject null/undefined/primitives', () => {
    expect(validateExtensionMessage(null)).toBeNull()
    expect(validateExtensionMessage(undefined)).toBeNull()
    expect(validateExtensionMessage('string')).toBeNull()
    expect(validateExtensionMessage(42)).toBeNull()
    expect(validateExtensionMessage(true)).toBeNull()
  })

  it('should reject invalid type field', () => {
    expect(validateExtensionMessage({ ...validMessage, type: 'INVALID_TYPE' })).toBeNull()
    expect(validateExtensionMessage({ ...validMessage, type: 123 })).toBeNull()
    expect(validateExtensionMessage({ ...validMessage, type: '' })).toBeNull()
  })

  it('should reject invalid id field', () => {
    expect(validateExtensionMessage({ ...validMessage, id: '' })).toBeNull()
    expect(validateExtensionMessage({ ...validMessage, id: 123 })).toBeNull()
    expect(validateExtensionMessage({ ...validMessage, id: 'a'.repeat(129) })).toBeNull()
  })

  it('should reject function/symbol payload', () => {
    expect(validateExtensionMessage({ ...validMessage, payload: () => {} })).toBeNull()
    expect(validateExtensionMessage({ ...validMessage, payload: Symbol('test') })).toBeNull()
  })

  it('should accept undefined payload', () => {
    const result = validateExtensionMessage({ type: 'LOCK', id: 'msg-1', payload: undefined })
    expect(result).not.toBeNull()
  })

  it('should reject oversized payload', () => {
    const huge = { data: 'x'.repeat(1024 * 1024 + 1) }
    expect(validateExtensionMessage({ ...validMessage, payload: huge })).toBeNull()
  })

  it('should accept optional origin if string', () => {
    const result = validateExtensionMessage({ ...validMessage, origin: 'https://example.com' })
    expect(result).not.toBeNull()
    expect(result!.origin).toBe('https://example.com')
  })

  it('should reject non-string origin', () => {
    expect(validateExtensionMessage({ ...validMessage, origin: 123 })).toBeNull()
  })

  it('should accept all valid internal message types', () => {
    const internalTypes = [
      'STATE_UPDATE',
      'LOCK',
      'UNLOCK',
      'GET_KEYRING_STATE',
      'KEYRING_STATE',
      'CREATE_NEW_WALLET',
      'WALLET_CREATED',
    ]
    for (const type of internalTypes) {
      const result = validateExtensionMessage({ type, id: 'msg-1', payload: null })
      expect(result).not.toBeNull()
    }
  })
})

describe('validateExternalMessage', () => {
  it('should accept allowed external types', () => {
    const types = ['RPC_REQUEST', 'CONNECT_REQUEST', 'DISCONNECT']
    for (const type of types) {
      const result = validateExternalMessage({ type, id: 'msg-1', payload: null })
      expect(result).not.toBeNull()
      expect(result!.type).toBe(type)
    }
  })

  it('should reject internal-only types from external sources', () => {
    const internalTypes = [
      'LOCK',
      'UNLOCK',
      'CREATE_NEW_WALLET',
      'GET_MNEMONIC',
      'EXPORT_PRIVATE_KEY',
      'IMPORT_PRIVATE_KEY',
      'STATE_UPDATE',
    ]
    for (const type of internalTypes) {
      const result = validateExternalMessage({ type, id: 'msg-1', payload: null })
      expect(result).toBeNull()
    }
  })

  it('should reject structurally invalid messages', () => {
    expect(validateExternalMessage({ type: 'RPC_REQUEST', id: '', payload: null })).toBeNull()
  })
})

describe('validateRpcPayload', () => {
  it('should accept valid RPC payload', () => {
    const result = validateRpcPayload({ method: 'eth_chainId', params: [], id: 1 })
    expect(result).not.toBeNull()
    expect(result!.method).toBe('eth_chainId')
  })

  it('should accept payload without params', () => {
    const result = validateRpcPayload({ method: 'eth_chainId' })
    expect(result).not.toBeNull()
    expect(result!.params).toBeUndefined()
  })

  it('should reject null params that are not array', () => {
    const result = validateRpcPayload({ method: 'eth_call', params: { to: '0x' } })
    expect(result).toBeNull()
  })

  it('should reject non-object input', () => {
    expect(validateRpcPayload(null)).toBeNull()
    expect(validateRpcPayload('test')).toBeNull()
    expect(validateRpcPayload(42)).toBeNull()
  })

  it('should reject empty or missing method', () => {
    expect(validateRpcPayload({ method: '' })).toBeNull()
    expect(validateRpcPayload({ params: [] })).toBeNull()
  })

  it('should reject oversized method name', () => {
    expect(validateRpcPayload({ method: 'x'.repeat(257) })).toBeNull()
  })

  it('should reject invalid id types', () => {
    expect(validateRpcPayload({ method: 'eth_call', id: true })).toBeNull()
    expect(validateRpcPayload({ method: 'eth_call', id: {} })).toBeNull()
  })

  it('should accept string and number ids', () => {
    expect(validateRpcPayload({ method: 'eth_call', id: 'abc' })).not.toBeNull()
    expect(validateRpcPayload({ method: 'eth_call', id: 42 })).not.toBeNull()
  })
})

describe('validatePostMessageEnvelope', () => {
  const validEnvelope = {
    target: 'stablenet-contentscript',
    data: {
      type: 'RPC_REQUEST',
      id: 'msg-1',
      payload: { method: 'eth_chainId' },
    },
  }

  it('should accept valid envelope', () => {
    const result = validatePostMessageEnvelope(validEnvelope)
    expect(result).not.toBeNull()
    expect(result!.target).toBe('stablenet-contentscript')
    expect(result!.data.type).toBe('RPC_REQUEST')
  })

  it('should reject wrong target', () => {
    expect(validatePostMessageEnvelope({ ...validEnvelope, target: 'stablenet-inpage' })).toBeNull()
    expect(validatePostMessageEnvelope({ ...validEnvelope, target: 'unknown' })).toBeNull()
  })

  it('should reject non-external message types in envelope', () => {
    const internal = {
      target: 'stablenet-contentscript',
      data: { type: 'LOCK', id: 'msg-1', payload: null },
    }
    expect(validatePostMessageEnvelope(internal)).toBeNull()
  })

  it('should reject non-object input', () => {
    expect(validatePostMessageEnvelope(null)).toBeNull()
    expect(validatePostMessageEnvelope('test')).toBeNull()
  })

  it('should reject missing target', () => {
    expect(validatePostMessageEnvelope({ data: validEnvelope.data })).toBeNull()
  })
})
