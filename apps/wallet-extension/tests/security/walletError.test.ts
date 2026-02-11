/**
 * WalletError Tests
 *
 * Tests error handling utilities: WalletError class, isRpcLikeError, handleApprovalError.
 */

import {
  handleApprovalError,
  isRpcLikeError,
  WalletError,
} from '../../src/shared/errors/WalletError'

describe('WalletError', () => {
  it('should create error with code and message', () => {
    const err = new WalletError(4001, 'User rejected')
    expect(err.code).toBe(4001)
    expect(err.message).toBe('User rejected')
    expect(err.name).toBe('WalletError')
    expect(err).toBeInstanceOf(Error)
  })

  it('should preserve cause chain', () => {
    const cause = new Error('original error')
    const err = new WalletError(4001, 'Wrapped', { cause })
    expect(err.cause).toBe(cause)
  })

  it('should ignore non-Error cause', () => {
    const err = new WalletError(4001, 'Wrapped', { cause: 'string cause' })
    expect(err.cause).toBeUndefined()
  })

  it('should store context metadata', () => {
    const err = new WalletError(4001, 'Test', {
      context: { method: 'personal_sign', origin: 'https://example.com' },
    })
    expect(err.context.method).toBe('personal_sign')
    expect(err.context.origin).toBe('https://example.com')
  })

  it('should convert to RPC error format', () => {
    const err = new WalletError(-32603, 'Internal error', {
      context: { method: 'eth_sendTransaction' },
    })
    const rpc = err.toRpcError()
    expect(rpc.code).toBe(-32603)
    expect(rpc.message).toBe('Internal error')
    expect(rpc.data).toEqual({ method: 'eth_sendTransaction' })
  })

  it('should omit data when no method context', () => {
    const err = new WalletError(4001, 'Rejected')
    const rpc = err.toRpcError()
    expect(rpc.data).toBeUndefined()
  })
})

describe('isRpcLikeError', () => {
  it('should detect objects with numeric code', () => {
    expect(isRpcLikeError({ code: 4001, message: 'rejected' })).toBe(true)
    expect(isRpcLikeError({ code: -32603, message: 'internal' })).toBe(true)
  })

  it('should reject objects without code', () => {
    expect(isRpcLikeError({ message: 'no code' })).toBe(false)
    expect(isRpcLikeError(new Error('plain error'))).toBe(false)
  })

  it('should reject non-numeric code', () => {
    expect(isRpcLikeError({ code: 'string', message: 'test' })).toBe(false)
  })

  it('should reject primitives and null', () => {
    expect(isRpcLikeError(null)).toBe(false)
    expect(isRpcLikeError(undefined)).toBe(false)
    expect(isRpcLikeError('error')).toBe(false)
    expect(isRpcLikeError(42)).toBe(false)
  })
})

describe('handleApprovalError', () => {
  it('should re-throw RPC-coded errors as-is', () => {
    const rpcError = { code: 4001, message: 'User rejected the request' }
    expect(() => handleApprovalError(rpcError)).toThrow()
    try {
      handleApprovalError(rpcError)
    } catch (e) {
      expect(e).toBe(rpcError) // Same reference
    }
  })

  it('should wrap non-RPC errors as WalletError with USER_REJECTED', () => {
    const plainError = new Error('timeout')
    try {
      handleApprovalError(plainError, { method: 'eth_sendTransaction' })
    } catch (e) {
      expect(e).toBeInstanceOf(WalletError)
      const walletErr = e as WalletError
      expect(walletErr.code).toBe(4001)
      expect(walletErr.cause).toBe(plainError)
      expect(walletErr.context.method).toBe('eth_sendTransaction')
    }
  })

  it('should wrap string errors', () => {
    try {
      handleApprovalError('some string error')
    } catch (e) {
      expect(e).toBeInstanceOf(WalletError)
      expect((e as WalletError).code).toBe(4001)
    }
  })

  it('should always throw (return type is never)', () => {
    expect(() => handleApprovalError(new Error('test'))).toThrow()
  })
})
