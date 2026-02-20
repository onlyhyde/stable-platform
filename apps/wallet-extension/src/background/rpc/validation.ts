/**
 * RPC parameter validation
 *
 * Extracted from handler.ts to reduce file size and improve maintainability.
 */

import { InputValidator, type TransactionObject } from '@stablenet/core'
import { RPC_ERRORS } from '../../shared/constants'
import { createRpcError } from './utils'

const inputValidator = new InputValidator()

/**
 * Validate RPC request parameters based on method
 */
export function validateRpcParams(method: string, params: unknown[] | undefined): void {
  // Validate params is an array if present
  if (params !== undefined && !Array.isArray(params)) {
    throw createRpcError({
      code: RPC_ERRORS.INVALID_PARAMS.code,
      message: 'Params must be an array',
    })
  }

  // Method-specific validation
  switch (method) {
    case 'personal_sign': {
      if (!params || params.length < 2) {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: 'personal_sign requires [message, address] params',
        })
      }
      const [message, address] = params as [unknown, unknown]
      // Validate message is a hex string
      if (typeof message !== 'string') {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: 'Message must be a string',
        })
      }
      const hexResult = inputValidator.validateHex(message)
      if (!hexResult.isValid) {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: `Invalid message: ${hexResult.errors.join(', ')}`,
        })
      }
      // Validate address
      if (typeof address !== 'string') {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: 'Address must be a string',
        })
      }
      const addrResult = inputValidator.validateAddress(address)
      if (!addrResult.isValid) {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: `Invalid address: ${addrResult.errors.join(', ')}`,
        })
      }
      break
    }

    case 'eth_signTypedData_v4': {
      if (!params || params.length < 2) {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: 'eth_signTypedData_v4 requires [address, typedData] params',
        })
      }
      const [address, typedData] = params as [unknown, unknown]
      // Validate address
      if (typeof address !== 'string') {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: 'Address must be a string',
        })
      }
      const addrResult = inputValidator.validateAddress(address)
      if (!addrResult.isValid) {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: `Invalid address: ${addrResult.errors.join(', ')}`,
        })
      }
      // Validate typed data is a string (JSON)
      if (typeof typedData !== 'string') {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: 'Typed data must be a JSON string',
        })
      }
      break
    }

    case 'eth_sendTransaction': {
      if (!params || params.length < 1) {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: 'eth_sendTransaction requires transaction object',
        })
      }
      const [txParams] = params as [unknown]
      if (!txParams || typeof txParams !== 'object') {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: 'Transaction must be an object',
        })
      }
      const txResult = inputValidator.validateTransaction(txParams as TransactionObject)
      if (!txResult.isValid) {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: `Invalid transaction: ${txResult.errors.join(', ')}`,
        })
      }
      break
    }

    case 'wallet_switchEthereumChain': {
      if (!params || params.length < 1) {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: 'wallet_switchEthereumChain requires chainId param',
        })
      }
      const [chainParam] = params as [unknown]
      if (!chainParam || typeof chainParam !== 'object') {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: 'Chain parameter must be an object with chainId',
        })
      }
      const { chainId } = chainParam as { chainId?: unknown }
      if (!chainId) {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: 'Missing chainId',
        })
      }
      const chainResult = inputValidator.validateChainId(chainId)
      if (!chainResult.isValid) {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: `Invalid chainId: ${chainResult.errors.join(', ')}`,
        })
      }
      break
    }

    case 'eth_getBalance': {
      if (!params || params.length < 1) {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: 'eth_getBalance requires [address, block] params',
        })
      }
      const [address] = params as [unknown]
      if (typeof address !== 'string') {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: 'Address must be a string',
        })
      }
      const addrResult = inputValidator.validateAddress(address)
      if (!addrResult.isValid) {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: `Invalid address: ${addrResult.errors.join(', ')}`,
        })
      }
      break
    }

    case 'eth_call': {
      if (!params || params.length < 1) {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: 'eth_call requires call object',
        })
      }
      const [callObj] = params as [unknown]
      if (!callObj || typeof callObj !== 'object') {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: 'Call object must be an object',
        })
      }
      const { to, from, data } = callObj as { to?: unknown; from?: unknown; data?: unknown }
      if (to) {
        if (typeof to !== 'string') {
          throw createRpcError({
            code: RPC_ERRORS.INVALID_PARAMS.code,
            message: 'To address must be a string',
          })
        }
        const toResult = inputValidator.validateAddress(to)
        if (!toResult.isValid) {
          throw createRpcError({
            code: RPC_ERRORS.INVALID_PARAMS.code,
            message: `Invalid to address: ${toResult.errors.join(', ')}`,
          })
        }
      }
      if (from) {
        if (typeof from !== 'string') {
          throw createRpcError({
            code: RPC_ERRORS.INVALID_PARAMS.code,
            message: 'From address must be a string',
          })
        }
        const fromResult = inputValidator.validateAddress(from)
        if (!fromResult.isValid) {
          throw createRpcError({
            code: RPC_ERRORS.INVALID_PARAMS.code,
            message: `Invalid from address: ${fromResult.errors.join(', ')}`,
          })
        }
      }
      if (data) {
        if (typeof data !== 'string') {
          throw createRpcError({
            code: RPC_ERRORS.INVALID_PARAMS.code,
            message: 'Data must be a hex string',
          })
        }
        const dataResult = inputValidator.validateHex(data)
        if (!dataResult.isValid) {
          throw createRpcError({
            code: RPC_ERRORS.INVALID_PARAMS.code,
            message: `Invalid data: ${dataResult.errors.join(', ')}`,
          })
        }
      }
      break
    }

    case 'eth_sendUserOperation':
    case 'eth_estimateUserOperationGas': {
      if (!params || params.length < 1) {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: `${method} requires UserOperation object`,
        })
      }
      const [userOp, entryPoint] = params as [unknown, unknown]
      if (!userOp || typeof userOp !== 'object') {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: 'UserOperation must be an object',
        })
      }
      const { sender } = userOp as { sender?: unknown }
      if (sender) {
        if (typeof sender !== 'string') {
          throw createRpcError({
            code: RPC_ERRORS.INVALID_PARAMS.code,
            message: 'Sender must be a string',
          })
        }
        const senderResult = inputValidator.validateAddress(sender)
        if (!senderResult.isValid) {
          throw createRpcError({
            code: RPC_ERRORS.INVALID_PARAMS.code,
            message: `Invalid sender: ${senderResult.errors.join(', ')}`,
          })
        }
      }
      if (entryPoint) {
        if (typeof entryPoint !== 'string') {
          throw createRpcError({
            code: RPC_ERRORS.INVALID_PARAMS.code,
            message: 'EntryPoint must be a string',
          })
        }
        const epResult = inputValidator.validateAddress(entryPoint)
        if (!epResult.isValid) {
          throw createRpcError({
            code: RPC_ERRORS.INVALID_PARAMS.code,
            message: `Invalid entryPoint: ${epResult.errors.join(', ')}`,
          })
        }
      }
      break
    }

    case 'eth_getUserOperationByHash':
    case 'eth_getUserOperationReceipt':
    case 'debug_bundler_getUserOperationStatus': {
      if (!params || params.length < 1) {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: `${method} requires userOpHash`,
        })
      }
      const [hash] = params as [unknown]
      if (typeof hash !== 'string') {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: 'UserOpHash must be a string',
        })
      }
      const hashResult = inputValidator.validateHex(hash, { exactLength: 66 })
      if (!hashResult.isValid) {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: `Invalid userOpHash: ${hashResult.errors.join(', ')}`,
        })
      }
      break
    }

    // Methods that don't require params validation
    case 'eth_accounts':
    case 'eth_requestAccounts':
    case 'eth_chainId':
    case 'eth_blockNumber':
    case 'eth_supportedEntryPoints':
    case 'eth_gasPrice':
    case 'eth_maxPriorityFeePerGas':
    case 'eth_feeHistory':
    case 'eth_estimateGas':
    case 'eth_getTransactionCount':
    case 'eth_sendRawTransaction':
    case 'net_version':
    case 'wallet_requestPermissions':
    case 'wallet_getPermissions':
      break

    case 'stablenet_getSmartAccountInfo':
    case 'stablenet_getRegistryModules':
    case 'stablenet_speedUpTransaction':
    case 'stablenet_cancelTransaction':
    case 'stablenet_setRootValidator':
    case 'stablenet_executeSwap':
    case 'stablenet_estimateGas':
      break

    case 'pm_registerAccount':
    case 'pm_accountStatus': {
      if (!params || params.length < 1) {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: `${method} requires parameters`,
        })
      }
      const [pmParams] = params as [unknown]
      if (!pmParams || typeof pmParams !== 'object') {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: 'Parameters must be an object with account and chainId',
        })
      }
      const { account: pmAccount } = pmParams as { account?: unknown }
      if (!pmAccount || typeof pmAccount !== 'string') {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: 'Account address is required',
        })
      }
      const pmAddrResult = inputValidator.validateAddress(pmAccount)
      if (!pmAddrResult.isValid) {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: `Invalid account: ${pmAddrResult.errors.join(', ')}`,
        })
      }
      break
    }

    case 'stablenet_installModule':
    case 'stablenet_uninstallModule': {
      if (!params || params.length < 1) {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: `${method} requires module parameters`,
        })
      }
      const [moduleParams] = params as [unknown]
      if (!moduleParams || typeof moduleParams !== 'object') {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: 'Module parameters must be an object',
        })
      }
      const { account, moduleAddress, moduleType, chainId } = moduleParams as {
        account?: unknown
        moduleAddress?: unknown
        moduleType?: unknown
        chainId?: unknown
      }
      if (!account || typeof account !== 'string') {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: 'Account address is required',
        })
      }
      const accountResult = inputValidator.validateAddress(account)
      if (!accountResult.isValid) {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: `Invalid account: ${accountResult.errors.join(', ')}`,
        })
      }
      if (!moduleAddress || typeof moduleAddress !== 'string') {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: 'Module address is required',
        })
      }
      const moduleResult = inputValidator.validateAddress(moduleAddress)
      if (!moduleResult.isValid) {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: `Invalid module address: ${moduleResult.errors.join(', ')}`,
        })
      }
      if (moduleType === undefined || moduleType === null) {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: 'Module type is required',
        })
      }
      if (chainId === undefined || chainId === null) {
        throw createRpcError({
          code: RPC_ERRORS.INVALID_PARAMS.code,
          message: 'Chain ID is required',
        })
      }
      break
    }

    default:
      // Unknown method - let handler deal with it
      break
  }
}
