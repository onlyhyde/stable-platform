import type { Address, Hex } from 'viem'
import { createPublicClient, http, isAddress } from 'viem'
import type { JsonRpcRequest, JsonRpcResponse, SupportedMethod } from '../../types'
import { RPC_ERRORS, ENTRY_POINT_ADDRESSES } from '../../shared/constants'
import { walletState } from '../state/store'
import { approvalController } from '../controllers/approvalController'
import { keyringController } from '../keyring'
import { createBundlerClient } from '../../lib/bundler'
import {
  packUserOperation,
  getUserOpHash,
  type UserOperation,
  type PackedUserOperation,
} from '../../lib/userOp'
import { eventBroadcaster } from '../utils/eventBroadcaster'
import {
  InputValidator,
  type TransactionObject,
} from '../../shared/security/inputValidator'
import { rateLimiter } from '../../shared/security/rateLimiter'
import { typedDataValidator } from '../../shared/security/typedDataValidator'
import {
  createAuthorization,
  createAuthorizationHash,
  createSignedAuthorization,
} from '../../shared/utils/eip7702'

// Singleton validator instance
const inputValidator = new InputValidator()

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

      // Get current chain ID for connect event
      const network = walletState.getCurrentNetwork()
      const chainIdHex = network ? `0x${network.chainId.toString(16)}` : '0x1'

      // Broadcast connect event (EIP-1193)
      await eventBroadcaster.broadcastConnect(origin, chainIdHex)

      // Broadcast accountsChanged with the connected accounts
      await eventBroadcaster.broadcastAccountsChanged(origin, result.accounts)

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

    // Validate typed data domain (SEC-5)
    const currentNetwork = walletState.getCurrentNetwork()
    const currentChainId = currentNetwork?.chainId ?? 1
    const domainValidation = typedDataValidator.validateTypedData(
      typedData,
      currentChainId,
      origin
    )

    // Reject if typed data structure is invalid
    if (!domainValidation.isValid) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: `Invalid typed data: ${domainValidation.errors.join(', ')}`,
      })
    }

    // Get risk level and formatted warnings for approval UI
    const riskLevel = typedDataValidator.getRiskLevel(domainValidation.warnings)
    const warningMessages = typedDataValidator.formatWarningsForDisplay(
      domainValidation.warnings
    )

    // Request user approval with domain validation results
    try {
      const approval = await approvalController.requestSignTypedData({
        origin,
        address,
        typedData,
        method: 'eth_signTypedData_v4',
        domainValidation: {
          warnings: domainValidation.warnings,
          riskLevel,
          warningMessages,
        },
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
   * Sign EIP-7702 Authorization (wallet_signAuthorization)
   * Allows EOAs to delegate to smart contract implementations
   */
  wallet_signAuthorization: async (params, origin) => {
    const [authRequest] = params as [{
      account: Address
      contractAddress: Address
      chainId?: number | string
      nonce?: number | string
    }]

    if (!authRequest || !authRequest.account || !authRequest.contractAddress) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Missing required parameters: account and contractAddress',
      })
    }

    const { account, contractAddress } = authRequest

    // Validate address formats
    if (!isAddress(account)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid account address format',
      })
    }

    if (!isAddress(contractAddress)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid contract address format',
      })
    }

    // Verify account is connected
    const connectedAccounts = walletState.getConnectedAccounts(origin)
    const normalizedAccount = account.toLowerCase()
    const isAuthorized = connectedAccounts.some(
      (a) => a.toLowerCase() === normalizedAccount
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

    // Get chain ID (use current network if not specified)
    const currentNetwork = walletState.getCurrentNetwork()
    let chainId: number
    if (authRequest.chainId !== undefined) {
      chainId = typeof authRequest.chainId === 'string'
        ? parseInt(authRequest.chainId, authRequest.chainId.startsWith('0x') ? 16 : 10)
        : authRequest.chainId
    } else {
      chainId = currentNetwork?.chainId ?? 1
    }

    // Get nonce (use current transaction count if not specified)
    let nonce: bigint
    if (authRequest.nonce !== undefined) {
      nonce = BigInt(authRequest.nonce)
    } else {
      // Get current nonce from the network
      const network = walletState.getState().networks.networks.find(n => n.chainId === chainId)
      if (network) {
        const client = createPublicClient({
          transport: http(network.rpcUrl),
        })
        const transactionCount = await client.getTransactionCount({ address: account })
        nonce = BigInt(transactionCount)
      } else {
        nonce = 0n
      }
    }

    // Request user approval
    try {
      await approvalController.requestAuthorization(
        origin,
        account,
        contractAddress,
        chainId,
        nonce
      )
    } catch (error) {
      if ((error as { code?: number }).code) {
        throw error
      }
      throw createRpcError(RPC_ERRORS.USER_REJECTED)
    }

    // After approval, sign the authorization
    try {
      // Create the authorization structure
      const authorization = createAuthorization(chainId, contractAddress, nonce)

      // Create the authorization hash
      const authorizationHash = createAuthorizationHash(authorization)

      // Sign the hash with the account's private key
      const signatureResult = await keyringController.signAuthorizationHash(
        account,
        authorizationHash
      )

      // Create the signed authorization
      const signedAuthorization = createSignedAuthorization(
        authorization,
        signatureResult.signature
      )

      return {
        signedAuthorization: {
          chainId: signedAuthorization.chainId,
          address: signedAuthorization.address,
          nonce: signedAuthorization.nonce,
          v: signedAuthorization.v,
          r: signedAuthorization.r,
          s: signedAuthorization.s,
        },
        authorizationHash,
      }
    } catch (error) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'Authorization signing failed',
      })
    }
  },

  /**
   * Send a UserOperation (ERC-4337)
   */
  eth_sendUserOperation: async (params, origin) => {
    const [userOpParam, entryPointParam] = params as [unknown, Address]

    // Verify connection
    if (!walletState.isConnected(origin)) {
      throw createRpcError(RPC_ERRORS.UNAUTHORIZED)
    }

    // Validate entryPoint
    const entryPoint = entryPointParam ?? ENTRY_POINT_ADDRESSES.V07
    if (!isAddress(entryPoint)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid entryPoint address',
      })
    }

    // Parse and validate UserOperation
    const userOp = parseUserOperation(userOpParam)
    if (!userOp) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid UserOperation format',
      })
    }

    // Validate sender address
    if (!isAddress(userOp.sender)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid sender address',
      })
    }

    // Verify sender account is connected (case-insensitive)
    const connectedAccounts = walletState.getConnectedAccounts(origin)
    const normalizedSender = userOp.sender.toLowerCase()
    const isAuthorized = connectedAccounts.some(
      (a) => a.toLowerCase() === normalizedSender
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

    // Check network and bundler URL
    const network = walletState.getCurrentNetwork()
    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    if (!network.bundlerUrl) {
      throw createRpcError({
        code: RPC_ERRORS.RESOURCE_UNAVAILABLE.code,
        message: 'Bundler not configured for this network',
      })
    }

    // Calculate estimated gas cost for approval display
    const estimatedGasCost =
      (userOp.preVerificationGas +
        userOp.verificationGasLimit +
        userOp.callGasLimit) *
      userOp.maxFeePerGas

    // Request user approval
    try {
      await approvalController.requestTransaction(
        origin,
        userOp.sender,
        userOp.sender, // Smart account is both from and to
        BigInt(0), // UserOp value is in callData
        userOp.callData,
        estimatedGasCost,
        'UserOperation',
        undefined
      )
    } catch (error) {
      throw createRpcError(RPC_ERRORS.USER_REJECTED)
    }

    // Sign the UserOperation
    let signedUserOp: UserOperation
    try {
      const hash = getUserOpHash(userOp, entryPoint, network.chainId)
      const signature = await keyringController.signMessage(userOp.sender, hash)
      signedUserOp = { ...userOp, signature }
    } catch (error) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'UserOperation signing failed',
      })
    }

    // Pack the UserOperation for bundler submission
    const packedUserOp = packUserOperation(signedUserOp)

    // Submit to bundler
    try {
      const bundlerClient = createBundlerClient(network.bundlerUrl)
      const userOpHash = await bundlerClient.sendUserOperation(
        packedUserOp,
        entryPoint
      )
      return userOpHash
    } catch (error) {
      const err = error as Error & { code?: number; data?: unknown }
      throw createRpcError({
        code: err.code ?? RPC_ERRORS.INTERNAL_ERROR.code,
        message: err.message || 'UserOperation submission failed',
        data: err.data,
      })
    }
  },

  /**
   * Estimate gas for a UserOperation
   */
  eth_estimateUserOperationGas: async (params) => {
    const [userOpParam, entryPointParam] = params as [unknown, Address]
    const network = walletState.getCurrentNetwork()

    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    if (!network.bundlerUrl) {
      throw createRpcError({
        code: RPC_ERRORS.RESOURCE_UNAVAILABLE.code,
        message: 'Bundler not configured for this network',
      })
    }

    // Validate entryPoint
    const entryPoint = entryPointParam ?? ENTRY_POINT_ADDRESSES.V07
    if (!isAddress(entryPoint)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid entryPoint address',
      })
    }

    // Parse UserOperation (allow partial for estimation)
    const userOp = parseUserOperation(userOpParam)
    if (!userOp) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid UserOperation format',
      })
    }

    // Pack the UserOperation
    const packedUserOp = packUserOperation(userOp)

    // Forward to bundler
    try {
      const bundlerClient = createBundlerClient(network.bundlerUrl)
      const gasEstimate = await bundlerClient.estimateUserOperationGas(
        packedUserOp,
        entryPoint
      )

      // Return as hex values for JSON-RPC compatibility
      return {
        preVerificationGas: `0x${gasEstimate.preVerificationGas.toString(16)}`,
        verificationGasLimit: `0x${gasEstimate.verificationGasLimit.toString(16)}`,
        callGasLimit: `0x${gasEstimate.callGasLimit.toString(16)}`,
        ...(gasEstimate.paymasterVerificationGasLimit && {
          paymasterVerificationGasLimit: `0x${gasEstimate.paymasterVerificationGasLimit.toString(16)}`,
        }),
        ...(gasEstimate.paymasterPostOpGasLimit && {
          paymasterPostOpGasLimit: `0x${gasEstimate.paymasterPostOpGasLimit.toString(16)}`,
        }),
      }
    } catch (error) {
      const err = error as Error & { code?: number; data?: unknown }
      throw createRpcError({
        code: err.code ?? RPC_ERRORS.INTERNAL_ERROR.code,
        message: err.message || 'Gas estimation failed',
        data: err.data,
      })
    }
  },

  /**
   * Get UserOperation by hash
   */
  eth_getUserOperationByHash: async (params) => {
    const [userOpHash] = params as [Hex]
    const network = walletState.getCurrentNetwork()

    if (!network?.bundlerUrl) {
      throw createRpcError(RPC_ERRORS.RESOURCE_UNAVAILABLE)
    }

    try {
      const bundlerClient = createBundlerClient(network.bundlerUrl)
      return await bundlerClient.getUserOperationByHash(userOpHash)
    } catch (error) {
      const err = error as Error & { code?: number; data?: unknown }
      throw createRpcError({
        code: err.code ?? RPC_ERRORS.INTERNAL_ERROR.code,
        message: err.message || 'Failed to get UserOperation',
        data: err.data,
      })
    }
  },

  /**
   * Get UserOperation receipt
   */
  eth_getUserOperationReceipt: async (params) => {
    const [userOpHash] = params as [Hex]
    const network = walletState.getCurrentNetwork()

    if (!network?.bundlerUrl) {
      throw createRpcError(RPC_ERRORS.RESOURCE_UNAVAILABLE)
    }

    try {
      const bundlerClient = createBundlerClient(network.bundlerUrl)
      return await bundlerClient.getUserOperationReceipt(userOpHash)
    } catch (error) {
      const err = error as Error & { code?: number; data?: unknown }
      throw createRpcError({
        code: err.code ?? RPC_ERRORS.INTERNAL_ERROR.code,
        message: err.message || 'Failed to get UserOperation receipt',
        data: err.data,
      })
    }
  },

  /**
   * Get supported entry points
   */
  eth_supportedEntryPoints: async () => {
    const network = walletState.getCurrentNetwork()

    if (!network?.bundlerUrl) {
      // Return default entry points if bundler not configured
      return [ENTRY_POINT_ADDRESSES.V07]
    }

    try {
      const bundlerClient = createBundlerClient(network.bundlerUrl)
      return await bundlerClient.getSupportedEntryPoints()
    } catch {
      // Fallback to default entry points
      return [ENTRY_POINT_ADDRESSES.V07]
    }
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
 * Parse UserOperation from RPC params
 * Handles both hex string and BigInt formats
 */
function parseUserOperation(param: unknown): UserOperation | null {
  if (!param || typeof param !== 'object') {
    return null
  }

  const obj = param as Record<string, unknown>

  // Required fields
  if (!obj.sender || !obj.callData) {
    return null
  }

  try {
    return {
      sender: obj.sender as Address,
      nonce: parseBigInt(obj.nonce, BigInt(0)),
      factory: obj.factory as Address | undefined,
      factoryData: obj.factoryData as Hex | undefined,
      callData: obj.callData as Hex,
      callGasLimit: parseBigInt(obj.callGasLimit, BigInt(100000)),
      verificationGasLimit: parseBigInt(obj.verificationGasLimit, BigInt(100000)),
      preVerificationGas: parseBigInt(obj.preVerificationGas, BigInt(21000)),
      maxFeePerGas: parseBigInt(obj.maxFeePerGas, BigInt(0)),
      maxPriorityFeePerGas: parseBigInt(obj.maxPriorityFeePerGas, BigInt(0)),
      paymaster: obj.paymaster as Address | undefined,
      paymasterVerificationGasLimit: obj.paymasterVerificationGasLimit
        ? parseBigInt(obj.paymasterVerificationGasLimit, BigInt(0))
        : undefined,
      paymasterPostOpGasLimit: obj.paymasterPostOpGasLimit
        ? parseBigInt(obj.paymasterPostOpGasLimit, BigInt(0))
        : undefined,
      paymasterData: obj.paymasterData as Hex | undefined,
      signature: (obj.signature as Hex) ?? '0x',
    }
  } catch {
    return null
  }
}

/**
 * Parse a value to BigInt
 * Handles hex strings, decimal strings, numbers, and BigInt
 */
function parseBigInt(value: unknown, defaultValue: bigint): bigint {
  if (value === undefined || value === null) {
    return defaultValue
  }
  if (typeof value === 'bigint') {
    return value
  }
  if (typeof value === 'number') {
    return BigInt(value)
  }
  if (typeof value === 'string') {
    if (value.startsWith('0x')) {
      return BigInt(value)
    }
    return BigInt(value)
  }
  return defaultValue
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
 * Validate RPC request parameters based on method
 */
function validateRpcParams(method: string, params: unknown[] | undefined): void {
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
    case 'eth_getUserOperationReceipt': {
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
      break

    default:
      // Unknown method - let handler deal with it
      break
  }
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
    // Check rate limit (SEC-4)
    const rateLimitResult = rateLimiter.checkLimit(origin, method)
    if (!rateLimitResult.allowed) {
      throw createRpcError({
        code: RPC_ERRORS.LIMIT_EXCEEDED.code,
        message: `Rate limit exceeded. Try again in ${rateLimitResult.retryAfter} seconds`,
        data: {
          remaining: rateLimitResult.remaining,
          resetAt: rateLimitResult.resetAt,
          retryAfter: rateLimitResult.retryAfter,
        },
      })
    }

    // Validate RPC request structure
    const rpcValidation = inputValidator.validateRpcRequest({
      method,
      params,
      id,
    })
    if (!rpcValidation.isValid) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_REQUEST.code,
        message: rpcValidation.errors.join(', '),
      })
    }

    // Validate method-specific params
    validateRpcParams(method, params)

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
