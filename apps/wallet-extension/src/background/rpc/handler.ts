import type { Address, Hex } from 'viem'
import { createPublicClient, http, isAddress } from 'viem'
import type { JsonRpcRequest, JsonRpcResponse, SupportedMethod } from '../../types'
import { RPC_ERRORS } from '../../shared/constants'
import { walletState } from '../state/store'
import { approvalController } from '../controllers/approvalController'
import { keyringController } from '../keyring'

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
   * Returns accounts with the currently selected account first
   */
  eth_accounts: async (_params, origin) => {
    const connectedAccounts = walletState.getConnectedAccounts(origin)
    if (connectedAccounts.length === 0) {
      return []
    }

    // Return connected accounts with selected account first
    const state = walletState.getState()
    const selectedAccount = state.accounts.selectedAccount

    if (selectedAccount && connectedAccounts.includes(selectedAccount)) {
      // Move selected account to first position
      const sorted = [
        selectedAccount,
        ...connectedAccounts.filter((a) => a !== selectedAccount),
      ]
      return sorted
    }

    return connectedAccounts
  },

  /**
   * Request account connection
   * Shows approval popup for user to select accounts
   */
  eth_requestAccounts: async (_params, origin) => {
    const state = walletState.getState()

    // If already connected, return accounts with selected first
    if (walletState.isConnected(origin)) {
      const connectedAccounts = walletState.getConnectedAccounts(origin)
      const selectedAccount = state.accounts.selectedAccount

      if (selectedAccount && connectedAccounts.includes(selectedAccount)) {
        return [
          selectedAccount,
          ...connectedAccounts.filter((a) => a !== selectedAccount),
        ]
      }
      return connectedAccounts
    }

    // If no accounts, return error
    if (state.accounts.accounts.length === 0) {
      throw createRpcError(RPC_ERRORS.UNAUTHORIZED)
    }

    // Request user approval via popup
    try {
      const result = await approvalController.requestConnect(origin)

      // Save connected site with approved accounts
      await walletState.addConnectedSite({
        origin,
        accounts: result.accounts,
        permissions: result.permissions,
        connectedAt: Date.now(),
      })

      // Return accounts with selected account first
      const selectedAccount = state.accounts.selectedAccount
      if (selectedAccount && result.accounts.includes(selectedAccount)) {
        return [
          selectedAccount,
          ...result.accounts.filter((a) => a !== selectedAccount),
        ]
      }

      return result.accounts
    } catch (error) {
      // User rejected or timeout
      throw createRpcError(RPC_ERRORS.USER_REJECTED)
    }
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
   * EIP-191 personal message signing
   */
  personal_sign: async (params, origin) => {
    const [message, address] = params as [Hex, Address]

    // Validate address format
    if (!isAddress(address)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid address format',
      })
    }

    // Verify account is connected (case-insensitive comparison)
    const connectedAccounts = walletState.getConnectedAccounts(origin)
    const normalizedAddress = address.toLowerCase()
    const isAuthorized = connectedAccounts.some(
      (a) => a.toLowerCase() === normalizedAddress
    )
    if (!isAuthorized) {
      throw createRpcError(RPC_ERRORS.UNAUTHORIZED)
    }

    // Check if wallet is unlocked
    if (!keyringController.isUnlocked()) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: 'Wallet is locked',
      })
    }

    // Request user approval
    try {
      const approval = await approvalController.requestSignMessage({
        origin,
        message,
        address,
        method: 'personal_sign',
      })

      if (!approval.approved) {
        throw createRpcError(RPC_ERRORS.USER_REJECTED)
      }
    } catch (error) {
      // If it's already an RPC error, re-throw
      if ((error as { code?: number }).code) {
        throw error
      }
      // Otherwise, it's a timeout or other error
      throw createRpcError(RPC_ERRORS.USER_REJECTED)
    }

    // Sign the message
    try {
      const signature = await keyringController.signMessage(address, message)
      return signature
    } catch (error) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'Signing failed',
      })
    }
  },

  /**
   * Sign typed data (EIP-712)
   */
  eth_signTypedData_v4: async (params, origin) => {
    const [address, typedDataString] = params as [Address, string]

    // Validate address format
    if (!isAddress(address)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid address format',
      })
    }

    // Parse typed data
    let typedData: unknown
    try {
      typedData = JSON.parse(typedDataString)
    } catch {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid typed data: must be valid JSON',
      })
    }

    // Verify account is connected (case-insensitive)
    const connectedAccounts = walletState.getConnectedAccounts(origin)
    const normalizedAddress = address.toLowerCase()
    const isAuthorized = connectedAccounts.some(
      (a) => a.toLowerCase() === normalizedAddress
    )
    if (!isAuthorized) {
      throw createRpcError(RPC_ERRORS.UNAUTHORIZED)
    }

    // Check if wallet is unlocked
    if (!keyringController.isUnlocked()) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: 'Wallet is locked',
      })
    }

    // Request user approval
    try {
      const approval = await approvalController.requestSignTypedData({
        origin,
        address,
        typedData,
        method: 'eth_signTypedData_v4',
      })

      if (!approval.approved) {
        throw createRpcError(RPC_ERRORS.USER_REJECTED)
      }
    } catch (error) {
      if ((error as { code?: number }).code) {
        throw error
      }
      throw createRpcError(RPC_ERRORS.USER_REJECTED)
    }

    // Sign the typed data
    try {
      const signature = await keyringController.signTypedData(address, typedData)
      return signature
    } catch (error) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'Signing failed',
      })
    }
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

  /**
   * Send a transaction
   * Signs and broadcasts a transaction to the network
   */
  eth_sendTransaction: async (params, origin) => {
    const [txParams] = params as [
      {
        from?: Address
        to?: Address
        value?: string
        data?: Hex
        gas?: string
        gasPrice?: string
        maxFeePerGas?: string
        maxPriorityFeePerGas?: string
        nonce?: string
      }
    ]

    // Validate required 'from' field
    if (!txParams.from) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Missing required field: from',
      })
    }

    // Validate 'from' address format
    if (!isAddress(txParams.from)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid from address format',
      })
    }

    // Validate 'to' address format if provided
    if (txParams.to && !isAddress(txParams.to)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid to address format',
      })
    }

    // Verify site is connected and account is authorized
    const connectedAccounts = walletState.getConnectedAccounts(origin)
    if (connectedAccounts.length === 0) {
      throw createRpcError(RPC_ERRORS.UNAUTHORIZED)
    }

    const normalizedFrom = txParams.from.toLowerCase()
    const isAuthorized = connectedAccounts.some(
      (a) => a.toLowerCase() === normalizedFrom
    )
    if (!isAuthorized) {
      throw createRpcError(RPC_ERRORS.UNAUTHORIZED)
    }

    // Check if wallet is unlocked
    if (!keyringController.isUnlocked()) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: 'Wallet is locked',
      })
    }

    // Check network is selected
    const network = walletState.getCurrentNetwork()
    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    // Create public client for gas estimation and broadcasting
    const client = createPublicClient({
      transport: http(network.rpcUrl),
    })

    // Get nonce if not provided
    let nonce = txParams.nonce ? Number.parseInt(txParams.nonce, 16) : undefined
    if (nonce === undefined) {
      nonce = await client.getTransactionCount({ address: txParams.from })
    }

    // Estimate gas if not provided
    let gas = txParams.gas ? BigInt(txParams.gas) : undefined
    if (!gas) {
      try {
        gas = await client.estimateGas({
          account: txParams.from,
          to: txParams.to,
          value: txParams.value ? BigInt(txParams.value) : undefined,
          data: txParams.data,
        })
      } catch {
        gas = BigInt(21000) // Default gas for simple transfers
      }
    }

    // Get gas price if not provided
    let gasPrice = txParams.gasPrice ? BigInt(txParams.gasPrice) : undefined
    let maxFeePerGas = txParams.maxFeePerGas
      ? BigInt(txParams.maxFeePerGas)
      : undefined
    let maxPriorityFeePerGas = txParams.maxPriorityFeePerGas
      ? BigInt(txParams.maxPriorityFeePerGas)
      : undefined

    // If no gas price params, get current gas price
    if (!gasPrice && !maxFeePerGas) {
      gasPrice = await client.getGasPrice()
    }

    // Calculate estimated gas cost
    const estimatedGasCost = gas * (maxFeePerGas ?? gasPrice ?? BigInt(0))

    // Request user approval
    try {
      await approvalController.requestTransaction(
        origin,
        txParams.from,
        txParams.to ?? ('0x' as Address), // Contract deployment if no 'to'
        txParams.value ? BigInt(txParams.value) : BigInt(0),
        txParams.data,
        estimatedGasCost,
        undefined, // methodName
        undefined // favicon
      )
    } catch (error) {
      throw createRpcError(RPC_ERRORS.USER_REJECTED)
    }

    // Build transaction object for signing
    const transaction = {
      to: txParams.to,
      value: txParams.value ? BigInt(txParams.value) : BigInt(0),
      data: txParams.data,
      gas,
      nonce,
      chainId: network.chainId,
      ...(maxFeePerGas
        ? {
            maxFeePerGas,
            maxPriorityFeePerGas: maxPriorityFeePerGas ?? maxFeePerGas,
            type: 'eip1559' as const,
          }
        : {
            gasPrice: gasPrice ?? BigInt(0),
          }),
    }

    // Sign transaction
    let signedTx: Hex
    try {
      signedTx = await keyringController.signTransaction(txParams.from, transaction)
    } catch (error) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'Transaction signing failed',
      })
    }

    // Broadcast transaction
    try {
      const txHash = await client.sendRawTransaction({
        serializedTransaction: signedTx,
      })
      return txHash
    } catch (error) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'Transaction broadcast failed',
      })
    }
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
