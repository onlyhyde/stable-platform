/**
 * RPC Errors Tests
 * TDD tests for standardized error handling
 */

import {
  chainDisconnected,
  disconnected,
  internalError,
  invalidParams,
  invalidRequest,
  methodNotFound,
  ProviderRpcError,
  parseError,
  RpcError,
  resourceNotFound,
  transactionRejected,
  unauthorized,
  unsupportedMethod,
  userRejectedRequest,
} from '../../../src/shared/errors/rpcErrors'
import {
  ETH_RPC_ERROR_CODES,
  JSON_RPC_ERROR_CODES,
  PROVIDER_ERROR_CODES,
} from '../../../src/shared/errors/rpcErrors.types'

describe('RpcError', () => {
  describe('constructor', () => {
    it('should create error with code and message', () => {
      const error = new RpcError(-32600, 'Invalid request')

      expect(error.code).toBe(-32600)
      expect(error.message).toBe('Invalid request')
      expect(error.data).toBeUndefined()
    })

    it('should create error with data', () => {
      const error = new RpcError(-32602, 'Invalid params', { param: 'from' })

      expect(error.code).toBe(-32602)
      expect(error.message).toBe('Invalid params')
      expect(error.data).toEqual({ param: 'from' })
    })

    it('should be instance of Error', () => {
      const error = new RpcError(-32603, 'Internal error')

      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(RpcError)
    })

    it('should have correct name', () => {
      const error = new RpcError(-32600, 'Invalid request')

      expect(error.name).toBe('RpcError')
    })
  })

  describe('serialize', () => {
    it('should serialize to JSON-RPC format', () => {
      const error = new RpcError(-32600, 'Invalid request')
      const serialized = error.serialize()

      expect(serialized).toEqual({
        code: -32600,
        message: 'Invalid request',
      })
    })

    it('should include data in serialization', () => {
      const error = new RpcError(-32602, 'Invalid params', { missing: 'to' })
      const serialized = error.serialize()

      expect(serialized).toEqual({
        code: -32602,
        message: 'Invalid params',
        data: { missing: 'to' },
      })
    })
  })

  describe('toJSON', () => {
    it('should be JSON serializable', () => {
      const error = new RpcError(-32600, 'Invalid request')
      const json = JSON.stringify(error)
      const parsed = JSON.parse(json)

      expect(parsed.code).toBe(-32600)
      expect(parsed.message).toBe('Invalid request')
    })
  })
})

describe('ProviderRpcError', () => {
  describe('constructor', () => {
    it('should create provider error with code and message', () => {
      const error = new ProviderRpcError(4001, 'User rejected the request')

      expect(error.code).toBe(4001)
      expect(error.message).toBe('User rejected the request')
    })

    it('should have correct name', () => {
      const error = new ProviderRpcError(4001, 'User rejected')

      expect(error.name).toBe('ProviderRpcError')
    })

    it('should be instance of RpcError', () => {
      const error = new ProviderRpcError(4001, 'User rejected')

      expect(error).toBeInstanceOf(RpcError)
      expect(error).toBeInstanceOf(ProviderRpcError)
    })
  })
})

describe('Error Factory Functions', () => {
  describe('JSON-RPC 2.0 Errors', () => {
    it('parseError should create -32700 error', () => {
      const error = parseError()

      expect(error.code).toBe(JSON_RPC_ERROR_CODES.PARSE_ERROR)
      expect(error.message).toBe('Parse error')
    })

    it('invalidRequest should create -32600 error', () => {
      const error = invalidRequest()

      expect(error.code).toBe(JSON_RPC_ERROR_CODES.INVALID_REQUEST)
      expect(error.message).toBe('Invalid request')
    })

    it('methodNotFound should create -32601 error', () => {
      const error = methodNotFound('eth_unknownMethod')

      expect(error.code).toBe(JSON_RPC_ERROR_CODES.METHOD_NOT_FOUND)
      expect(error.message).toContain('eth_unknownMethod')
    })

    it('invalidParams should create -32602 error', () => {
      const error = invalidParams('Missing required parameter: from')

      expect(error.code).toBe(JSON_RPC_ERROR_CODES.INVALID_PARAMS)
      expect(error.message).toContain('from')
    })

    it('internalError should create -32603 error', () => {
      const error = internalError()

      expect(error.code).toBe(JSON_RPC_ERROR_CODES.INTERNAL_ERROR)
      expect(error.message).toBe('Internal error')
    })

    it('internalError should accept custom message', () => {
      const error = internalError('Database connection failed')

      expect(error.code).toBe(JSON_RPC_ERROR_CODES.INTERNAL_ERROR)
      expect(error.message).toBe('Database connection failed')
    })
  })

  describe('EIP-1193 Provider Errors', () => {
    it('userRejectedRequest should create 4001 error', () => {
      const error = userRejectedRequest()

      expect(error.code).toBe(PROVIDER_ERROR_CODES.USER_REJECTED_REQUEST)
      expect(error.message).toBe('User rejected the request')
    })

    it('unauthorized should create 4100 error', () => {
      const error = unauthorized()

      expect(error.code).toBe(PROVIDER_ERROR_CODES.UNAUTHORIZED)
      expect(error.message).toBe('Unauthorized')
    })

    it('unsupportedMethod should create 4200 error', () => {
      const error = unsupportedMethod('eth_signTransaction')

      expect(error.code).toBe(PROVIDER_ERROR_CODES.UNSUPPORTED_METHOD)
      expect(error.message).toContain('eth_signTransaction')
    })

    it('disconnected should create 4900 error', () => {
      const error = disconnected()

      expect(error.code).toBe(PROVIDER_ERROR_CODES.DISCONNECTED)
      expect(error.message).toBe('Disconnected')
    })

    it('chainDisconnected should create 4901 error', () => {
      const error = chainDisconnected()

      expect(error.code).toBe(PROVIDER_ERROR_CODES.CHAIN_DISCONNECTED)
      expect(error.message).toBe('Chain disconnected')
    })
  })

  describe('EIP-1474 Ethereum RPC Errors', () => {
    it('transactionRejected should create -32003 error', () => {
      const error = transactionRejected()

      expect(error.code).toBe(ETH_RPC_ERROR_CODES.TRANSACTION_REJECTED)
      expect(error.message).toBe('Transaction rejected')
    })

    it('transactionRejected should accept custom message', () => {
      const error = transactionRejected('Insufficient funds')

      expect(error.code).toBe(ETH_RPC_ERROR_CODES.TRANSACTION_REJECTED)
      expect(error.message).toBe('Insufficient funds')
    })

    it('resourceNotFound should create -32001 error', () => {
      const error = resourceNotFound('Block not found')

      expect(error.code).toBe(ETH_RPC_ERROR_CODES.RESOURCE_NOT_FOUND)
      expect(error.message).toBe('Block not found')
    })
  })
})

describe('Error Code Constants', () => {
  it('should have correct JSON-RPC 2.0 error codes', () => {
    expect(JSON_RPC_ERROR_CODES.PARSE_ERROR).toBe(-32700)
    expect(JSON_RPC_ERROR_CODES.INVALID_REQUEST).toBe(-32600)
    expect(JSON_RPC_ERROR_CODES.METHOD_NOT_FOUND).toBe(-32601)
    expect(JSON_RPC_ERROR_CODES.INVALID_PARAMS).toBe(-32602)
    expect(JSON_RPC_ERROR_CODES.INTERNAL_ERROR).toBe(-32603)
  })

  it('should have correct EIP-1193 error codes', () => {
    expect(PROVIDER_ERROR_CODES.USER_REJECTED_REQUEST).toBe(4001)
    expect(PROVIDER_ERROR_CODES.UNAUTHORIZED).toBe(4100)
    expect(PROVIDER_ERROR_CODES.UNSUPPORTED_METHOD).toBe(4200)
    expect(PROVIDER_ERROR_CODES.DISCONNECTED).toBe(4900)
    expect(PROVIDER_ERROR_CODES.CHAIN_DISCONNECTED).toBe(4901)
  })

  it('should have correct EIP-1474 error codes', () => {
    expect(ETH_RPC_ERROR_CODES.INVALID_INPUT).toBe(-32000)
    expect(ETH_RPC_ERROR_CODES.RESOURCE_NOT_FOUND).toBe(-32001)
    expect(ETH_RPC_ERROR_CODES.TRANSACTION_REJECTED).toBe(-32003)
  })
})
