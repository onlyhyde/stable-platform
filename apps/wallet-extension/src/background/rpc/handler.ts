// Use SDK for bundler client, UserOperation utilities, and security modules
import {
  // Security utilities
  InputValidator,
  type ModuleType,
  type TransactionObject,
  type UserOperation,
  createBundlerClient,
  // Module operations
  createModuleOperationClient,
  createRateLimiter,
  createTypedDataValidator,
  getModuleTypeName,
  getUserOperationHash,
} from '@stablenet/core'
import type { Address, Hex } from 'viem'
import { http, createPublicClient, isAddress } from 'viem'
import { DEFAULT_VALUES, ENTRY_POINT_ADDRESSES, RPC_ERRORS } from '../../shared/constants'
import { handleApprovalError } from '../../shared/errors/WalletError'
import { RpcError } from '../../shared/errors/rpcErrors'
import type { JsonRpcRequest, JsonRpcResponse, SupportedMethod } from '../../types'
import { approvalController } from '../controllers/approvalController'
import { keyringController } from '../keyring'
import { checkOrigin } from '../security/phishingGuard'
import { walletState } from '../state/store'
import { eventBroadcaster } from '../utils/eventBroadcaster'

// Create singleton instances for security utilities
const rateLimiter = createRateLimiter()
const typedDataValidator = createTypedDataValidator()
import {
  createAuthorization,
  createAuthorizationHash,
  createSignedAuthorization,
} from '../../shared/utils/eip7702'

// Singleton validator instance
const inputValidator = new InputValidator()

// Cache createPublicClient instances by rpcUrl to avoid redundant instantiation
const publicClientCache = new Map<string, ReturnType<typeof createPublicClient>>()

function getPublicClient(rpcUrl: string) {
  let client = publicClientCache.get(rpcUrl)
  if (!client) {
    client = createPublicClient({ transport: http(rpcUrl) })
    publicClientCache.set(rpcUrl, client)
  }
  return client
}

type RpcHandler = (params: unknown[] | undefined, origin: string) => Promise<unknown>

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
      const sorted = [selectedAccount, ...connectedAccounts.filter((a) => a !== selectedAccount)]
      return sorted
    }

    return connectedAccounts
  },

  /**
   * Request account connection
   * Shows approval popup for user to select accounts
   */
  eth_requestAccounts: async (_params, origin) => {
    // Phishing detection: block critical threats, warn on suspicious origins
    const phishingResult = checkOrigin(origin)
    if (!phishingResult.isSafe && phishingResult.riskLevel === 'critical') {
      throw createRpcError({
        code: RPC_ERRORS.UNAUTHORIZED.code,
        message: phishingResult.reason ?? 'This site has been identified as a phishing threat',
      })
    }

    const state = walletState.getState()

    // If already connected, return accounts with selected first
    if (walletState.isConnected(origin)) {
      const connectedAccounts = walletState.getConnectedAccounts(origin)
      const selectedAccount = state.accounts.selectedAccount

      if (selectedAccount && connectedAccounts.includes(selectedAccount)) {
        return [selectedAccount, ...connectedAccounts.filter((a) => a !== selectedAccount)]
      }
      return connectedAccounts
    }

    // If no accounts, return error
    if (state.accounts.accounts.length === 0) {
      throw createRpcError(RPC_ERRORS.UNAUTHORIZED)
    }

    // Build phishing warnings for non-critical but suspicious origins
    const phishingWarnings =
      !phishingResult.isSafe && phishingResult.reason
        ? {
            warnings: [phishingResult.reason],
            riskLevel: phishingResult.riskLevel as 'low' | 'medium' | 'high',
          }
        : undefined

    // Request user approval via popup
    try {
      const result = await approvalController.requestConnect(origin, undefined, phishingWarnings)

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
        return [selectedAccount, ...result.accounts.filter((a) => a !== selectedAccount)]
      }

      return result.accounts
    } catch (error) {
      handleApprovalError(error, { method: 'eth_requestAccounts', origin })
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

    // Broadcast chainChanged event to all connected sites (EIP-1193)
    const chainIdHex = `0x${targetChainId.toString(16)}`
    const connectedOrigins = state.connections.connectedSites.map((s) => s.origin)
    await eventBroadcaster.broadcastChainChanged(chainIdHex, connectedOrigins)

    return null
  },

  /**
   * Add a new Ethereum chain (EIP-3085)
   * Prompts user to approve adding a new network
   */
  wallet_addEthereumChain: async (params, origin) => {
    const [chainParams] = params as [
      {
        chainId: string
        chainName: string
        nativeCurrency: { name: string; symbol: string; decimals: number }
        rpcUrls: string[]
        blockExplorerUrls?: string[]
      },
    ]

    const chainId = Number.parseInt(chainParams.chainId, 16)

    // Check if chain already exists
    const state = walletState.getState()
    const existingNetwork = state.networks.networks.find((n) => n.chainId === chainId)

    if (existingNetwork) {
      // Chain already exists, switch to it
      await walletState.selectNetwork(chainId)
      const chainIdHex = `0x${chainId.toString(16)}`
      const connectedOrigins = state.connections.connectedSites.map((s) => s.origin)
      await eventBroadcaster.broadcastChainChanged(chainIdHex, connectedOrigins)
      return null
    }

    // Validate required rpcUrls
    const rpcUrl = chainParams.rpcUrls[0]
    if (!rpcUrl) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'At least one RPC URL is required',
      })
    }

    // Request user approval
    const result = await approvalController.requestAddNetwork(
      origin,
      chainId,
      chainParams.chainName,
      rpcUrl,
      chainParams.nativeCurrency,
      chainParams.blockExplorerUrls?.[0]
    )

    if (!result.added) {
      throw createRpcError(RPC_ERRORS.USER_REJECTED)
    }

    // Add network to wallet (bundlerUrl is optional for custom networks)
    await walletState.addNetwork({
      chainId,
      name: chainParams.chainName,
      rpcUrl,
      currency: chainParams.nativeCurrency,
      explorerUrl: chainParams.blockExplorerUrls?.[0],
      isCustom: true,
    })

    return null
  },

  /**
   * Get transaction receipt by hash
   */
  eth_getTransactionReceipt: async (params) => {
    const [txHash] = params as [Hex]
    const network = walletState.getCurrentNetwork()

    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    const client = getPublicClient(network.rpcUrl)

    try {
      const receipt = await client.getTransactionReceipt({ hash: txHash })
      if (!receipt) return null

      // Convert to standard JSON-RPC format
      return {
        transactionHash: receipt.transactionHash,
        transactionIndex: `0x${receipt.transactionIndex.toString(16)}`,
        blockHash: receipt.blockHash,
        blockNumber: `0x${receipt.blockNumber.toString(16)}`,
        from: receipt.from,
        to: receipt.to,
        cumulativeGasUsed: `0x${receipt.cumulativeGasUsed.toString(16)}`,
        gasUsed: `0x${receipt.gasUsed.toString(16)}`,
        contractAddress: receipt.contractAddress,
        logs: receipt.logs.map((log) => ({
          address: log.address,
          topics: log.topics,
          data: log.data,
          blockNumber: `0x${log.blockNumber.toString(16)}`,
          transactionHash: log.transactionHash,
          transactionIndex: `0x${log.transactionIndex.toString(16)}`,
          blockHash: log.blockHash,
          logIndex: `0x${log.logIndex.toString(16)}`,
          removed: log.removed,
        })),
        logsBloom: receipt.logsBloom,
        status: receipt.status === 'success' ? '0x1' : '0x0',
        effectiveGasPrice: receipt.effectiveGasPrice
          ? `0x${receipt.effectiveGasPrice.toString(16)}`
          : undefined,
        type: formatTransactionType(receipt.type),
      }
    } catch {
      return null
    }
  },

  /**
   * Get transaction by hash
   */
  eth_getTransactionByHash: async (params) => {
    const [txHash] = params as [Hex]
    const network = walletState.getCurrentNetwork()

    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    const client = getPublicClient(network.rpcUrl)

    try {
      const tx = await client.getTransaction({ hash: txHash })
      if (!tx) return null

      // Convert to standard JSON-RPC format
      return {
        hash: tx.hash,
        nonce: `0x${tx.nonce.toString(16)}`,
        blockHash: tx.blockHash,
        blockNumber: tx.blockNumber ? `0x${tx.blockNumber.toString(16)}` : null,
        transactionIndex:
          tx.transactionIndex !== null ? `0x${tx.transactionIndex.toString(16)}` : null,
        from: tx.from,
        to: tx.to,
        value: `0x${tx.value.toString(16)}`,
        gas: `0x${tx.gas.toString(16)}`,
        gasPrice: tx.gasPrice ? `0x${tx.gasPrice.toString(16)}` : undefined,
        maxFeePerGas: tx.maxFeePerGas ? `0x${tx.maxFeePerGas.toString(16)}` : undefined,
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas
          ? `0x${tx.maxPriorityFeePerGas.toString(16)}`
          : undefined,
        input: tx.input,
        v: `0x${tx.v.toString(16)}`,
        r: tx.r,
        s: tx.s,
        type: formatTransactionType(tx.type),
        chainId: tx.chainId ? `0x${tx.chainId.toString(16)}` : undefined,
      }
    } catch {
      return null
    }
  },

  /**
   * Get code at address
   */
  eth_getCode: async (params) => {
    const [address, block] = params as [Address, string]
    const network = walletState.getCurrentNetwork()

    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    const client = getPublicClient(network.rpcUrl)

    const code = await client.getCode({
      address,
      blockTag: block === 'latest' ? 'latest' : undefined,
    })

    return code ?? '0x'
  },

  /**
   * Get logs matching filter
   */
  eth_getLogs: async (params) => {
    const [filter] = params as [
      {
        fromBlock?: string
        toBlock?: string
        address?: Address | Address[]
        topics?: (Hex | Hex[] | null)[]
        blockHash?: Hex
      },
    ]
    const network = walletState.getCurrentNetwork()

    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    const client = getPublicClient(network.rpcUrl)

    // Build logs filter - blockHash is mutually exclusive with fromBlock/toBlock
    const logsFilter = filter.blockHash
      ? { address: filter.address, blockHash: filter.blockHash }
      : {
          address: filter.address,
          fromBlock: filter.fromBlock
            ? filter.fromBlock === 'latest'
              ? ('latest' as const)
              : BigInt(filter.fromBlock)
            : undefined,
          toBlock: filter.toBlock
            ? filter.toBlock === 'latest'
              ? ('latest' as const)
              : BigInt(filter.toBlock)
            : undefined,
        }

    const logs = await client.getLogs(logsFilter)

    return logs.map((log) => ({
      address: log.address,
      topics: log.topics,
      data: log.data,
      blockNumber: `0x${log.blockNumber.toString(16)}`,
      transactionHash: log.transactionHash,
      transactionIndex: `0x${log.transactionIndex.toString(16)}`,
      blockHash: log.blockHash,
      logIndex: `0x${log.logIndex.toString(16)}`,
      removed: log.removed,
    }))
  },

  /**
   * Get block by number
   */
  eth_getBlockByNumber: async (params) => {
    const [blockNumber, includeTransactions] = params as [string, boolean]
    const network = walletState.getCurrentNetwork()

    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    const client = getPublicClient(network.rpcUrl)

    // Use either blockTag or blockNumber, not both
    const block =
      blockNumber === 'latest'
        ? await client.getBlock({ blockTag: 'latest', includeTransactions })
        : await client.getBlock({ blockNumber: BigInt(blockNumber), includeTransactions })

    if (!block) return null

    return formatBlock(block, includeTransactions)
  },

  /**
   * Get block by hash
   */
  eth_getBlockByHash: async (params) => {
    const [blockHash, includeTransactions] = params as [Hex, boolean]
    const network = walletState.getCurrentNetwork()

    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    const client = getPublicClient(network.rpcUrl)

    const block = await client.getBlock({
      blockHash,
      includeTransactions,
    })

    if (!block) return null

    return formatBlock(block, includeTransactions)
  },

  /**
   * Get list of supported networks
   * Custom RPC method for dApps to discover wallet's networks
   */
  wallet_getNetworks: async () => {
    const state = walletState.getState()
    const networks = state.networks.networks

    return networks.map((network) => ({
      chainId: `0x${network.chainId.toString(16)}`,
      chainIdDecimal: network.chainId,
      name: network.name,
      rpcUrl: network.rpcUrl,
      currency: {
        name: network.currency.name,
        symbol: network.currency.symbol,
        decimals: network.currency.decimals,
      },
      explorerUrl: network.explorerUrl,
      isTestnet: network.isTestnet ?? false,
      isCustom: network.isCustom ?? false,
      isSelected: network.chainId === state.networks.selectedChainId,
    }))
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

    const client = getPublicClient(network.rpcUrl)

    const balance = await client.getBalance({ address })
    return `0x${balance.toString(16)}`
  },

  /**
   * Make a read-only call
   */
  eth_call: async (params) => {
    const [callObject, _block] = params as [
      { to: Address; data?: Hex; from?: Address; value?: Hex },
      string,
    ]
    const network = walletState.getCurrentNetwork()

    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    const client = getPublicClient(network.rpcUrl)

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

    const client = getPublicClient(network.rpcUrl)

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
    const isAuthorized = connectedAccounts.some((a) => a.toLowerCase() === normalizedAddress)
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
      handleApprovalError(error, { method: 'personal_sign', origin })
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
    const isAuthorized = connectedAccounts.some((a) => a.toLowerCase() === normalizedAddress)
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
    const domainValidation = typedDataValidator.validateTypedData(typedData, currentChainId, origin)

    // Reject if typed data structure is invalid
    if (!domainValidation.isValid) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: `Invalid typed data: ${domainValidation.errors.join(', ')}`,
      })
    }

    // Get risk level and formatted warnings for approval UI
    const riskLevel = typedDataValidator.getRiskLevel(domainValidation.warnings)
    const warningMessages = typedDataValidator.formatWarningsForDisplay(domainValidation.warnings)

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
      handleApprovalError(error, { method: 'eth_signTypedData_v4', origin })
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
    const [authRequest] = params as [
      {
        account: Address
        contractAddress: Address
        chainId?: number | string
        nonce?: number | string
      },
    ]

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
    const isAuthorized = connectedAccounts.some((a) => a.toLowerCase() === normalizedAccount)
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
      chainId =
        typeof authRequest.chainId === 'string'
          ? Number.parseInt(authRequest.chainId, authRequest.chainId.startsWith('0x') ? 16 : 10)
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
      const network = walletState.getState().networks.networks.find((n) => n.chainId === chainId)
      if (network) {
        const client = getPublicClient(network.rpcUrl)
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
      handleApprovalError(error, { method: 'wallet_grantPermissions', origin })
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
    const isAuthorized = connectedAccounts.some((a) => a.toLowerCase() === normalizedSender)
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
      (userOp.preVerificationGas + userOp.verificationGasLimit + userOp.callGasLimit) *
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
      handleApprovalError(error, { method: 'eth_sendUserOperation', origin })
    }

    // Sign the UserOperation
    let signedUserOp: UserOperation
    try {
      const hash = getUserOperationHash(userOp, entryPoint, BigInt(network.chainId))
      const signature = await keyringController.signMessage(userOp.sender, hash)
      signedUserOp = { ...userOp, signature }
    } catch (error) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'UserOperation signing failed',
      })
    }

    // Submit to bundler (SDK handles packing internally)
    try {
      const bundlerClient = createBundlerClient({ url: network.bundlerUrl, entryPoint })
      const userOpHash = await bundlerClient.sendUserOperation(signedUserOp)
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

    // Forward to bundler (SDK handles packing internally)
    try {
      const bundlerClient = createBundlerClient({ url: network.bundlerUrl, entryPoint })
      const gasEstimate = await bundlerClient.estimateUserOperationGas(userOp)

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
      const bundlerClient = createBundlerClient({ url: network.bundlerUrl })
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
      const bundlerClient = createBundlerClient({ url: network.bundlerUrl })
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
      const bundlerClient = createBundlerClient({ url: network.bundlerUrl })
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
      },
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
    const isAuthorized = connectedAccounts.some((a) => a.toLowerCase() === normalizedFrom)
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
    const client = getPublicClient(network.rpcUrl)

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
        gas = DEFAULT_VALUES.GAS_LIMIT // Default gas for simple transfers
      }
    }

    // Get gas price if not provided
    let gasPrice = txParams.gasPrice ? BigInt(txParams.gasPrice) : undefined
    const maxFeePerGas = txParams.maxFeePerGas ? BigInt(txParams.maxFeePerGas) : undefined
    const maxPriorityFeePerGas = txParams.maxPriorityFeePerGas
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
      handleApprovalError(error, { method: 'eth_sendTransaction', origin })
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

      // Track pending transaction in wallet state
      const txId = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      await walletState.addPendingTransaction({
        id: txId,
        from: txParams.from,
        to: txParams.to ?? ('0x' as Address),
        value: txParams.value ? BigInt(txParams.value) : 0n,
        data: txParams.data,
        chainId: network.chainId,
        status: 'submitted',
        type: 'send',
        txHash,
        timestamp: Date.now(),
        gasPrice,
        maxFeePerGas,
        maxPriorityFeePerGas,
      })

      return txHash
    } catch (error) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'Transaction broadcast failed',
      })
    }
  },

  /**
   * Get all assets (native + tokens) for the connected account
   * Custom RPC method for dApps to get wallet's complete asset list
   */
  wallet_getAssets: async (_params, origin) => {
    // Verify site is connected
    if (!walletState.isConnected(origin)) {
      throw createRpcError(RPC_ERRORS.UNAUTHORIZED)
    }

    const state = walletState.getState()
    const network = walletState.getCurrentNetwork()
    const selectedAccount = state.accounts.selectedAccount

    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    if (!selectedAccount) {
      throw createRpcError(RPC_ERRORS.UNAUTHORIZED)
    }

    // Verify account is connected to this origin
    const connectedAccounts = walletState.getConnectedAccounts(origin)
    if (!connectedAccounts.includes(selectedAccount)) {
      throw createRpcError(RPC_ERRORS.UNAUTHORIZED)
    }

    // Get native balance
    const client = getPublicClient(network.rpcUrl)

    let nativeBalance: bigint
    try {
      nativeBalance = await client.getBalance({ address: selectedAccount })
    } catch {
      nativeBalance = BigInt(0)
    }

    // Format native balance
    const nativeDecimals = network.currency.decimals
    const formattedNativeBalance = formatBalance(nativeBalance.toString(), nativeDecimals)

    // Get tracked tokens and their balances
    const trackedTokens = walletState.getTokensForChain(network.chainId)
    const tokenBalances = await Promise.all(
      trackedTokens.map(async (token) => {
        // Try to get cached balance first
        let balance = walletState.getCachedBalance(network.chainId, selectedAccount, token.address)

        // Fetch fresh balance if not cached
        if (!balance) {
          try {
            const data = `0x70a08231${selectedAccount.slice(2).padStart(64, '0').toLowerCase()}`
            const result = await client.call({
              to: token.address,
              data: data as Hex,
            })
            balance = result.data ? BigInt(result.data).toString() : '0'
            // Cache the balance
            await walletState.updateTokenBalance(
              network.chainId,
              selectedAccount,
              token.address,
              balance
            )
          } catch {
            balance = '0'
          }
        }

        return {
          address: token.address,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          balance,
          formattedBalance: formatBalance(balance, token.decimals),
          logoURI: token.logoURI,
        }
      })
    )

    return {
      chainId: network.chainId,
      account: selectedAccount,
      native: {
        symbol: network.currency.symbol,
        name: network.currency.name,
        decimals: nativeDecimals,
        balance: nativeBalance.toString(),
        formattedBalance: formattedNativeBalance,
      },
      tokens: tokenBalances,
      updatedAt: Date.now(),
    }
  },

  /**
   * Add a token to the wallet's tracked tokens
   * Custom RPC method for dApps to request adding a token
   */
  wallet_addToken: async (params, origin) => {
    // Verify site is connected
    if (!walletState.isConnected(origin)) {
      throw createRpcError(RPC_ERRORS.UNAUTHORIZED)
    }

    const [tokenParams] = params as [
      {
        address: Address
        symbol?: string
        name?: string
        decimals?: number
        logoURI?: string
      },
    ]

    if (!tokenParams?.address) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Token address is required',
      })
    }

    if (!isAddress(tokenParams.address)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid token address',
      })
    }

    const network = walletState.getCurrentNetwork()
    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    const normalizedAddress = tokenParams.address.toLowerCase() as Address

    // Check if token already exists
    const existingToken = walletState.getToken(network.chainId, normalizedAddress)
    if (existingToken) {
      return {
        success: true,
        token: existingToken,
      }
    }

    // Fetch token metadata from contract if not provided
    let symbol = tokenParams.symbol
    let name = tokenParams.name
    let decimals = tokenParams.decimals

    if (!symbol || !name || decimals === undefined) {
      const client = getPublicClient(network.rpcUrl)

      try {
        // Fetch missing metadata
        if (!symbol) {
          const symbolResult = await client.call({
            to: normalizedAddress,
            data: '0x95d89b41' as Hex, // symbol()
          })
          symbol = decodeStringResult(symbolResult.data)
        }

        if (!name) {
          const nameResult = await client.call({
            to: normalizedAddress,
            data: '0x06fdde03' as Hex, // name()
          })
          name = decodeStringResult(nameResult.data)
        }

        if (decimals === undefined) {
          const decimalsResult = await client.call({
            to: normalizedAddress,
            data: '0x313ce567' as Hex, // decimals()
          })
          decimals = decimalsResult.data ? Number(BigInt(decimalsResult.data)) : 18
        }
      } catch (error) {
        return {
          success: false,
          error: `Failed to fetch token metadata: ${(error as Error).message}`,
        }
      }
    }

    // Create and store the token
    const newToken = {
      address: normalizedAddress,
      symbol: symbol ?? 'UNKNOWN',
      name: name ?? 'Unknown Token',
      decimals: decimals ?? 18,
      chainId: network.chainId,
      logoURI: tokenParams.logoURI,
      isVisible: true,
      addedAt: Date.now(),
    }

    await walletState.addToken(network.chainId, newToken)

    // Broadcast assetsChanged event to all connected sites
    const connectedOrigins = walletState.getState().connections.connectedSites.map((s) => s.origin)
    await eventBroadcaster.broadcastAssetsChanged(
      network.chainId,
      walletState.getState().accounts.selectedAccount ?? ('' as Address),
      'token_added',
      connectedOrigins
    )

    return {
      success: true,
      token: newToken,
    }
  },

  /**
   * Install a module on a Smart Account (ERC-7579)
   * Custom RPC method for module management
   */
  stablenet_installModule: async (params, origin) => {
    const [moduleParams] = params as [
      {
        account: Address
        moduleAddress: Address
        moduleType: string
        initData: Hex | Record<string, unknown>
        initDataEncoded: boolean
        chainId: number
      },
    ]

    if (!moduleParams) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Missing module installation parameters',
      })
    }

    const { account, moduleAddress, moduleType, initData, initDataEncoded, chainId } = moduleParams

    // Validate addresses
    if (!isAddress(account)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid account address',
      })
    }

    if (!isAddress(moduleAddress)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid module address',
      })
    }

    // Verify account is connected (case-insensitive)
    const connectedAccounts = walletState.getConnectedAccounts(origin)
    const normalizedAccount = account.toLowerCase()
    const isAuthorized = connectedAccounts.some((a) => a.toLowerCase() === normalizedAccount)
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

    // Get network configuration
    const network = walletState.getState().networks.networks.find((n) => n.chainId === chainId)
    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    if (!network.bundlerUrl) {
      throw createRpcError({
        code: RPC_ERRORS.RESOURCE_UNAVAILABLE.code,
        message: 'Bundler not configured for this network',
      })
    }

    // Parse module type from string to ModuleType
    const moduleTypeParsed = BigInt(moduleType) as ModuleType
    const moduleTypeNameStr = getModuleTypeName(moduleTypeParsed)

    // Determine init data - use encoded if provided, otherwise use empty for now
    // (Complex config encoding should be done on the UI side)
    const finalInitData: Hex = initDataEncoded ? (initData as Hex) : ('0x' as Hex)

    // Create module operation client and prepare calldata
    const moduleOpClient = createModuleOperationClient({ chainId })
    const moduleCalldata = moduleOpClient.prepareInstall(account, {
      moduleAddress,
      moduleType: moduleTypeParsed,
      initData: finalInitData,
    })

    // Build a UserOperation to execute the module installation
    // This calls the smart account's installModule function
    const client = getPublicClient(network.rpcUrl)

    // Get current nonce
    const nonce = await client
      .readContract({
        address: account,
        abi: [
          {
            inputs: [{ name: 'key', type: 'uint192' }],
            name: 'getNonce',
            outputs: [{ name: '', type: 'uint256' }],
            stateMutability: 'view',
            type: 'function',
          },
        ],
        functionName: 'getNonce',
        args: [0n],
      })
      .catch(() => 0n)

    // Get gas prices
    const feeData = await client.estimateFeesPerGas().catch(() => ({
      maxFeePerGas: BigInt(1e9),
      maxPriorityFeePerGas: BigInt(1e8),
    }))

    // Create UserOperation
    const userOp: UserOperation = {
      sender: account,
      nonce,
      factory: undefined,
      factoryData: undefined,
      callData: moduleCalldata.data,
      callGasLimit: BigInt(500000),
      verificationGasLimit: BigInt(500000),
      preVerificationGas: BigInt(100000),
      maxFeePerGas: feeData.maxFeePerGas ?? BigInt(1e9),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? BigInt(1e8),
      paymaster: undefined,
      paymasterVerificationGasLimit: undefined,
      paymasterPostOpGasLimit: undefined,
      paymasterData: undefined,
      signature: '0x',
    }

    // Calculate estimated gas cost for display
    const estimatedGasCost =
      (userOp.preVerificationGas + userOp.verificationGasLimit + userOp.callGasLimit) *
      userOp.maxFeePerGas

    // Request user approval
    try {
      await approvalController.requestTransaction(
        origin,
        account,
        account, // Smart account is both from and to
        BigInt(0),
        moduleCalldata.data,
        estimatedGasCost,
        `Install ${moduleTypeNameStr} Module`,
        undefined
      )
    } catch (error) {
      handleApprovalError(error, { method: 'wallet_installModule', origin })
    }

    // Sign the UserOperation
    const entryPoint = ENTRY_POINT_ADDRESSES.V07
    let signedUserOp: UserOperation
    try {
      const hash = getUserOperationHash(userOp, entryPoint, BigInt(chainId))
      const signature = await keyringController.signMessage(account, hash)
      signedUserOp = { ...userOp, signature }
    } catch (error) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'UserOperation signing failed',
      })
    }

    // Submit to bundler
    try {
      const bundlerClient = createBundlerClient({ url: network.bundlerUrl, entryPoint })
      const userOpHash = await bundlerClient.sendUserOperation(signedUserOp)
      return { hash: userOpHash }
    } catch (error) {
      const err = error as Error & { code?: number; data?: unknown }
      throw createRpcError({
        code: err.code ?? RPC_ERRORS.INTERNAL_ERROR.code,
        message: err.message || 'Module installation failed',
        data: err.data,
      })
    }
  },

  /**
   * Uninstall a module from a Smart Account (ERC-7579)
   * Custom RPC method for module management
   */
  stablenet_uninstallModule: async (params, origin) => {
    const [moduleParams] = params as [
      {
        account: Address
        moduleAddress: Address
        moduleType: string
        chainId: number
        deInitData?: Hex
      },
    ]

    if (!moduleParams) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Missing module uninstallation parameters',
      })
    }

    const { account, moduleAddress, moduleType, chainId, deInitData = '0x' as Hex } = moduleParams

    // Validate addresses
    if (!isAddress(account)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid account address',
      })
    }

    if (!isAddress(moduleAddress)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid module address',
      })
    }

    // Verify account is connected (case-insensitive)
    const connectedAccounts = walletState.getConnectedAccounts(origin)
    const normalizedAccount = account.toLowerCase()
    const isAuthorized = connectedAccounts.some((a) => a.toLowerCase() === normalizedAccount)
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

    // Get network configuration
    const network = walletState.getState().networks.networks.find((n) => n.chainId === chainId)
    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    if (!network.bundlerUrl) {
      throw createRpcError({
        code: RPC_ERRORS.RESOURCE_UNAVAILABLE.code,
        message: 'Bundler not configured for this network',
      })
    }

    // Parse module type from string to ModuleType
    const moduleTypeParsed = BigInt(moduleType) as ModuleType
    const moduleTypeNameStr = getModuleTypeName(moduleTypeParsed)

    // Create module operation client and prepare calldata
    const moduleOpClient = createModuleOperationClient({ chainId })
    const moduleCalldata = moduleOpClient.prepareUninstall(account, {
      moduleAddress,
      moduleType: moduleTypeParsed,
      deInitData,
    })

    // Build a UserOperation to execute the module uninstallation
    const client = getPublicClient(network.rpcUrl)

    // Get current nonce
    const nonce = await client
      .readContract({
        address: account,
        abi: [
          {
            inputs: [{ name: 'key', type: 'uint192' }],
            name: 'getNonce',
            outputs: [{ name: '', type: 'uint256' }],
            stateMutability: 'view',
            type: 'function',
          },
        ],
        functionName: 'getNonce',
        args: [0n],
      })
      .catch(() => 0n)

    // Get gas prices
    const feeData = await client.estimateFeesPerGas().catch(() => ({
      maxFeePerGas: BigInt(1e9),
      maxPriorityFeePerGas: BigInt(1e8),
    }))

    // Create UserOperation
    const userOp: UserOperation = {
      sender: account,
      nonce,
      factory: undefined,
      factoryData: undefined,
      callData: moduleCalldata.data,
      callGasLimit: BigInt(300000),
      verificationGasLimit: BigInt(300000),
      preVerificationGas: BigInt(100000),
      maxFeePerGas: feeData.maxFeePerGas ?? BigInt(1e9),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? BigInt(1e8),
      paymaster: undefined,
      paymasterVerificationGasLimit: undefined,
      paymasterPostOpGasLimit: undefined,
      paymasterData: undefined,
      signature: '0x',
    }

    // Calculate estimated gas cost for display
    const estimatedGasCost =
      (userOp.preVerificationGas + userOp.verificationGasLimit + userOp.callGasLimit) *
      userOp.maxFeePerGas

    // Request user approval
    try {
      await approvalController.requestTransaction(
        origin,
        account,
        account,
        BigInt(0),
        moduleCalldata.data,
        estimatedGasCost,
        `Uninstall ${moduleTypeNameStr} Module`,
        undefined
      )
    } catch (error) {
      handleApprovalError(error, { method: 'wallet_uninstallModule', origin })
    }

    // Sign the UserOperation
    const entryPoint = ENTRY_POINT_ADDRESSES.V07
    let signedUserOp: UserOperation
    try {
      const hash = getUserOperationHash(userOp, entryPoint, BigInt(chainId))
      const signature = await keyringController.signMessage(account, hash)
      signedUserOp = { ...userOp, signature }
    } catch (error) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'UserOperation signing failed',
      })
    }

    // Submit to bundler
    try {
      const bundlerClient = createBundlerClient({ url: network.bundlerUrl, entryPoint })
      const userOpHash = await bundlerClient.sendUserOperation(signedUserOp)
      return { hash: userOpHash }
    } catch (error) {
      const err = error as Error & { code?: number; data?: unknown }
      throw createRpcError({
        code: err.code ?? RPC_ERRORS.INTERNAL_ERROR.code,
        message: err.message || 'Module uninstallation failed',
        data: err.data,
      })
    }
  },

  // =========================================================================
  // Smart Account Info Methods
  // =========================================================================

  /**
   * Get Smart Account information (root validator, delegation, module counts)
   */
  stablenet_getSmartAccountInfo: async (params) => {
    const [requestParams] = params as [{ account: string; chainId: number }]
    const { account, chainId } = requestParams

    if (!account || !isAddress(account)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Valid account address is required',
      })
    }

    const network = walletState.getState().networks.networks.find((n) => n.chainId === chainId)
    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    const client = getPublicClient(network.rpcUrl)
    const accountAddr = account as Address

    // Check if account has code (is smart account or delegated)
    const code = await client.getCode({ address: accountAddr }).catch(() => undefined)
    const hasCode = !!code && code !== '0x'
    const isDelegated = hasCode && code!.toLowerCase().startsWith('0xef0100')

    let accountType: 'eoa' | 'delegated' | 'smart' = 'eoa'
    let delegationTarget: string | null = null

    if (isDelegated) {
      accountType = 'delegated'
      delegationTarget = `0x${code!.slice(8, 48)}`
    } else if (hasCode) {
      accountType = 'smart'
    }

    let rootValidator: string | null = null
    let accountId: string | null = null

    // Only query on-chain data if account is smart or delegated
    if (accountType === 'smart' || accountType === 'delegated') {
      try {
        const { KERNEL_ABI } = await import('@stablenet/core')
        rootValidator = (await client
          .readContract({
            address: accountAddr,
            abi: KERNEL_ABI,
            functionName: 'rootValidator',
          })
          .catch(() => null)) as string | null

        accountId = (await client
          .readContract({
            address: accountAddr,
            abi: KERNEL_ABI,
            functionName: 'accountId',
          })
          .catch(() => null)) as string | null
      } catch {
        // Contract may not support these methods
      }
    }

    return {
      accountType,
      isDeployed: hasCode,
      rootValidator,
      accountId,
      delegationTarget,
      isDelegated,
    }
  },

  /**
   * Get module registry entries (for marketplace browsing)
   */
  stablenet_getRegistryModules: async (params) => {
    const [requestParams] = params as [{ chainId?: number; type?: number } | undefined]

    try {
      const { createModuleRegistry } = await import('@stablenet/core')
      const chainId = requestParams?.chainId ?? walletState.getCurrentNetwork()?.chainId ?? 1
      const registry = createModuleRegistry({ chainId })

      let modules = registry.getAll()

      // Filter by type if specified
      const filterType = requestParams?.type
      if (filterType !== undefined) {
        const filterBigInt = BigInt(filterType)
        modules = modules.filter((m) => m.metadata.type === filterBigInt)
      }

      return { modules }
    } catch (error) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'Failed to fetch registry modules',
      })
    }
  },

  // =========================================================================
  // Smart Account Management
  // =========================================================================

  /**
   * Set the root validator for a Smart Account (Kernel)
   */
  stablenet_setRootValidator: async (params, origin) => {
    const [requestParams] = params as [
      { account: string; validator: string; validatorData?: string; chainId: number },
    ]
    const { account, validator, validatorData, chainId } = requestParams

    if (!account || !isAddress(account)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Valid account address is required',
      })
    }
    if (!validator || !isAddress(validator)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Valid validator address is required',
      })
    }

    const network = walletState.getState().networks.networks.find((n) => n.chainId === chainId)
    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    try {
      const { KERNEL_ABI } = await import('@stablenet/core')
      const { encodeFunctionData } = await import('viem')

      const callData = encodeFunctionData({
        abi: KERNEL_ABI,
        functionName: 'setRootValidator',
        args: [validator as Address, (validatorData ?? '0x') as `0x${string}`],
      })

      // Send as a transaction to the smart account
      const tx = {
        from: account,
        to: account, // Call on the smart account itself
        data: callData,
        value: '0x0',
      }

      return await handlers.eth_sendTransaction!([tx], origin ?? 'internal')
    } catch (error) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'Failed to set root validator',
      })
    }
  },

  // =========================================================================
  // Swap Execution
  // =========================================================================

  /**
   * Execute a token swap through the installed Swap Executor module (ERC-7579)
   * Encodes the swap calldata and submits as a UserOperation
   */
  stablenet_executeSwap: async (params, origin) => {
    const [swapParams] = params as [
      {
        account: Address
        swapExecutorAddress: Address
        tokenIn: Address
        tokenOut: Address
        fee: number
        amountIn: string
        amountOutMinimum: string
        deadline: string
        chainId: number
      },
    ]

    if (!swapParams) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Missing swap parameters',
      })
    }

    const {
      account,
      swapExecutorAddress,
      tokenIn,
      tokenOut,
      fee,
      amountIn,
      amountOutMinimum,
      deadline,
      chainId,
    } = swapParams

    // Validate addresses
    if (!isAddress(account)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid account address',
      })
    }
    if (!isAddress(swapExecutorAddress)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid swap executor address',
      })
    }
    if (!isAddress(tokenIn) || !isAddress(tokenOut)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid token address',
      })
    }

    // Verify account is connected
    const connectedAccounts = walletState.getConnectedAccounts(origin)
    const normalizedAccount = account.toLowerCase()
    const isAuthorized = connectedAccounts.some((a) => a.toLowerCase() === normalizedAccount)
    if (!isAuthorized) {
      throw createRpcError(RPC_ERRORS.UNAUTHORIZED)
    }

    if (!keyringController.isUnlocked()) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: 'Wallet is locked',
      })
    }

    const network = walletState.getState().networks.networks.find((n) => n.chainId === chainId)
    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }
    if (!network.bundlerUrl) {
      throw createRpcError({
        code: RPC_ERRORS.RESOURCE_UNAVAILABLE.code,
        message: 'Bundler not configured for this network',
      })
    }

    // Encode swap calldata using SWAP_EXECUTOR_ABI
    const { encodeFunctionData } = await import('viem')
    const { SWAP_EXECUTOR_ABI } = await import('@stablenet/core')

    const swapCalldata = encodeFunctionData({
      abi: SWAP_EXECUTOR_ABI,
      functionName: 'swapExactInputSingle',
      args: [tokenIn, tokenOut, fee, BigInt(amountIn), BigInt(amountOutMinimum), BigInt(deadline)],
    })

    // Encode execution through the Smart Account's execute function
    // The swap executor is called as a module via the Kernel's execute
    const { KERNEL_ABI } = await import('@stablenet/core')
    const { concatHex, numberToHex, pad } = await import('viem')

    // ExecMode: single call (0x00), default exec type
    const execMode = pad('0x00' as `0x${string}`, { size: 32 })

    // executionCalldata: abi.encodePacked(target, value, callData)
    const targetBytes = swapExecutorAddress as `0x${string}`
    const valueBytes = pad(numberToHex(0n), { size: 32 })
    const executionCalldata = concatHex([targetBytes, valueBytes, swapCalldata])

    const callData = encodeFunctionData({
      abi: KERNEL_ABI,
      functionName: 'execute',
      args: [execMode, executionCalldata],
    })

    // Build UserOperation
    const client = getPublicClient(network.rpcUrl)

    const nonce = await client
      .readContract({
        address: account,
        abi: [
          {
            inputs: [{ name: 'key', type: 'uint192' }],
            name: 'getNonce',
            outputs: [{ name: '', type: 'uint256' }],
            stateMutability: 'view',
            type: 'function',
          },
        ],
        functionName: 'getNonce',
        args: [0n],
      })
      .catch(() => 0n)

    const feeData = await client.estimateFeesPerGas().catch(() => ({
      maxFeePerGas: BigInt(1e9),
      maxPriorityFeePerGas: BigInt(1e8),
    }))

    const userOp: UserOperation = {
      sender: account,
      nonce,
      factory: undefined,
      factoryData: undefined,
      callData,
      callGasLimit: BigInt(500000),
      verificationGasLimit: BigInt(500000),
      preVerificationGas: BigInt(100000),
      maxFeePerGas: feeData.maxFeePerGas ?? BigInt(1e9),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? BigInt(1e8),
      paymaster: undefined,
      paymasterVerificationGasLimit: undefined,
      paymasterPostOpGasLimit: undefined,
      paymasterData: undefined,
      signature: '0x',
    }

    const estimatedGasCost =
      (userOp.preVerificationGas + userOp.verificationGasLimit + userOp.callGasLimit) *
      userOp.maxFeePerGas

    // Request user approval
    try {
      await approvalController.requestTransaction(
        origin,
        account,
        swapExecutorAddress,
        BigInt(0),
        swapCalldata,
        estimatedGasCost,
        'Swap Tokens',
        undefined
      )
    } catch (error) {
      handleApprovalError(error, { method: 'stablenet_executeSwap', origin })
    }

    // Sign the UserOperation
    const entryPoint = ENTRY_POINT_ADDRESSES.V07
    let signedUserOp: UserOperation
    try {
      const hash = getUserOperationHash(userOp, entryPoint, BigInt(chainId))
      const signature = await keyringController.signMessage(account, hash)
      signedUserOp = { ...userOp, signature }
    } catch (error) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'UserOperation signing failed',
      })
    }

    // Submit to bundler
    try {
      const bundlerClient = createBundlerClient({ url: network.bundlerUrl, entryPoint })
      const userOpHash = await bundlerClient.sendUserOperation(signedUserOp)
      return { hash: userOpHash }
    } catch (error) {
      const err = error as Error & { code?: number; data?: unknown }
      throw createRpcError({
        code: err.code ?? RPC_ERRORS.INTERNAL_ERROR.code,
        message: err.message || 'Swap execution failed',
        data: err.data,
      })
    }
  },

  // =========================================================================
  // Transaction Speed Up / Cancel
  // =========================================================================

  /**
   * Speed up a pending transaction by resubmitting with higher gas
   */
  stablenet_speedUpTransaction: async (params) => {
    const requestParams = params?.[0] as { hash?: string } | undefined
    if (!requestParams?.hash) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Missing transaction hash',
      })
    }

    const network = walletState.getCurrentNetwork()
    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    try {
      const client = getPublicClient(network.rpcUrl)
      const tx = await client.getTransaction({ hash: requestParams.hash as `0x${string}` })

      // Build replacement transaction with 10% higher gas
      const bumpFactor = 110n
      const bumpDivisor = 100n

      const replacementTx: Record<string, string> = {
        from: tx.from,
        to: tx.to ?? tx.from,
        nonce: `0x${tx.nonce.toString(16)}`,
        value: `0x${tx.value.toString(16)}`,
        data: tx.input,
      }

      if (tx.maxFeePerGas != null) {
        // EIP-1559
        const newMaxFee = (tx.maxFeePerGas * bumpFactor) / bumpDivisor
        const newPriorityFee = ((tx.maxPriorityFeePerGas ?? 0n) * bumpFactor) / bumpDivisor
        replacementTx.maxFeePerGas = `0x${newMaxFee.toString(16)}`
        replacementTx.maxPriorityFeePerGas = `0x${newPriorityFee.toString(16)}`
      } else if (tx.gasPrice != null) {
        // Legacy
        const newGasPrice = (tx.gasPrice * bumpFactor) / bumpDivisor
        replacementTx.gasPrice = `0x${newGasPrice.toString(16)}`
      }

      if (tx.gas) {
        replacementTx.gas = `0x${tx.gas.toString(16)}`
      }

      // Send the replacement transaction via the existing eth_sendTransaction handler
      return await handlers.eth_sendTransaction!([replacementTx], 'internal')
    } catch (error) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'Failed to speed up transaction',
      })
    }
  },

  /**
   * Cancel a pending transaction by sending a zero-value self-transfer with same nonce
   */
  stablenet_cancelTransaction: async (params) => {
    const requestParams = params?.[0] as { hash?: string } | undefined
    if (!requestParams?.hash) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Missing transaction hash',
      })
    }

    const network = walletState.getCurrentNetwork()
    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    try {
      const client = getPublicClient(network.rpcUrl)
      const tx = await client.getTransaction({ hash: requestParams.hash as `0x${string}` })

      // Build cancel transaction: same nonce, to=self, value=0, data=0x, higher gas
      const bumpFactor = 110n
      const bumpDivisor = 100n

      const cancelTx: Record<string, string> = {
        from: tx.from,
        to: tx.from, // Self-transfer
        nonce: `0x${tx.nonce.toString(16)}`,
        value: '0x0',
        data: '0x',
      }

      if (tx.maxFeePerGas != null) {
        const newMaxFee = (tx.maxFeePerGas * bumpFactor) / bumpDivisor
        const newPriorityFee = ((tx.maxPriorityFeePerGas ?? 0n) * bumpFactor) / bumpDivisor
        cancelTx.maxFeePerGas = `0x${newMaxFee.toString(16)}`
        cancelTx.maxPriorityFeePerGas = `0x${newPriorityFee.toString(16)}`
      } else if (tx.gasPrice != null) {
        const newGasPrice = (tx.gasPrice * bumpFactor) / bumpDivisor
        cancelTx.gasPrice = `0x${newGasPrice.toString(16)}`
      }

      // Minimal gas for a simple transfer
      cancelTx.gas = '0x5208' // 21000

      return await handlers.eth_sendTransaction!([cancelTx], 'internal')
    } catch (error) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'Failed to cancel transaction',
      })
    }
  },

  // =========================================================================
  // Gas & Fee Methods
  // =========================================================================

  /**
   * Get current gas price
   */
  eth_gasPrice: async () => {
    const network = walletState.getCurrentNetwork()
    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    const client = getPublicClient(network.rpcUrl)
    const gasPrice = await client.getGasPrice()
    return `0x${gasPrice.toString(16)}`
  },

  /**
   * Get max priority fee per gas (EIP-1559)
   */
  eth_maxPriorityFeePerGas: async () => {
    const network = walletState.getCurrentNetwork()
    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    const client = getPublicClient(network.rpcUrl)
    try {
      const fee = await client.estimateMaxPriorityFeePerGas()
      return `0x${fee.toString(16)}`
    } catch {
      // Fallback: 1.5 gwei
      return '0x59682f00'
    }
  },

  /**
   * Get fee history for EIP-1559 gas estimation
   */
  eth_feeHistory: async (params) => {
    const network = walletState.getCurrentNetwork()
    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    const [blockCount, _newestBlock, rewardPercentiles] = params as [
      string | number,
      string,
      number[] | undefined,
    ]

    const client = getPublicClient(network.rpcUrl)
    const result = await client.getFeeHistory({
      blockCount: typeof blockCount === 'string' ? Number.parseInt(blockCount, 16) : blockCount,
      rewardPercentiles: rewardPercentiles ?? [],
    })

    return {
      oldestBlock: `0x${result.oldestBlock.toString(16)}`,
      baseFeePerGas: result.baseFeePerGas.map((f) => `0x${f.toString(16)}`),
      gasUsedRatio: result.gasUsedRatio,
      reward: result.reward?.map((r) => r.map((v) => `0x${v.toString(16)}`)),
    }
  },

  /**
   * Estimate gas for a transaction
   */
  eth_estimateGas: async (params) => {
    const [txObject] = params as [
      { from?: Address; to?: Address; value?: Hex; data?: Hex; gas?: Hex },
    ]
    const network = walletState.getCurrentNetwork()
    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    const client = getPublicClient(network.rpcUrl)
    const gas = await client.estimateGas({
      account: txObject.from,
      to: txObject.to,
      value: txObject.value ? BigInt(txObject.value) : undefined,
      data: txObject.data,
    })

    return `0x${gas.toString(16)}`
  },

  // =========================================================================
  // Account State Methods
  // =========================================================================

  /**
   * Get transaction count (nonce) for an address
   */
  eth_getTransactionCount: async (params) => {
    const [address, block] = params as [Address, string]
    const network = walletState.getCurrentNetwork()
    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    const client = getPublicClient(network.rpcUrl)
    const count = await client.getTransactionCount({
      address,
      blockTag: (block === 'latest' || block === 'pending' || block === 'earliest'
        ? block
        : 'latest') as 'latest' | 'pending' | 'earliest',
    })

    return `0x${count.toString(16)}`
  },

  /**
   * Send a signed raw transaction
   */
  eth_sendRawTransaction: async (params) => {
    const [signedTx] = params as [Hex]
    const network = walletState.getCurrentNetwork()
    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    const client = getPublicClient(network.rpcUrl)
    const hash = await client.request({
      method: 'eth_sendRawTransaction',
      params: [signedTx],
    })

    return hash
  },

  // =========================================================================
  // Network Methods
  // =========================================================================

  /**
   * Get network version (net_version)
   */
  net_version: async () => {
    const network = walletState.getCurrentNetwork()
    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }
    return network.chainId.toString()
  },

  // =========================================================================
  // Permission Methods (EIP-2255)
  // =========================================================================

  /**
   * Request permissions from user
   */
  wallet_requestPermissions: async (params, origin) => {
    const [requested] = (params ?? [{}]) as [Record<string, unknown>]
    const requestedMethods = Object.keys(requested)

    // For now, treat permission request like a connect request
    // If eth_accounts is requested and not already connected, trigger connect flow
    if (requestedMethods.includes('eth_accounts')) {
      const connected = walletState.getConnectedAccounts(origin)
      if (connected.length === 0) {
        // Delegate to eth_requestAccounts handler
        const handler = handlers['eth_requestAccounts']
        if (handler) {
          await handler(params, origin)
        }
      }
    }

    // Return granted permissions
    return requestedMethods.map((method) => ({
      parentCapability: method,
      date: Date.now(),
    }))
  },

  /**
   * Get current permissions
   */
  wallet_getPermissions: async (_params, origin) => {
    const connected = walletState.getConnectedAccounts(origin)
    const permissions: Array<{ parentCapability: string; date: number }> = []

    if (connected.length > 0) {
      permissions.push({
        parentCapability: 'eth_accounts',
        date: Date.now(),
      })
    }

    return permissions
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
 * Format transaction type to hex string
 * Converts viem's string type (e.g., "legacy", "eip1559") to JSON-RPC hex format
 */
function formatTransactionType(type: string): Hex {
  const typeMap: Record<string, number> = {
    legacy: 0,
    eip2930: 1,
    eip1559: 2,
    eip4844: 3,
    eip7702: 4,
  }
  const typeNumber = typeMap[type] ?? 0
  return `0x${typeNumber.toString(16)}` as Hex
}

/**
 * Create a typed RPC error
 */
function createRpcError(error: { code: number; message: string; data?: unknown }): RpcError {
  return new RpcError(error.code, error.message, error.data)
}

/**
 * Format balance with decimals
 */
function formatBalance(balance: string, decimals: number): string {
  if (balance === '0') return '0'

  const bn = BigInt(balance)
  const divisor = BigInt(10 ** decimals)
  const whole = bn / divisor
  const remainder = bn % divisor

  if (remainder === 0n) {
    return whole.toString()
  }

  const remainderStr = remainder.toString().padStart(decimals, '0')
  const trimmed = remainderStr.replace(/0+$/, '')

  return `${whole}.${trimmed}`
}

/**
 * Decode string result from ABI-encoded data
 */
function decodeStringResult(data: Hex | undefined): string {
  if (!data || data === '0x') return ''

  const hex = data.replace('0x', '')

  // Check if it's a dynamic string (starts with offset)
  if (hex.length >= 128) {
    // Dynamic string: offset (32 bytes) + length (32 bytes) + data
    const lengthHex = hex.slice(64, 128)
    const length = Number.parseInt(lengthHex, 16)
    const stringHex = hex.slice(128, 128 + length * 2)
    try {
      // Convert hex to UTF-8 string
      const bytes = new Uint8Array(
        stringHex.match(/.{2}/g)?.map((b) => Number.parseInt(b, 16)) ?? []
      )
      return new TextDecoder().decode(bytes).replace(/\0/g, '')
    } catch {
      return ''
    }
  }

  // Static bytes32 string
  try {
    const bytes = new Uint8Array(hex.match(/.{2}/g)?.map((b) => Number.parseInt(b, 16)) ?? [])
    return new TextDecoder().decode(bytes).replace(/\0/g, '')
  } catch {
    return ''
  }
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
      break

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

/**
 * Format block for JSON-RPC response
 */
function formatBlock(
  block: {
    number: bigint | null
    hash: Hex | null
    parentHash: Hex
    nonce: Hex | null
    sha3Uncles: Hex
    logsBloom: Hex | null
    transactionsRoot: Hex
    stateRoot: Hex
    receiptsRoot: Hex
    miner: Address
    difficulty: bigint
    totalDifficulty: bigint | null
    extraData: Hex
    size: bigint
    gasLimit: bigint
    gasUsed: bigint
    timestamp: bigint
    transactions: readonly (Hex | { hash: Hex })[]
    uncles: readonly Hex[]
    baseFeePerGas?: bigint | null
  },
  includeTransactions: boolean
): Record<string, unknown> {
  return {
    number: block.number ? `0x${block.number.toString(16)}` : null,
    hash: block.hash,
    parentHash: block.parentHash,
    nonce: block.nonce,
    sha3Uncles: block.sha3Uncles,
    logsBloom: block.logsBloom,
    transactionsRoot: block.transactionsRoot,
    stateRoot: block.stateRoot,
    receiptsRoot: block.receiptsRoot,
    miner: block.miner,
    difficulty: `0x${block.difficulty.toString(16)}`,
    totalDifficulty: block.totalDifficulty ? `0x${block.totalDifficulty.toString(16)}` : null,
    extraData: block.extraData,
    size: `0x${block.size.toString(16)}`,
    gasLimit: `0x${block.gasLimit.toString(16)}`,
    gasUsed: `0x${block.gasUsed.toString(16)}`,
    timestamp: `0x${block.timestamp.toString(16)}`,
    transactions: includeTransactions
      ? block.transactions
      : block.transactions.map((tx) => (typeof tx === 'string' ? tx : tx.hash)),
    uncles: block.uncles,
    baseFeePerGas: block.baseFeePerGas ? `0x${block.baseFeePerGas.toString(16)}` : null,
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
    // Use RpcError's serialize() if available, otherwise extract code/message
    if (error instanceof RpcError) {
      return { jsonrpc: '2.0', id, error: error.serialize() }
    }

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
