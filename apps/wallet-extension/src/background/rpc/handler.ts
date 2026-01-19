import type { Address, Hex } from 'viem'
import { createPublicClient, http } from 'viem'
import type { JsonRpcRequest, JsonRpcResponse, SupportedMethod } from '../../types'
import { RPC_ERRORS } from '../../shared/constants'
import { walletState } from '../state/store'

type RpcHandler = (
  params: unknown[] | undefined,
  origin: string
) => Promise<unknown>

/**
 * RPC method handlers
 */
const handlers: Record<string, RpcHandler> = {
  /**
   * Get connected accounts
   */
  eth_accounts: async (_params, origin) => {
    return walletState.getConnectedAccounts(origin)
  },

  /**
   * Request account connection
   */
  eth_requestAccounts: async (_params, origin) => {
    const state = walletState.getState()

    // If already connected, return accounts
    if (walletState.isConnected(origin)) {
      return walletState.getConnectedAccounts(origin)
    }

    // If no accounts, return empty
    if (state.accounts.accounts.length === 0) {
      throw createRpcError(RPC_ERRORS.UNAUTHORIZED)
    }

    // Auto-approve for now (in production, show popup)
    const accounts = state.accounts.accounts.map((a) => a.address)
    await walletState.addConnectedSite({
      origin,
      accounts,
      permissions: ['eth_accounts'],
      connectedAt: Date.now(),
    })

    return accounts
  },

  /**
   * Get current chain ID
   */
  eth_chainId: async () => {
    const network = walletState.getCurrentNetwork()
    return network ? `0x${network.chainId.toString(16)}` : null
  },

  /**
   * Switch to a different chain
   */
  wallet_switchEthereumChain: async (params) => {
    const [{ chainId }] = params as [{ chainId: string }]
    const targetChainId = Number.parseInt(chainId, 16)

    const state = walletState.getState()
    const network = state.networks.networks.find((n) => n.chainId === targetChainId)

    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    await walletState.selectNetwork(targetChainId)
    return null
  },

  /**
   * Get account balance
   */
  eth_getBalance: async (params) => {
    const [address, _block] = params as [Address, string]
    const network = walletState.getCurrentNetwork()

    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    const client = createPublicClient({
      transport: http(network.rpcUrl),
    })

    const balance = await client.getBalance({ address })
    return `0x${balance.toString(16)}`
  },

  /**
   * Make a read-only call
   */
  eth_call: async (params) => {
    const [callObject, _block] = params as [
      { to: Address; data?: Hex; from?: Address; value?: Hex },
      string
    ]
    const network = walletState.getCurrentNetwork()

    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    const client = createPublicClient({
      transport: http(network.rpcUrl),
    })

    const result = await client.call({
      to: callObject.to,
      data: callObject.data,
      account: callObject.from,
    })

    return result.data ?? '0x'
  },

  /**
   * Get current block number
   */
  eth_blockNumber: async () => {
    const network = walletState.getCurrentNetwork()

    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    const client = createPublicClient({
      transport: http(network.rpcUrl),
    })

    const blockNumber = await client.getBlockNumber()
    return `0x${blockNumber.toString(16)}`
  },

  /**
   * Sign a message (personal_sign)
   */
  personal_sign: async (params, origin) => {
    const [_message, address] = params as [Hex, Address]

    // Verify account is connected
    const connectedAccounts = walletState.getConnectedAccounts(origin)
    if (!connectedAccounts.includes(address)) {
      throw createRpcError(RPC_ERRORS.UNAUTHORIZED)
    }

    // TODO: Implement actual signing with keyring
    // For now, return a placeholder
    throw createRpcError({
      code: -32000,
      message: 'Signing not yet implemented',
    })
  },

  /**
   * Sign typed data (EIP-712)
   */
  eth_signTypedData_v4: async (params, origin) => {
    const [address] = params as [Address, string]

    // Verify account is connected
    const connectedAccounts = walletState.getConnectedAccounts(origin)
    if (!connectedAccounts.includes(address)) {
      throw createRpcError(RPC_ERRORS.UNAUTHORIZED)
    }

    // TODO: Implement actual signing with keyring
    throw createRpcError({
      code: -32000,
      message: 'Signing not yet implemented',
    })
  },

  /**
   * Send a UserOperation (ERC-4337)
   */
  eth_sendUserOperation: async (params, origin) => {
    const [_userOp, _entryPoint] = params as [unknown, Address]

    // Verify connection
    if (!walletState.isConnected(origin)) {
      throw createRpcError(RPC_ERRORS.UNAUTHORIZED)
    }

    // TODO: Implement UserOperation submission
    throw createRpcError({
      code: -32000,
      message: 'UserOperation submission not yet implemented',
    })
  },

  /**
   * Estimate gas for a UserOperation
   */
  eth_estimateUserOperationGas: async (params) => {
    const [_userOp, _entryPoint] = params as [unknown, Address]
    const network = walletState.getCurrentNetwork()

    if (!network?.bundlerUrl) {
      throw createRpcError(RPC_ERRORS.RESOURCE_UNAVAILABLE)
    }

    // TODO: Forward to bundler
    throw createRpcError({
      code: -32000,
      message: 'Gas estimation not yet implemented',
    })
  },
}

/**
 * Create an RPC error
 */
function createRpcError(error: { code: number; message: string; data?: unknown }) {
  const err = new Error(error.message) as Error & {
    code: number
    data?: unknown
  }
  err.code = error.code
  err.data = error.data
  return err
}

/**
 * Handle an RPC request
 */
export async function handleRpcRequest(
  request: JsonRpcRequest,
  origin: string
): Promise<JsonRpcResponse> {
  const { id, method, params } = request

  try {
    const handler = handlers[method]

    if (!handler) {
      throw createRpcError(RPC_ERRORS.METHOD_NOT_FOUND)
    }

    const result = await handler(params, origin)

    return {
      jsonrpc: '2.0',
      id,
      result,
    }
  } catch (error) {
    const err = error as Error & { code?: number; data?: unknown }

    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: err.code ?? RPC_ERRORS.INTERNAL_ERROR.code,
        message: err.message ?? RPC_ERRORS.INTERNAL_ERROR.message,
        data: err.data,
      },
    }
  }
}

/**
 * Check if a method is supported
 */
export function isMethodSupported(method: string): method is SupportedMethod {
  return method in handlers
}
