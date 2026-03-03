// Use SDK for bundler client, UserOperation utilities, and security modules
import {
  buildUserOpTypedData,
  createBundlerClient,
  getUserOperationHash,
  packUserOperation,
  // Module operations
  createModuleOperationClient,
  createRateLimiter,
  createTypedDataValidator,
  getModuleTypeName,
  // Security utilities
  InputValidator,
  type ModuleType,
  type UserOperation,
  ENTRY_POINT_ABI,
  KERNEL_ABI,
  // Gas constants
  BASE_TRANSFER_GAS,
  DEFAULT_CALL_GAS_LIMIT,
  DEFAULT_PRE_VERIFICATION_GAS,
  DEFAULT_VERIFICATION_GAS_LIMIT,
  EIP7702_AUTH_GAS,
  GAS_PER_AUTHORIZATION,
  GAS_BUFFER_MULTIPLIER,
  GAS_BUFFER_DIVISOR,
} from '@stablenet/core'
import type { Address, Hash, Hex } from 'viem'
import { createPublicClient, http } from 'viem'
import { concat, encodeFunctionData, getAddress, isAddress, pad, toHex } from 'viem/utils'
import {
  ENTRY_POINT_ADDRESS,
  getEcdsaValidator,
  getEntryPoint,
  isChainSupported,
} from '@stablenet/contracts'
import { DEFAULT_VALUES, RPC_ERRORS } from '../../shared/constants'
import { RpcError } from '../../shared/errors/rpcErrors'
import { handleApprovalError } from '../../shared/errors/WalletError'
import { createLogger } from '../../shared/utils/logger'
import type { JsonRpcRequest, JsonRpcResponse, SupportedMethod } from '../../types'
import { approvalController } from '../controllers/approvalController'
import { keyringController } from '../keyring'
import { checkOrigin } from '../security/phishingGuard'
import { walletState } from '../state/store'
import { eventBroadcaster } from '../utils/eventBroadcaster'
import { fetchFromPaymaster, sponsorAndSign } from './paymaster'
import {
  createRpcError,
  decodeStringResult,
  formatBalance,
  formatBlock,
  formatTransactionType,
  parseUserOperation,
} from './utils'
import { buildKernelInstallData } from './kernelInitData'
import { validateRpcParams } from './validation'
import {
  createValidatorRegistry,
  type ValidatorRegistry,
} from '../validators/validatorRegistry'
import { encodeValidatorNonceKey, VALIDATION_TYPE } from '@stablenet/core'

const logger = createLogger('RpcHandler')

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

// Singleton validator registry for multi-validator support
const validatorRegistry: ValidatorRegistry = createValidatorRegistry()
// Load persisted state — store the promise to await before first use
const registryReady = validatorRegistry.load().catch(() => {})

/**
 * Get the nonce key for the active validator of an account.
 * Returns 0n for ECDSA (root), encoded key for WebAuthn/MultiSig.
 */
async function getNonceKeyForAccount(account: Address, chainId?: number): Promise<bigint> {
  await registryReady
  const id = chainId ?? walletState.getCurrentNetwork()?.chainId ?? 8283
  const activeConfig = validatorRegistry.getActiveValidator(id, account)
  if (activeConfig.validatorType === 'ecdsa') {
    return 0n
  }
  return encodeValidatorNonceKey(activeConfig.validatorAddress, {
    type: VALIDATION_TYPE.VALIDATOR,
  })
}

/**
 * Get EntryPoint address for the current chain.
 * Uses deployment data for known chains, falls back to canonical address.
 */
function getEntryPointForChain(chainId?: number): Address {
  const id = chainId ?? walletState.getCurrentNetwork()?.chainId
  if (id && isChainSupported(id)) {
    return getEntryPoint(id) as Address
  }
  return ENTRY_POINT_ADDRESS as Address
}

/**
 * Resolve factory/factoryData for a UserOperation sender.
 * Returns factory info if the account is not yet deployed (ERC-4337 initCode).
 */
async function resolveFactory(
  sender: Address,
  rpcUrl: string
): Promise<{ factory: Address; factoryData: `0x${string}` } | null> {
  const account = walletState
    .getState()
    .accounts.accounts.find((a) => a.address.toLowerCase() === sender.toLowerCase())

  if (!account || account.isDeployed) return null

  // Double-check on-chain deployment status
  const client = getPublicClient(rpcUrl)
  const code = await client.getCode({ address: sender }).catch(() => undefined)
  if (code && code !== '0x') {
    // Account is deployed, update cached status
    const accounts = walletState
      .getState()
      .accounts.accounts.map((a) =>
        a.address.toLowerCase() === sender.toLowerCase() ? { ...a, isDeployed: true } : a
      )
    await walletState.setState({
      accounts: { ...walletState.getState().accounts, accounts },
    })
    return null
  }

  if (!account.factoryAddress || !account.factoryData) {
    logger.warn(`[resolveFactory] Account ${sender} is not deployed but has no factory info stored`)
    return null
  }

  return { factory: account.factoryAddress, factoryData: account.factoryData }
}

/**
 * Resolve the signing EOA address for a UserOp sender.
 *
 * For smart accounts (CREATE2-derived), the sender address is NOT in the keyring.
 * We need the ownerAddress (EOA) to sign with the correct key.
 * For delegated/EOA accounts, the sender IS the EOA — return as-is.
 */
function resolveSignerAddress(sender: Address): Address {
  const account = walletState
    .getState()
    .accounts.accounts.find((a) => a.address.toLowerCase() === sender.toLowerCase())

  if (account?.ownerAddress) {
    logger.info(`[resolveSignerAddress] ${sender.slice(0, 10)}... → owner=${account.ownerAddress.slice(0, 10)}... (type=${account.type})`)
    return account.ownerAddress
  }

  // No ownerAddress: either delegated/EOA (sender IS the signer) or unknown
  return sender
}

/**
 * Check if an account is an EIP-7702 delegated account.
 *
 * Kernel v0.3.3 EIP-7702 accounts use VALIDATION_TYPE_7702 (0x00) which
 * verifies signatures via ECDSA.recover(toEthSignedMessageHash(userOpHash), sig).
 * This requires EIP-191 signing (signMessage) instead of EIP-712 (signTypedData).
 */
function isDelegatedSender(sender: Address): boolean {
  const account = walletState
    .getState()
    .accounts.accounts.find((a) => a.address.toLowerCase() === sender.toLowerCase())
  return account?.type === 'delegated'
}

/**
 * Sign a UserOperation for submission.
 *
 * For EIP-7702 delegated accounts (Kernel VALIDATION_TYPE_7702):
 *   - Signs with EIP-191: signMessage(userOpHash) → adds "\x19Ethereum Signed Message:\n32" prefix
 *   - Kernel verifies: ECDSA.recover(toEthSignedMessageHash(userOpHash), sig) == address(this)
 *
 * For regular smart accounts (Kernel VALIDATION_TYPE_ROOT):
 *   - Signs with EIP-712: signTypedData(typedData) → structured PackedUserOperation hash
 *   - Kernel verifies via installed ECDSA validator module
 */
async function signUserOp(
  userOp: UserOperation,
  entryPoint: Address,
  chainId: number
): Promise<Hex> {
  const signerAddr = resolveSignerAddress(userOp.sender)

  if (isDelegatedSender(userOp.sender)) {
    // EIP-7702 path: Kernel uses _verify7702Signature which expects
    // ECDSA.recover(toEthSignedMessageHash(userOpHash), sig) == address(this)
    // signMessage with raw hash adds the EIP-191 prefix automatically
    const userOpHash = getUserOperationHash(userOp, entryPoint, BigInt(chainId))
    logger.info(`[signUserOp] EIP-7702 path: sender=${userOp.sender.slice(0, 10)}..., signerAddr=${signerAddr.slice(0, 10)}..., userOpHash=${userOpHash.slice(0, 14)}...`)
    return keyringController.signMessage(signerAddr, userOpHash)
  }

  // Standard smart account path: EIP-712 typed data signing
  const typedData = buildUserOpTypedData(userOp, entryPoint, BigInt(chainId))
  logger.info(`[signUserOp] EIP-712 path: sender=${userOp.sender.slice(0, 10)}..., signerAddr=${signerAddr.slice(0, 10)}...`)
  return keyringController.signTypedData(signerAddr, typedData)
}

/**
 * Normalize accountId to a canonical form.
 * Handles both "kernel.advanced.v0.3.3" (old) and "kernel.advanced.0.3.3" (new) formats.
 */
function normalizeAccountId(accountId: string): string {
  // Match pattern like "kernel.advanced.v0.3.3" → extract without the "v" prefix
  return accountId.replace(/\.v(\d+\.\d+\.\d+)$/, '.$1')
}

// Cache createPublicClient instances by rpcUrl with TTL-based eviction
const PUBLIC_CLIENT_CACHE_TTL = 30 * 60 * 1000 // 30 minutes
const PUBLIC_CLIENT_CACHE_MAX = 20

const publicClientCache = new Map<
  string,
  { client: ReturnType<typeof createPublicClient>; lastUsed: number }
>()

function getPublicClient(rpcUrl: string): ReturnType<typeof createPublicClient> {
  const now = Date.now()
  const entry = publicClientCache.get(rpcUrl)
  if (entry) {
    entry.lastUsed = now
    return entry.client
  }

  // Evict stale entries if cache is at capacity
  if (publicClientCache.size >= PUBLIC_CLIENT_CACHE_MAX) {
    let oldestKey: string | null = null
    let oldestTime = Infinity
    for (const [key, val] of publicClientCache) {
      if (now - val.lastUsed > PUBLIC_CLIENT_CACHE_TTL) {
        publicClientCache.delete(key)
      } else if (val.lastUsed < oldestTime) {
        oldestTime = val.lastUsed
        oldestKey = key
      }
    }
    // If still at capacity after TTL eviction, remove LRU entry
    if (publicClientCache.size >= PUBLIC_CLIENT_CACHE_MAX && oldestKey) {
      publicClientCache.delete(oldestKey)
    }
  }

  const client = createPublicClient({ transport: http(rpcUrl) })
  publicClientCache.set(rpcUrl, { client, lastUsed: now })
  return client
}

/**
 * Encode a Kernel v0.3.3 execute(bytes32 mode, bytes executionCalldata) call.
 * ExecMode 0x00 = single call, padded to 32 bytes.
 * executionCalldata = abi.encodePacked(target, value, callData)
 */
function encodeKernelExecute(to: Address, value: bigint = 0n, data: Hex = '0x'): Hex {
  const execMode = pad('0x00' as Hex, { size: 32 })
  const executionCalldata = concat([
    to,
    pad(toHex(value), { size: 32 }),
    data,
  ]) as Hex
  return encodeFunctionData({
    abi: KERNEL_ABI,
    functionName: 'execute',
    args: [execMode, executionCalldata],
  })
}

/**
 * Encode Kernel.initialize() calldata for EIP-7702 delegation.
 * Sets the root validator (ECDSA) and registers the EOA as its owner.
 *
 * @param validatorAddress - ECDSA validator contract address
 * @param ownerAddress - EOA address to register as the signer/owner
 */
function encodeKernelInitialize(validatorAddress: Address, ownerAddress: Address): Hex {
  // rootValidator is bytes21: 0x01 (MODULE_TYPE.VALIDATOR) + 20-byte validator address
  const rootValidator = concat([
    pad(toHex(1), { size: 1 }),
    validatorAddress,
  ]) as Hex
  const hook = '0x0000000000000000000000000000000000000000' as Address
  // validatorData = the owner address (ECDSA validator stores this as the signer)
  const validatorData = ownerAddress as Hex
  const hookData = '0x' as Hex
  const initConfig: Hex[] = []

  return encodeFunctionData({
    abi: KERNEL_ABI,
    functionName: 'initialize',
    args: [rootValidator, hook, validatorData, hookData, initConfig],
  })
}

type RpcHandler = (
  params: unknown[] | undefined,
  origin: string,
  isExtension: boolean
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
  wallet_signAuthorization: async (params, origin, isExtension) => {
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

    // Request user approval (skip for internal wallet UI - user already confirmed in DelegateSetup)
    const isInternalRequest = isExtension
    if (!isInternalRequest) {
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
   * Delegate Account via EIP-7702 (wallet_delegateAccount)
   * Combined authorization signing + transaction sending in a single step.
   * Handles the executor:'self' nonce adjustment automatically.
   *
   * This replaces the error-prone 2-step flow (wallet_signAuthorization + eth_sendTransaction)
   * by performing both operations internally, avoiding serialization round-trips and
   * ensuring correct nonce handling (authorization.nonce = tx.nonce + 1).
   */
  wallet_delegateAccount: async (params, origin, isExtension) => {
    const [request] = params as [
      {
        account: Address
        contractAddress: Address
        chainId?: number | string
      },
    ]

    if (!request?.account || !request?.contractAddress) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Missing required parameters: account and contractAddress',
      })
    }

    const { account, contractAddress } = request

    // Validate addresses
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

    // Verify account is connected (internal requests always pass)
    const isInternalRequest = isExtension
    if (!isInternalRequest) {
      const connectedAccounts = walletState.getConnectedAccounts(origin)
      const isAuthorized = connectedAccounts.some((a) => a.toLowerCase() === account.toLowerCase())
      if (!isAuthorized) {
        throw createRpcError(RPC_ERRORS.UNAUTHORIZED)
      }
    }

    // Check wallet is unlocked
    if (!keyringController.isUnlocked()) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: 'Wallet is locked',
      })
    }

    // Get network
    const network = walletState.getCurrentNetwork()
    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    const client = getPublicClient(network.rpcUrl)
    const chainId =
      request.chainId !== undefined
        ? typeof request.chainId === 'string'
          ? Number.parseInt(request.chainId, request.chainId.startsWith('0x') ? 16 : 10)
          : request.chainId
        : network.chainId

    // Request user approval for external requests
    if (!isInternalRequest) {
      try {
        await approvalController.requestAuthorization(origin, account, contractAddress, chainId, 0n)
      } catch (error) {
        handleApprovalError(error, { method: 'wallet_delegateAccount', origin })
      }
    }

    try {
      // Step 1: Get the transaction nonce (N)
      const txNonce = await client.getTransactionCount({ address: account })

      // Step 2: Authorization nonce = N + 1 (executor:'self' pattern)
      // When the EOA both signs the authorization AND sends the transaction:
      // - Transaction uses nonce N
      // - EVM increments sender nonce to N+1 before processing authorizations
      // - Authorization nonce must match the authority's nonce at processing time (N+1)
      const authNonce = BigInt(txNonce + 1)

      // Step 3: Create and sign the authorization
      const authorization = createAuthorization(chainId, contractAddress, authNonce)
      const authorizationHash = createAuthorizationHash(authorization)
      const signatureResult = await keyringController.signAuthorizationHash(
        account,
        authorizationHash
      )

      // Step 4: Kernel v0.3.3 EIP-7702 Design
      // Kernel intentionally blocks initialize() for EIP-7702 delegated accounts
      // (detects 0xef0100 prefix in address(this).code and reverts with AlreadyInitialized).
      // Instead, Kernel uses VALIDATION_TYPE_7702 (nonce key 0x00) which validates
      // signatures via ECDSA.recover(toEthSignedMessageHash(userOpHash), sig) == address(this).
      // No root validator or ECDSA module installation is needed.
      // The delegation transaction is a pure authorization-only tx with no data payload.

      // Step 5: Get gas prices and calculate gas
      // Pure delegation tx: base(21K) + authOverhead(25K) + perAuth(12.5K)
      const gasPrice = await client.getGasPrice()
      const numAuths = 1n
      const baseGas = BASE_TRANSFER_GAS + EIP7702_AUTH_GAS + GAS_PER_AUTHORIZATION * numAuths
      const gas = (baseGas * GAS_BUFFER_MULTIPLIER) / GAS_BUFFER_DIVISOR

      // Step 6: Build the EIP-7702 transaction
      // No data payload — delegation alone is sufficient for Kernel EIP-7702 mode
      const transaction = {
        to: account,
        value: 0n,
        data: '0x' as Hex,
        gas,
        nonce: txNonce,
        chainId: network.chainId,
        maxFeePerGas: gasPrice * 2n,
        maxPriorityFeePerGas: gasPrice / 10n > 0n ? gasPrice / 10n : 1_000_000n,
        type: 'eip7702' as const,
        authorizationList: [
          {
            address: contractAddress,
            chainId: chainId,
            nonce: txNonce + 1,
            yParity: signatureResult.v as 0 | 1,
            r: signatureResult.r,
            s: signatureResult.s,
            v: BigInt(signatureResult.v),
          },
        ],
      }

      // Step 7: Sign the transaction
      const signedTx = await keyringController.signTransaction(account, transaction)

      // Step 8: Broadcast
      const txHash = await client.sendRawTransaction({
        serializedTransaction: signedTx,
      })

      // Track pending transaction
      try {
        const txId = `delegate-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        await walletState.addPendingTransaction({
          id: txId,
          from: account,
          to: account,
          value: 0n,
          data: '0x' as Hex,
          chainId: network.chainId,
          status: 'submitted',
          type: 'send',
          txHash,
          timestamp: Date.now(),
        })
      } catch (_err) {
        logger.warn('Failed to track delegation transaction (tx was broadcast successfully)')
      }

      // Update account type to 'delegated' after successful broadcast
      try {
        await walletState.updateAccount(account, {
          type: 'delegated',
          delegateAddress: contractAddress,
        })
      } catch (_err) {
        logger.warn('Failed to update account type after delegation (tx was broadcast successfully)')
      }

      return { txHash }
    } catch (error) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'EIP-7702 delegation failed',
      })
    }
  },

  /**
   * Send a UserOperation (ERC-4337)
   */
  eth_sendUserOperation: async (params, origin, isExtension) => {
    const [userOpParam, entryPointParam] = params as [unknown, Address]

    // Verify connection
    if (!walletState.isConnected(origin)) {
      throw createRpcError(RPC_ERRORS.UNAUTHORIZED)
    }

    // Validate entryPoint
    const entryPoint = entryPointParam ?? getEntryPointForChain()
    if (!isAddress(entryPoint)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid entryPoint address',
      })
    }

    // Encode callData from target/value/data if not already present (UI sends this format)
    const raw = userOpParam as Record<string, unknown>
    if (!raw.callData && raw.target) {
      raw.callData = encodeKernelExecute(
        raw.target as Address,
        raw.value ? BigInt(raw.value as string) : 0n,
        (raw.data as Hex) || '0x'
      )
    }

    // Extract gasPayment before parsing (not part of UserOperation schema)
    const gasPayment = raw.gasPayment as { type: string; tokenAddress?: string } | undefined
    delete raw.gasPayment

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
    const bundlerUrl = network.bundlerUrl

    // Fetch current nonce from EntryPoint if not provided by the caller
    if (userOp.nonce === 0n) {
      const publicClient = getPublicClient(network.rpcUrl)
      const onChainNonce = await publicClient
        .readContract({
          address: entryPoint,
          abi: [
            {
              inputs: [
                { name: 'sender', type: 'address' },
                { name: 'key', type: 'uint192' },
              ],
              name: 'getNonce',
              outputs: [{ name: '', type: 'uint256' }],
              stateMutability: 'view',
              type: 'function',
            },
          ],
          functionName: 'getNonce',
          args: [userOp.sender, await getNonceKeyForAccount(userOp.sender, network.chainId)],
        })
        .catch(() => 0n)
      userOp.nonce = onChainNonce
    }

    // Resolve factory/initCode for undeployed accounts (ERC-4337)
    if (!userOp.factory) {
      const factoryInfo = await resolveFactory(userOp.sender, network.rpcUrl)
      if (factoryInfo) {
        userOp.factory = factoryInfo.factory
        userOp.factoryData = factoryInfo.factoryData
        logger.info(`[eth_sendUserOperation] Account not deployed, attaching factory: ${factoryInfo.factory}`)
      }
    }

    // Estimate gas prices if not provided by the caller
    if (userOp.maxFeePerGas === 0n) {
      const publicClient = getPublicClient(network.rpcUrl)
      try {
        const fees = await publicClient.estimateFeesPerGas()
        // Add 25% buffer for price fluctuation between estimation and inclusion
        const buffer = (fees.maxFeePerGas ?? 0n) / 4n
        userOp.maxFeePerGas = (fees.maxFeePerGas ?? 0n) + buffer
        // ERC-4337: maxPriorityFeePerGas must not exceed maxFeePerGas
        const rawPriority = fees.maxPriorityFeePerGas ?? 0n
        userOp.maxPriorityFeePerGas = rawPriority > userOp.maxFeePerGas ? userOp.maxFeePerGas : rawPriority
      } catch {
        // Fallback to legacy gas price for non-EIP-1559 chains
        const gasPrice = await publicClient.getGasPrice()
        const buffer = gasPrice / 4n
        userOp.maxFeePerGas = gasPrice + buffer
        userOp.maxPriorityFeePerGas = gasPrice
      }
    }

    // Calculate estimated gas cost for approval display (pre-estimation defaults)
    const estimatedGasCost =
      (userOp.preVerificationGas + userOp.verificationGasLimit + userOp.callGasLimit) *
      userOp.maxFeePerGas

    // Request user approval (skip for internal wallet UI - user already confirmed)
    const isInternalRequest = isExtension
    if (!isInternalRequest) {
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
    }

    // Helper to submit UserOp and track pending transaction
    const submitAndTrack = async (signedOp: UserOperation) => {
      const bundlerClient = createBundlerClient({ url: bundlerUrl, entryPoint })
      const userOpHash = await bundlerClient.sendUserOperation(signedOp)

      // Track as pending transaction with userOpHash (txHash comes later from bundler polling)
      try {
        const txId = `userop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        const target = raw.target as Address | undefined
        await walletState.addPendingTransaction({
          id: txId,
          from: signedOp.sender,
          to: target ?? signedOp.sender,
          value: raw.value ? BigInt(raw.value as string) : 0n,
          data: signedOp.callData,
          chainId: network.chainId,
          status: 'submitted',
          type: 'userOp',
          userOpHash,
          timestamp: Date.now(),
          maxFeePerGas: signedOp.maxFeePerGas,
          maxPriorityFeePerGas: signedOp.maxPriorityFeePerGas,
        })
      } catch {
        // Non-blocking: pending tx tracking failure should not fail the UserOp submission
      }

      return userOpHash
    }

    // ERC-7677: sponsorAndSign handles stub → estimate → final → sign
    const shouldSponsor = gasPayment?.type === 'sponsor' || gasPayment?.type === 'erc20' || (!gasPayment && !!network.paymasterUrl)
    logger.info(`[eth_sendUserOperation] sender=${userOp.sender}, nonce=${userOp.nonce}, shouldSponsor=${shouldSponsor}, gasPayment=${JSON.stringify(gasPayment ?? 'none')}`)

    if (!userOp.paymaster && shouldSponsor && network.paymasterUrl) {
      const paymasterContext: Record<string, unknown> =
        gasPayment?.type === 'erc20' && gasPayment.tokenAddress
          ? { paymasterType: 'erc20', tokenAddress: gasPayment.tokenAddress }
          : {}

      logger.info(`[eth_sendUserOperation] Sponsored path: paymasterUrl=${network.paymasterUrl}, context=${JSON.stringify(paymasterContext)}`)

      const signedUserOp = await sponsorAndSign({
        userOp,
        paymasterUrl: network.paymasterUrl,
        entryPoint,
        chainId: network.chainId,
        context: paymasterContext,
        bundlerUrl,
        signer: async (finalOp) => {
          return signUserOp(finalOp, entryPoint, network.chainId)
        },
      })

      if (signedUserOp) {
        logger.info(`[eth_sendUserOperation] sponsorAndSign OK, submitting to bundler...`)

        // AA24 diagnostic: compare client-side hash with on-chain EntryPoint hash
        try {
          const clientHash = getUserOperationHash(signedUserOp, entryPoint, BigInt(network.chainId))
          const packed = packUserOperation(signedUserOp)
          // Cast packed to satisfy EntryPoint ABI tuple type (nonce is Hex in packed but bigint in ABI)
          const packedForAbi = { ...packed, nonce: BigInt(packed.nonce), preVerificationGas: BigInt(packed.preVerificationGas) }
          const onChainHash = await getPublicClient(network.rpcUrl).readContract({
            address: entryPoint,
            abi: ENTRY_POINT_ABI,
            functionName: 'getUserOpHash',
            args: [packedForAbi as never],
          }) as `0x${string}`
          const hashMatch = clientHash === onChainHash
          logger.info(`[eth_sendUserOperation] HASH DIAG: clientHash=${clientHash.slice(0, 14)}..., onChainHash=${String(onChainHash).slice(0, 14)}..., match=${hashMatch}`)
          if (!hashMatch) {
            logger.error(`[eth_sendUserOperation] HASH MISMATCH! Client signs different hash than EntryPoint expects. clientHash=${clientHash}, onChainHash=${String(onChainHash)}`)
          }
        } catch (hashErr) {
          logger.warn(`[eth_sendUserOperation] HASH DIAG failed: ${(hashErr as Error).message}`)
        }

        try {
          const hash = await submitAndTrack(signedUserOp)
          logger.info(`[eth_sendUserOperation] Bundler accepted: userOpHash=${hash}`)
          return hash
        } catch (error) {
          const err = error as Error & { code?: number; data?: unknown }
          logger.error(`[eth_sendUserOperation] Bundler REJECTED: code=${err.code}, msg=${err.message}, data=${JSON.stringify(err.data ?? null)}`)
          throw createRpcError({
            code: err.code ?? RPC_ERRORS.INTERNAL_ERROR.code,
            message: err.message || 'UserOperation submission failed',
            data: err.data,
          })
        }
      }
      logger.warn('[eth_sendUserOperation] sponsorAndSign returned null, falling through to self-pay')
      // sponsorAndSign returned null → fall through to self-pay
    }

    // Self-pay path: estimate gas without paymaster, then sign with EIP-712
    // NOTE: Do NOT add extra buffer here — the bundler's estimator already includes
    // configurable buffers (default 10%). Adding more causes double-buffering that
    // can exceed MAX_VERIFICATION_GAS validation limits.
    logger.info('[eth_sendUserOperation] Self-pay path: estimating gas without paymaster')
    try {
      const bundlerClient = createBundlerClient({ url: bundlerUrl, entryPoint })
      const gasEstimate = await bundlerClient.estimateUserOperationGas(userOp)
      userOp.preVerificationGas = gasEstimate.preVerificationGas
      userOp.verificationGasLimit = gasEstimate.verificationGasLimit
      userOp.callGasLimit = gasEstimate.callGasLimit
      logger.info(`[eth_sendUserOperation] Self-pay gas OK: preVerif=${userOp.preVerificationGas}, verifLimit=${userOp.verificationGasLimit}, callLimit=${userOp.callGasLimit}`)
    } catch (error) {
      logger.warn(`[eth_sendUserOperation] Self-pay gas estimation FAILED, using defaults: ${(error as Error).message}`)
      userOp.verificationGasLimit = DEFAULT_VERIFICATION_GAS_LIMIT
      userOp.callGasLimit = DEFAULT_CALL_GAS_LIMIT
      userOp.preVerificationGas = DEFAULT_PRE_VERIFICATION_GAS
    }

    let signedUserOp: UserOperation
    try {
      const signature = await signUserOp(userOp, entryPoint, network.chainId)
      signedUserOp = { ...userOp, signature }
      logger.info(`[eth_sendUserOperation] Self-pay signed OK: sigLen=${signature.length}`)
    } catch (error) {
      logger.error(`[eth_sendUserOperation] Self-pay signing FAILED: ${(error as Error).message}`)
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'UserOperation signing failed',
      })
    }

    // AA24 diagnostic: compare client-side hash with on-chain EntryPoint hash
    try {
      const clientHash = getUserOperationHash(signedUserOp, entryPoint, BigInt(network.chainId))
      const packed = packUserOperation(signedUserOp)
      const packedForAbi = { ...packed, nonce: BigInt(packed.nonce), preVerificationGas: BigInt(packed.preVerificationGas) }
      const onChainHash = await getPublicClient(network.rpcUrl).readContract({
        address: entryPoint,
        abi: ENTRY_POINT_ABI,
        functionName: 'getUserOpHash',
        args: [packedForAbi as never],
      }) as `0x${string}`
      const hashMatch = clientHash === onChainHash
      logger.info(`[eth_sendUserOperation] HASH DIAG (self-pay): clientHash=${clientHash.slice(0, 14)}..., onChainHash=${String(onChainHash).slice(0, 14)}..., match=${hashMatch}`)
      if (!hashMatch) {
        logger.error(`[eth_sendUserOperation] HASH MISMATCH! clientHash=${clientHash}, onChainHash=${String(onChainHash)}`)
      }
    } catch (hashErr) {
      logger.warn(`[eth_sendUserOperation] HASH DIAG (self-pay) failed: ${(hashErr as Error).message}`)
    }

    try {
      const hash = await submitAndTrack(signedUserOp)
      logger.info(`[eth_sendUserOperation] Self-pay submitted OK: userOpHash=${hash}`)
      return hash
    } catch (error) {
      const err = error as Error & { code?: number; data?: unknown }
      logger.error(`[eth_sendUserOperation] Self-pay bundler REJECTED: code=${err.code}, msg=${err.message}, data=${JSON.stringify(err.data ?? null)}`)
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
    const entryPoint = entryPointParam ?? getEntryPointForChain()
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
      const bundlerClient = createBundlerClient({
        url: network.bundlerUrl,
        entryPoint: getEntryPointForChain(network.chainId),
        chainId: BigInt(network.chainId),
      })
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
      const bundlerClient = createBundlerClient({
        url: network.bundlerUrl,
        entryPoint: getEntryPointForChain(network.chainId),
        chainId: BigInt(network.chainId),
      })
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
   * Get UserOperation status from bundler mempool
   */
  debug_bundler_getUserOperationStatus: async (params) => {
    const [userOpHash] = params as [Hex]
    const network = walletState.getCurrentNetwork()

    if (!network?.bundlerUrl) {
      throw createRpcError(RPC_ERRORS.RESOURCE_UNAVAILABLE)
    }

    try {
      const response = await fetch(network.bundlerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'debug_bundler_getUserOperationStatus',
          params: [userOpHash],
        }),
      })
      const json = await response.json()
      return json.result ?? null
    } catch {
      return null
    }
  },

  /**
   * Get supported entry points
   */
  eth_supportedEntryPoints: async () => {
    const network = walletState.getCurrentNetwork()

    if (!network?.bundlerUrl) {
      // Return default entry points if bundler not configured
      return [getEntryPointForChain()]
    }

    try {
      const bundlerClient = createBundlerClient({
        url: network.bundlerUrl,
        entryPoint: getEntryPointForChain(network.chainId),
        chainId: BigInt(network.chainId),
      })
      return await bundlerClient.getSupportedEntryPoints()
    } catch {
      // Fallback to default entry points
      return [getEntryPointForChain()]
    }
  },

  /**
   * Send a transaction
   * Signs and broadcasts a transaction to the network
   */
  eth_sendTransaction: async (params, origin, isExtension) => {
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
        type?: string
        authorizationList?: Array<{
          chainId: string | number
          address: Address
          nonce: string | number
          v: string | number
          r: string
          s: string
        }>
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
        // Delegated accounts (EIP-7702 → Kernel) need more gas than plain EOA transfers
        // because Kernel's receive()/fallback() runs validation logic
        const accountInfo = walletState.getAccounts().find(
          (a) => a.address.toLowerCase() === txParams.from.toLowerCase()
        )
        gas = accountInfo?.type === 'delegated'
          ? DEFAULT_CALL_GAS_LIMIT  // 200K — covers Kernel dispatch + validation
          : DEFAULT_VALUES.GAS_LIMIT // 21K — plain EOA transfer
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

    // Request user approval (skip for internal wallet UI - user already confirmed)
    const isInternalRequest = isExtension
    if (!isInternalRequest) {
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
    }

    // Check if this is an EIP-7702 SetCode transaction
    const isEip7702 =
      txParams.type === '0x04' ||
      (txParams.authorizationList && txParams.authorizationList.length > 0)

    // Build transaction object for signing
    const transaction = isEip7702
      ? {
          to: txParams.to,
          value: txParams.value ? BigInt(txParams.value) : BigInt(0),
          data: txParams.data,
          gas,
          nonce,
          chainId: network.chainId,
          maxFeePerGas: maxFeePerGas ?? gasPrice ?? (await client.getGasPrice()),
          maxPriorityFeePerGas: maxPriorityFeePerGas ?? maxFeePerGas ?? gasPrice ?? BigInt(0),
          type: 'eip7702' as const,
          authorizationList: (txParams.authorizationList ?? []).map((auth) => ({
            chainId: Number(auth.chainId),
            address: auth.address,
            nonce: Number(auth.nonce),
            v: BigInt(auth.v),
            r: auth.r as Hex,
            s: auth.s as Hex,
            yParity: Number(auth.v) === 0 ? 0 : Number(auth.v) === 1 ? 1 : Number(auth.v) - 27,
          })),
        }
      : {
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
    let txHash: Hash
    try {
      txHash = await client.sendRawTransaction({
        serializedTransaction: signedTx,
      })
    } catch (error) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'Transaction broadcast failed',
      })
    }

    // Track pending transaction in wallet state (non-blocking)
    try {
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
    } catch (_err) {
      logger.warn('Failed to track pending transaction (tx was broadcast successfully)')
    }

    return txHash
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
        gasPaymentMode?: 'native' | 'sponsor' | 'erc20'
        gasPaymentTokenAddress?: Address
      },
    ]

    if (!moduleParams) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Missing module installation parameters',
      })
    }

    const {
      account,
      moduleAddress,
      moduleType,
      initData,
      initDataEncoded,
      chainId,
      gasPaymentMode = 'sponsor',
      gasPaymentTokenAddress,
    } = moduleParams

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

    // Determine module-specific init data
    const moduleSpecificData: Hex = initDataEncoded ? (initData as Hex) : ('0x' as Hex)

    // Wrap in Kernel v3 format: [hook(20 bytes)][ABI-encoded struct]
    // Validators need (validatorData, hookData, selectorData) wrapping
    // Executors need (executorData, hookData) wrapping
    const kernelInitData = buildKernelInstallData(moduleTypeParsed, moduleSpecificData)

    // Create module operation client and prepare calldata
    const moduleOpClient = createModuleOperationClient({ chainId })
    const moduleCalldata = moduleOpClient.prepareInstall(account, {
      moduleAddress,
      moduleType: moduleTypeParsed,
      initData: kernelInitData,
    })

    // Build a UserOperation to execute the module installation
    // This calls the smart account's installModule function
    const client = getPublicClient(network.rpcUrl)

    // Get current nonce from EntryPoint (authoritative source for ERC-4337)
    const entryPoint = getEntryPointForChain(chainId)
    const nonce = await client
      .readContract({
        address: entryPoint,
        abi: ENTRY_POINT_ABI,
        functionName: 'getNonce',
        args: [account, await getNonceKeyForAccount(account)],
      })
      .catch(() => 0n)

    // Get gas prices
    const feeData = await client.estimateFeesPerGas().catch(() => ({
      maxFeePerGas: BigInt(1e9),
      maxPriorityFeePerGas: BigInt(1e8),
    }))

    // Resolve factory for undeployed accounts
    const factoryInfo = network.rpcUrl ? await resolveFactory(account, network.rpcUrl) : null

    // Create UserOperation
    const userOp: UserOperation = {
      sender: account,
      nonce,
      factory: factoryInfo?.factory ?? undefined,
      factoryData: factoryInfo?.factoryData ?? undefined,
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

    // Calculate estimated gas cost for approval display (pre-paymaster estimate)
    const estimatedGasCost =
      (userOp.preVerificationGas + userOp.verificationGasLimit + userOp.callGasLimit) *
      userOp.maxFeePerGas

    // Request user approval (skip for internal wallet UI)
    if (origin !== 'extension' && origin !== 'internal') {
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
    }

    // ERC-7677: sponsorAndSign handles stub → estimate → final → sign
    if (gasPaymentMode !== 'native' && network.paymasterUrl) {
      const paymasterContext: Record<string, unknown> =
        gasPaymentMode === 'erc20' && gasPaymentTokenAddress
          ? { paymasterType: 'erc20', tokenAddress: gasPaymentTokenAddress }
          : {}

      const signedUserOp = await sponsorAndSign({
        userOp,
        paymasterUrl: network.paymasterUrl,
        entryPoint,
        chainId,
        context: paymasterContext,
        bundlerUrl: network.bundlerUrl,
        signer: async (finalOp) => {
          return signUserOp(finalOp, entryPoint, chainId)
        },
      })

      if (signedUserOp) {
        try {
          const bundlerClient = createBundlerClient({ url: network.bundlerUrl, entryPoint })
          const userOpHash = await bundlerClient.sendUserOperation(signedUserOp)
          return { hash: userOpHash }
        } catch (error) {
          const err = error as Error & { code?: number; data?: unknown }
          const message = err.message?.includes('fetch')
            ? `Bundler unreachable (${network.bundlerUrl}): ${err.message}`
            : err.message || 'Module installation failed'
          throw createRpcError({
            code: err.code ?? RPC_ERRORS.INTERNAL_ERROR.code,
            message,
            data: err.data,
          })
        }
      }
      // sponsorAndSign returned null → fall through to self-pay
    }

    // Self-pay path: sign with EIP-712 and submit directly
    let signedUserOp: UserOperation
    try {
      const signature = await signUserOp(userOp, entryPoint, chainId)
      signedUserOp = { ...userOp, signature }
    } catch (error) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'UserOperation signing failed',
      })
    }

    try {
      const bundlerClient = createBundlerClient({ url: network.bundlerUrl, entryPoint })
      const userOpHash = await bundlerClient.sendUserOperation(signedUserOp)
      return { hash: userOpHash }
    } catch (error) {
      const err = error as Error & { code?: number; data?: unknown }
      const message = err.message?.includes('fetch')
        ? `Bundler unreachable (${network.bundlerUrl}): ${err.message}`
        : err.message || 'Module installation failed'
      throw createRpcError({
        code: err.code ?? RPC_ERRORS.INTERNAL_ERROR.code,
        message,
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
        gasPaymentMode?: 'native' | 'sponsor' | 'erc20'
        gasPaymentTokenAddress?: Address
      },
    ]

    if (!moduleParams) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Missing module uninstallation parameters',
      })
    }

    const {
      account,
      moduleAddress,
      moduleType,
      chainId,
      deInitData = '0x' as Hex,
      gasPaymentMode = 'sponsor',
      gasPaymentTokenAddress,
    } = moduleParams

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
    const bundlerUrl = network.bundlerUrl

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

    // Get current nonce from EntryPoint (authoritative source for ERC-4337)
    const entryPoint = getEntryPointForChain(chainId)
    const nonce = await client
      .readContract({
        address: entryPoint,
        abi: ENTRY_POINT_ABI,
        functionName: 'getNonce',
        args: [account, await getNonceKeyForAccount(account)],
      })
      .catch(() => 0n)

    // Get gas prices
    const feeData = await client.estimateFeesPerGas().catch(() => ({
      maxFeePerGas: BigInt(1e9),
      maxPriorityFeePerGas: BigInt(1e8),
    }))

    // Resolve factory for undeployed accounts
    const factoryInfo2 = network.rpcUrl ? await resolveFactory(account, network.rpcUrl) : null

    // Create UserOperation
    const userOp: UserOperation = {
      sender: account,
      nonce,
      factory: factoryInfo2?.factory ?? undefined,
      factoryData: factoryInfo2?.factoryData ?? undefined,
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

    // Calculate estimated gas cost for approval display
    const estimatedGasCost =
      (userOp.preVerificationGas + userOp.verificationGasLimit + userOp.callGasLimit) *
      userOp.maxFeePerGas

    // Request user approval (skip for internal wallet UI requests)
    if (origin !== 'extension' && origin !== 'internal') {
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
    }

    // Helper to submit and handle uninstall-specific errors
    const submitUninstallOp = async (signedOp: UserOperation) => {
      try {
        const bundlerClient = createBundlerClient({ url: bundlerUrl, entryPoint })
        const userOpHash = await bundlerClient.sendUserOperation(signedOp)
        return { hash: userOpHash }
      } catch (error) {
        const err = error as Error & { code?: number; data?: unknown }

        // Detect ModuleOnUninstallFailed and suggest forceUninstallModule
        const errMsg = err.message ?? ''
        if (
          errMsg.includes('Module rejected uninstall') ||
          errMsg.includes('0x45b4a14f') ||
          errMsg.includes('ModuleOnUninstallFailed')
        ) {
          throw createRpcError({
            code: err.code ?? RPC_ERRORS.INTERNAL_ERROR.code,
            message:
              'Module rejected uninstall operation. Use stablenet_forceUninstallModule for emergency removal.',
            data: { ...((err.data as object) ?? {}), suggestForceUninstall: true },
          })
        }

        const message = err.message?.includes('fetch')
          ? `Bundler unreachable (${bundlerUrl}): ${err.message}`
          : err.message || 'Module uninstallation failed'
        throw createRpcError({
          code: err.code ?? RPC_ERRORS.INTERNAL_ERROR.code,
          message,
          data: err.data,
        })
      }
    }

    // ERC-7677: sponsorAndSign handles stub → estimate → final → sign
    if (gasPaymentMode !== 'native' && network.paymasterUrl) {
      const paymasterContext: Record<string, unknown> =
        gasPaymentMode === 'erc20' && gasPaymentTokenAddress
          ? { paymasterType: 'erc20', tokenAddress: gasPaymentTokenAddress }
          : {}

      const signedUserOp = await sponsorAndSign({
        userOp,
        paymasterUrl: network.paymasterUrl,
        entryPoint,
        chainId,
        context: paymasterContext,
        bundlerUrl,
        signer: async (finalOp) => {
          return signUserOp(finalOp, entryPoint, chainId)
        },
      })

      if (signedUserOp) {
        return submitUninstallOp(signedUserOp)
      }
      // sponsorAndSign returned null → fall through to self-pay
    }

    // Self-pay path: sign with EIP-712 and submit directly
    let signedUserOp: UserOperation
    try {
      const signature = await signUserOp(userOp, entryPoint, chainId)
      signedUserOp = { ...userOp, signature }
    } catch (error) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'UserOperation signing failed',
      })
    }

    return submitUninstallOp(signedUserOp)
  },

  /**
   * Force uninstall a module from a Smart Account (ERC-7579)
   * Uses ExcessivelySafeCall — module onUninstall() revert is ignored.
   */
  stablenet_forceUninstallModule: async (params, origin) => {
    const [moduleParams] = params as [
      {
        account: Address
        moduleAddress: Address
        moduleType: string
        chainId: number
        deInitData?: Hex
        gasPaymentMode?: 'native' | 'sponsor' | 'erc20'
        gasPaymentTokenAddress?: Address
      },
    ]

    if (!moduleParams) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Missing module force uninstallation parameters',
      })
    }

    const {
      account,
      moduleAddress,
      moduleType,
      chainId,
      deInitData = '0x' as Hex,
      gasPaymentMode = 'sponsor',
      gasPaymentTokenAddress,
    } = moduleParams

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

    const moduleTypeParsed = BigInt(moduleType) as ModuleType
    const moduleTypeNameStr = getModuleTypeName(moduleTypeParsed)

    const moduleOpClient = createModuleOperationClient({ chainId })
    const moduleCalldata = moduleOpClient.prepareForceUninstall(account, {
      moduleAddress,
      moduleType: moduleTypeParsed,
      deInitData,
    })

    const client = getPublicClient(network.rpcUrl)
    const entryPoint = getEntryPointForChain(chainId)
    const nonce = await client
      .readContract({
        address: entryPoint,
        abi: ENTRY_POINT_ABI,
        functionName: 'getNonce',
        args: [account, await getNonceKeyForAccount(account)],
      })
      .catch(() => 0n)

    const feeData = await client.estimateFeesPerGas().catch(() => ({
      maxFeePerGas: BigInt(1e9),
      maxPriorityFeePerGas: BigInt(1e8),
    }))

    // Resolve factory for undeployed accounts
    const factoryInfo = network.rpcUrl ? await resolveFactory(account, network.rpcUrl) : null

    const userOp: UserOperation = {
      sender: account,
      nonce,
      factory: factoryInfo?.factory ?? undefined,
      factoryData: factoryInfo?.factoryData ?? undefined,
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

    const estimatedGasCost =
      (userOp.preVerificationGas + userOp.verificationGasLimit + userOp.callGasLimit) *
      userOp.maxFeePerGas

    if (origin !== 'extension' && origin !== 'internal') {
      try {
        await approvalController.requestTransaction(
          origin,
          account,
          account,
          BigInt(0),
          moduleCalldata.data,
          estimatedGasCost,
          `Force Uninstall ${moduleTypeNameStr} Module`,
          undefined
        )
      } catch (error) {
        handleApprovalError(error, { method: 'wallet_forceUninstallModule', origin })
      }
    }

    // ERC-7677: sponsorAndSign handles stub → estimate → final → sign
    if (gasPaymentMode !== 'native' && network.paymasterUrl) {
      const paymasterContext: Record<string, unknown> =
        gasPaymentMode === 'erc20' && gasPaymentTokenAddress
          ? { paymasterType: 'erc20', tokenAddress: gasPaymentTokenAddress }
          : {}

      const signedUserOp = await sponsorAndSign({
        userOp,
        paymasterUrl: network.paymasterUrl,
        entryPoint,
        chainId,
        context: paymasterContext,
        bundlerUrl: network.bundlerUrl,
        signer: async (finalOp) => {
          return signUserOp(finalOp, entryPoint, chainId)
        },
      })

      if (signedUserOp) {
        try {
          const bundlerClient = createBundlerClient({ url: network.bundlerUrl, entryPoint })
          const userOpHash = await bundlerClient.sendUserOperation(signedUserOp)
          return { hash: userOpHash }
        } catch (error) {
          const err = error as Error & { code?: number; data?: unknown }
          const message = err.message?.includes('fetch')
            ? `Bundler unreachable (${network.bundlerUrl}): ${err.message}`
            : err.message || 'Module force uninstallation failed'
          throw createRpcError({
            code: err.code ?? RPC_ERRORS.INTERNAL_ERROR.code,
            message,
            data: err.data,
          })
        }
      }
    }

    // Self-pay path: sign with EIP-712 and submit directly
    let signedUserOp: UserOperation
    try {
      const signature = await signUserOp(userOp, entryPoint, chainId)
      signedUserOp = { ...userOp, signature }
    } catch (error) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'UserOperation signing failed',
      })
    }

    try {
      const bundlerClient = createBundlerClient({ url: network.bundlerUrl, entryPoint })
      const userOpHash = await bundlerClient.sendUserOperation(signedUserOp)
      return { hash: userOpHash }
    } catch (error) {
      const err = error as Error & { code?: number; data?: unknown }
      const message = err.message?.includes('fetch')
        ? `Bundler unreachable (${network.bundlerUrl}): ${err.message}`
        : err.message || 'Module force uninstallation failed'
      throw createRpcError({
        code: err.code ?? RPC_ERRORS.INTERNAL_ERROR.code,
        message,
        data: err.data,
      })
    }
  },

  /**
   * Replace a module atomically on a Smart Account (ERC-7579)
   * Old module is uninstalled and new module is installed in a single transaction.
   * If the new module install fails, the old module remains.
   */
  stablenet_replaceModule: async (params, origin) => {
    const [moduleParams] = params as [
      {
        account: Address
        moduleType: string
        oldModuleAddress: Address
        deInitData?: Hex
        newModuleAddress: Address
        initData: Hex | Record<string, unknown>
        initDataEncoded: boolean
        chainId: number
        gasPaymentMode?: 'native' | 'sponsor' | 'erc20'
        gasPaymentTokenAddress?: Address
      },
    ]

    if (!moduleParams) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Missing module replacement parameters',
      })
    }

    const {
      account,
      moduleType,
      oldModuleAddress,
      deInitData = '0x' as Hex,
      newModuleAddress,
      initData,
      initDataEncoded,
      chainId,
      gasPaymentMode = 'sponsor',
      gasPaymentTokenAddress,
    } = moduleParams

    if (!isAddress(account)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid account address',
      })
    }

    if (!isAddress(oldModuleAddress) || !isAddress(newModuleAddress)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid module address',
      })
    }

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

    const moduleTypeParsed = BigInt(moduleType) as ModuleType
    const moduleTypeNameStr = getModuleTypeName(moduleTypeParsed)

    const moduleSpecificData: Hex = initDataEncoded ? (initData as Hex) : ('0x' as Hex)
    const kernelInitData = buildKernelInstallData(moduleTypeParsed, moduleSpecificData)

    const moduleOpClient = createModuleOperationClient({ chainId })
    const moduleCalldata = moduleOpClient.prepareReplaceModule(account, {
      moduleType: moduleTypeParsed,
      oldModuleAddress,
      deInitData,
      newModuleAddress,
      initData: kernelInitData,
    })

    const client = getPublicClient(network.rpcUrl)
    const entryPoint = getEntryPointForChain(chainId)
    const nonce = await client
      .readContract({
        address: entryPoint,
        abi: ENTRY_POINT_ABI,
        functionName: 'getNonce',
        args: [account, await getNonceKeyForAccount(account)],
      })
      .catch(() => 0n)

    const feeData = await client.estimateFeesPerGas().catch(() => ({
      maxFeePerGas: BigInt(1e9),
      maxPriorityFeePerGas: BigInt(1e8),
    }))

    // Resolve factory for undeployed accounts
    const factoryInfo = network.rpcUrl ? await resolveFactory(account, network.rpcUrl) : null

    const userOp: UserOperation = {
      sender: account,
      nonce,
      factory: factoryInfo?.factory ?? undefined,
      factoryData: factoryInfo?.factoryData ?? undefined,
      callData: moduleCalldata.data,
      callGasLimit: BigInt(800000),
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

    if (origin !== 'extension' && origin !== 'internal') {
      try {
        await approvalController.requestTransaction(
          origin,
          account,
          account,
          BigInt(0),
          moduleCalldata.data,
          estimatedGasCost,
          `Replace ${moduleTypeNameStr} Module`,
          undefined
        )
      } catch (error) {
        handleApprovalError(error, { method: 'wallet_replaceModule', origin })
      }
    }

    // ERC-7677: sponsorAndSign handles stub → estimate → final → sign
    if (gasPaymentMode !== 'native' && network.paymasterUrl) {
      const paymasterContext: Record<string, unknown> =
        gasPaymentMode === 'erc20' && gasPaymentTokenAddress
          ? { paymasterType: 'erc20', tokenAddress: gasPaymentTokenAddress }
          : {}

      const signedUserOp = await sponsorAndSign({
        userOp,
        paymasterUrl: network.paymasterUrl,
        entryPoint,
        chainId,
        context: paymasterContext,
        bundlerUrl: network.bundlerUrl,
        signer: async (finalOp) => {
          return signUserOp(finalOp, entryPoint, chainId)
        },
      })

      if (signedUserOp) {
        try {
          const bundlerClient = createBundlerClient({ url: network.bundlerUrl, entryPoint })
          const userOpHash = await bundlerClient.sendUserOperation(signedUserOp)
          return { hash: userOpHash }
        } catch (error) {
          const err = error as Error & { code?: number; data?: unknown }
          const message = err.message?.includes('fetch')
            ? `Bundler unreachable (${network.bundlerUrl}): ${err.message}`
            : err.message || 'Module replacement failed'
          throw createRpcError({
            code: err.code ?? RPC_ERRORS.INTERNAL_ERROR.code,
            message,
            data: err.data,
          })
        }
      }
    }

    // Self-pay path: sign with EIP-712 and submit directly
    let signedUserOp: UserOperation
    try {
      const signature = await signUserOp(userOp, entryPoint, chainId)
      signedUserOp = { ...userOp, signature }
    } catch (error) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'UserOperation signing failed',
      })
    }

    try {
      const bundlerClient = createBundlerClient({ url: network.bundlerUrl, entryPoint })
      const userOpHash = await bundlerClient.sendUserOperation(signedUserOp)
      return { hash: userOpHash }
    } catch (error) {
      const err = error as Error & { code?: number; data?: unknown }
      const message = err.message?.includes('fetch')
        ? `Bundler unreachable (${network.bundlerUrl}): ${err.message}`
        : err.message || 'Module replacement failed'
      throw createRpcError({
        code: err.code ?? RPC_ERRORS.INTERNAL_ERROR.code,
        message,
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
    let code: string | undefined
    try {
      code = await client.getCode({ address: accountAddr })
    } catch (err) {
      const msg = (err as Error).message ?? ''
      if (msg.includes('fetch') || msg.includes('ECONNREFUSED') || msg.includes('network')) {
        throw createRpcError({
          code: RPC_ERRORS.INTERNAL_ERROR.code,
          message: `RPC unreachable (${network.rpcUrl}): ${msg}`,
        })
      }
      // Non-network errors (e.g. unsupported method) — treat as no code
      code = undefined
    }
    const { classifyAccountByCode, extractDelegateAddress } = await import('@stablenet/core')
    const accountType = classifyAccountByCode(code as Hex | undefined)
    const delegationTarget = accountType === 'delegated'
      ? getAddress(extractDelegateAddress(code as Hex)!)
      : null

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

        const rawAccountId = (await client
          .readContract({
            address: accountAddr,
            abi: KERNEL_ABI,
            functionName: 'accountId',
          })
          .catch(() => null)) as string | null

        // Normalize accountId: both "kernel.advanced.v0.3.3" and "kernel.advanced.0.3.3"
        // should be recognized as the same Kernel v0.3.3 account
        accountId = rawAccountId ? normalizeAccountId(rawAccountId) : null
      } catch {
        // Contract may not support these methods
      }
    }

    // Sync stored account type if on-chain state differs
    const storedAccount = walletState
      .getState()
      .accounts.accounts.find((a) => a.address.toLowerCase() === accountAddr.toLowerCase())
    if (storedAccount && storedAccount.type !== accountType) {
      walletState
        .updateAccount(accountAddr, {
          type: accountType,
          ...(delegationTarget ? { delegateAddress: delegationTarget as Address } : {}),
        })
        .catch(() => {})
    }

    return {
      accountType,
      isDeployed: !!code && code !== '0x',
      rootValidator,
      accountId,
      delegationTarget,
      isDelegated: accountType === 'delegated',
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

  /**
   * Get installed modules for a Smart Account (ERC-7579)
   * Checks each registry module against the on-chain account
   */
  stablenet_getInstalledModules: async (params) => {
    const [requestParams] = params as [{ account: string; chainId: number }]
    const { account, chainId } = requestParams ?? {}

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

    // Verify account has code (smart account or delegated)
    let code: string | undefined
    try {
      code = await client.getCode({ address: accountAddr })
    } catch (err) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: `RPC unreachable (${network.rpcUrl}): ${(err as Error).message}`,
      })
    }

    const hasCode = !!code && code !== '0x'
    if (!hasCode) {
      // EOA without code — no modules can be installed
      return { modules: [] }
    }

    try {
      const { createModuleRegistry, KERNEL_ABI, MODULE_STATUS } = await import('@stablenet/core')
      const registry = createModuleRegistry({ chainId })
      const registryModules = registry.getAll()

      const installed: Array<{
        address: string
        type: bigint
        metadata: {
          address: string
          type: bigint
          name: string
          description: string
          version: string
        }
        initData: string
        status: string
        installedAt: number
      }> = []

      // Check each registry module against the on-chain account
      for (const entry of registryModules) {
        const moduleAddr = registry.getModuleAddress(entry)
        if (!moduleAddr) continue

        try {
          const isInstalled = await client.readContract({
            address: accountAddr,
            abi: KERNEL_ABI,
            functionName: 'isModuleInstalled',
            args: [entry.metadata.type, moduleAddr, '0x'],
          })

          if (isInstalled) {
            installed.push({
              address: moduleAddr,
              type: entry.metadata.type,
              metadata: {
                address: moduleAddr,
                type: entry.metadata.type,
                name: entry.metadata.name,
                description: entry.metadata.description,
                version: entry.metadata.version,
              },
              initData: '0x',
              status: MODULE_STATUS.INSTALLED,
              installedAt: Date.now(),
            })
          }
        } catch {
          // Module may not support isModuleInstalled — skip
        }
      }

      return { modules: installed }
    } catch (error) {
      // Re-throw RpcError as-is
      if (error instanceof RpcError) throw error
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'Failed to fetch installed modules',
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

      return await handlers.eth_sendTransaction!([tx], origin ?? 'extension', true)
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
        gasPaymentMode?: 'native' | 'sponsor' | 'erc20'
        gasPaymentTokenAddress?: Address
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
      gasPaymentMode = 'sponsor',
      gasPaymentTokenAddress,
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

    // Get current nonce from EntryPoint (authoritative source for ERC-4337)
    const entryPoint = getEntryPointForChain(chainId)
    const nonce = await client
      .readContract({
        address: entryPoint,
        abi: ENTRY_POINT_ABI,
        functionName: 'getNonce',
        args: [account, await getNonceKeyForAccount(account)],
      })
      .catch(() => 0n)

    const feeData = await client.estimateFeesPerGas().catch(() => ({
      maxFeePerGas: BigInt(1e9),
      maxPriorityFeePerGas: BigInt(1e8),
    }))

    // Resolve factory for undeployed accounts
    const factoryInfo = network.rpcUrl ? await resolveFactory(account, network.rpcUrl) : null

    const userOp: UserOperation = {
      sender: account,
      nonce,
      factory: factoryInfo?.factory ?? undefined,
      factoryData: factoryInfo?.factoryData ?? undefined,
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

    // Request user approval (skip for internal wallet UI requests)
    if (origin !== 'extension' && origin !== 'internal') {
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
    }

    // ERC-7677: sponsorAndSign handles stub → estimate → final → sign
    if (gasPaymentMode !== 'native' && network.paymasterUrl) {
      const paymasterContext: Record<string, unknown> =
        gasPaymentMode === 'erc20' && gasPaymentTokenAddress
          ? { paymasterType: 'erc20', tokenAddress: gasPaymentTokenAddress }
          : {}

      const signedUserOp = await sponsorAndSign({
        userOp,
        paymasterUrl: network.paymasterUrl,
        entryPoint,
        chainId,
        context: paymasterContext,
        bundlerUrl: network.bundlerUrl,
        signer: async (finalOp) => {
          return signUserOp(finalOp, entryPoint, chainId)
        },
      })

      if (signedUserOp) {
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
      }
    }

    // Self-pay path: sign with EIP-712 and submit directly
    let signedUserOp: UserOperation
    try {
      const signature = await signUserOp(userOp, entryPoint, chainId)
      signedUserOp = { ...userOp, signature }
    } catch (error) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'UserOperation signing failed',
      })
    }

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
      return await handlers.eth_sendTransaction!([replacementTx], 'extension', true)
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

      return await handlers.eth_sendTransaction!([cancelTx], 'extension', true)
    } catch (error) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'Failed to cancel transaction',
      })
    }
  },

  // =========================================================================
  // Gas Estimation (Custom)
  // =========================================================================

  /**
   * Estimate gas for multi-mode transactions
   * Used by the Send UI to show estimated gas cost before sending
   */
  stablenet_estimateGas: async (params) => {
    const [estimateParams] = params as [
      {
        mode?: string
        from?: string
        to?: string
        value?: string
        data?: string
        gasPayment?: { type: string; tokenAddress?: string }
        chainId?: number
      },
    ]

    if (!estimateParams?.from || !estimateParams?.to) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Missing from or to address',
      })
    }

    const network = walletState.getCurrentNetwork()
    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    const client = getPublicClient(network.rpcUrl)

    try {
      // Parse value - handle both hex and decimal string formats
      let parsedValue = 0n
      if (estimateParams.value) {
        const val = estimateParams.value
        parsedValue = val.startsWith('0x') ? BigInt(val) : BigInt(val)
      }

      // Smart Account mode: estimate via bundler
      if (estimateParams.mode === 'smart_account' && network.bundlerUrl) {
        const entryPoint = getEntryPointForChain(network.chainId)
        const bundlerClient = createBundlerClient({ url: network.bundlerUrl, entryPoint })

        // Build a partial UserOperation for estimation
        // Encode callData through Kernel execute() for proper Smart Account execution
        const partialUserOp: Partial<UserOperation> = {
          sender: estimateParams.from as Address,
          callData: encodeKernelExecute(
            estimateParams.to as Address,
            parsedValue,
            (estimateParams.data as Hex) || '0x'
          ),
          // Dummy values for estimation - bundler will calculate actual gas
          nonce: 0n,
          signature: '0x' as Hex,
          callGasLimit: 0n,
          verificationGasLimit: 0n,
          preVerificationGas: 0n,
          maxFeePerGas: 0n,
          maxPriorityFeePerGas: 0n,
        }

        try {
          const gasEstimate = await bundlerClient.estimateUserOperationGas(
            partialUserOp as UserOperation
          )

          // Get fee data for cost calculation
          const block = await client.getBlock({ blockTag: 'latest' })
          const baseFee = block.baseFeePerGas ?? 0n
          const maxPriorityFeePerGas = await client
            .estimateMaxPriorityFeePerGas()
            .catch(() => 1000000000n)
          const maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas

          const totalGas =
            gasEstimate.preVerificationGas +
            gasEstimate.verificationGasLimit +
            gasEstimate.callGasLimit
          const estimatedCost = totalGas * maxFeePerGas

          return {
            gasLimit: totalGas.toString(),
            maxFeePerGas: maxFeePerGas.toString(),
            maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
            estimatedCost: estimatedCost.toString(),
            preVerificationGas: gasEstimate.preVerificationGas.toString(),
            verificationGasLimit: gasEstimate.verificationGasLimit.toString(),
            callGasLimit: gasEstimate.callGasLimit.toString(),
          }
        } catch (bundlerError) {
          logger.warn('Bundler gas estimation failed, falling back to RPC', { error: bundlerError })
          // Fall through to standard estimation below
        }
      }

      // Standard EOA/EIP-7702 gas estimation
      const gasLimit = await client.estimateGas({
        account: estimateParams.from as Address,
        to: estimateParams.to as Address,
        value: parsedValue,
        data: (estimateParams.data as `0x${string}`) || undefined,
      })

      // Get current gas price (try EIP-1559 first)
      let maxFeePerGas = 0n
      let maxPriorityFeePerGas = 0n

      try {
        const block = await client.getBlock({ blockTag: 'latest' })
        const baseFee = block.baseFeePerGas ?? 0n
        maxPriorityFeePerGas = await client.estimateMaxPriorityFeePerGas().catch(() => 1000000000n) // 1 gwei fallback
        maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas
      } catch {
        // Fallback to legacy gas price
        const gasPrice = await client.getGasPrice()
        maxFeePerGas = gasPrice
        maxPriorityFeePerGas = gasPrice
      }

      const estimatedCost = gasLimit * maxFeePerGas

      return {
        gasLimit: gasLimit.toString(),
        maxFeePerGas: maxFeePerGas.toString(),
        maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
        estimatedCost: estimatedCost.toString(),
      }
    } catch (error) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: (error as Error).message || 'Failed to estimate gas',
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
  wallet_requestPermissions: async (params, origin, isExtension) => {
    const [requested] = (params ?? [{}]) as [Record<string, unknown>]
    const requestedMethods = Object.keys(requested)

    // EIP-2255: supported permission capabilities
    const SUPPORTED_PERMISSIONS = ['eth_accounts'] as const
    type SupportedPermission = (typeof SUPPORTED_PERMISSIONS)[number]

    const granted: Array<{
      parentCapability: string
      date: number
      caveats?: Array<{ type: string; value: unknown }>
    }> = []

    for (const method of requestedMethods) {
      if (!SUPPORTED_PERMISSIONS.includes(method as SupportedPermission)) {
        // Skip unsupported permissions — EIP-2255 allows partial grant
        continue
      }

      if (method === 'eth_accounts') {
        let connected = walletState.getConnectedAccounts(origin)

        // If not yet connected, trigger connect flow
        if (connected.length === 0) {
          const handler = handlers['eth_requestAccounts']
          if (handler) {
            await handler(params, origin, isExtension)
          }
          connected = walletState.getConnectedAccounts(origin)
        }

        if (connected.length > 0) {
          granted.push({
            parentCapability: 'eth_accounts',
            date: Date.now(),
            caveats: [
              {
                type: 'restrictReturnedAccounts',
                value: connected,
              },
            ],
          })
        }
      }
    }

    return granted
  },

  /**
   * Get current permissions
   */
  wallet_getPermissions: async (_params, origin) => {
    const connected = walletState.getConnectedAccounts(origin)
    const permissions: Array<{
      parentCapability: string
      date: number
      caveats?: Array<{ type: string; value: unknown }>
    }> = []

    if (connected.length > 0) {
      permissions.push({
        parentCapability: 'eth_accounts',
        date: Date.now(),
        caveats: [
          {
            type: 'restrictReturnedAccounts',
            value: connected,
          },
        ],
      })
    }

    return permissions
  },

  // =========================================================================
  // Paymaster Methods
  // =========================================================================

  /**
   * Get supported gas payment tokens
   * Returns the native token (WKRC) as the only gas payment option
   */
  pm_supportedTokens: async (params) => {
    const chainId = params?.[0] as number | undefined
    const network = chainId
      ? walletState.getState().networks.networks.find((n) => n.chainId === chainId)
      : walletState.getCurrentNetwork()

    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    if (!network.paymasterUrl) {
      return { tokens: [] }
    }

    return {
      tokens: [
        {
          symbol: network.currency.symbol,
          address: '0x0000000000000000000000000000000000000000' as Address,
          decimals: network.currency.decimals,
          isNative: true,
        },
      ],
    }
  },

  /**
   * Get sponsor policy for an account
   * Probes the paymaster-proxy to check if sponsorship is available
   */
  pm_sponsorPolicy: async (params) => {
    const [requestParams] = params as [{ account?: Address; chainId?: number }]
    const chainId = requestParams?.chainId
    const network = chainId
      ? walletState.getState().networks.networks.find((n) => n.chainId === chainId)
      : walletState.getCurrentNetwork()

    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    if (!network.paymasterUrl) {
      return {
        isAvailable: false,
        reason: 'Paymaster not configured for this network',
      }
    }

    // Probe paymaster availability with a stub UserOp
    try {
      const account = requestParams?.account ?? '0x0000000000000000000000000000000000000000'
      const stubUserOp = {
        sender: account,
        nonce: '0x0',
        callData: '0x',
        callGasLimit: '0x0',
        verificationGasLimit: '0x0',
        preVerificationGas: '0x0',
        maxFeePerGas: '0x0',
        maxPriorityFeePerGas: '0x0',
        signature: '0x',
      }

      const entryPoint = getEntryPointForChain()
      await fetchFromPaymaster(network.paymasterUrl, 'pm_getPaymasterStubData', [
        stubUserOp,
        entryPoint,
        `0x${(network.chainId).toString(16)}`,
      ])

      return {
        isAvailable: true,
        sponsor: { name: 'StableNet Paymaster' },
        maxGas: '100000000000000', // 0.0001 WKRC
        dailyLimit: '100000000000000000', // 0.1 WKRC
      }
    } catch {
      return {
        isAvailable: false,
        reason: 'Paymaster is currently unavailable',
      }
    }
  },

  /**
   * Estimate ERC-20 gas payment
   * Not supported — paymaster only sponsors native token gas
   */
  pm_estimateERC20: async () => {
    return { supported: false }
  },

  /**
   * Register an account with the paymaster for gas sponsorship.
   * Forwards registration to paymaster-proxy; falls back to local policy creation.
   */
  pm_registerAccount: async (params) => {
    const [requestParams] = params as [{ account?: Address; chainId?: number }]
    const chainId = requestParams?.chainId
    const network = chainId
      ? walletState.getState().networks.networks.find((n) => n.chainId === chainId)
      : walletState.getCurrentNetwork()

    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    if (!network.paymasterUrl) {
      return {
        success: false,
        error: 'Paymaster not configured for this network',
      }
    }

    const account = requestParams?.account
    if (!account || !isAddress(account)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Valid account address is required',
      })
    }

    try {
      const result = await fetchFromPaymaster(network.paymasterUrl, 'pm_registerAccount', [
        { account, chainId: network.chainId },
      ])

      return {
        success: true,
        ...(result as object),
      }
    } catch {
      // Fallback: if proxy doesn't support pm_registerAccount,
      // treat as auto-registered via sponsorPolicy probe
      logger.info(`pm_registerAccount not supported by proxy, treating as auto-registered`)
      return {
        success: true,
        registrationId: `auto-${account.slice(0, 10)}`,
        policy: {
          dailyLimit: '100000000000000000',
          perTxLimit: '10000000000000000',
        },
      }
    }
  },

  /**
   * Get paymaster registration status for an account.
   * Queries paymaster-proxy; falls back to pm_sponsorPolicy result.
   */
  pm_accountStatus: async (params) => {
    const [requestParams] = params as [{ account?: Address; chainId?: number }]
    const chainId = requestParams?.chainId
    const network = chainId
      ? walletState.getState().networks.networks.find((n) => n.chainId === chainId)
      : walletState.getCurrentNetwork()

    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    if (!network.paymasterUrl) {
      return {
        isRegistered: false,
        reason: 'Paymaster not configured',
      }
    }

    const account = requestParams?.account
    if (!account || !isAddress(account)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Valid account address is required',
      })
    }

    try {
      const result = await fetchFromPaymaster(network.paymasterUrl, 'pm_accountStatus', [
        { account, chainId: network.chainId },
      ])

      return result
    } catch {
      // Fallback: derive status from sponsorPolicy probe
      try {
        const stubUserOp = {
          sender: account,
          nonce: '0x0',
          callData: '0x',
          callGasLimit: '0x0',
          verificationGasLimit: '0x0',
          preVerificationGas: '0x0',
          maxFeePerGas: '0x0',
          maxPriorityFeePerGas: '0x0',
          signature: '0x',
        }

        const entryPoint = getEntryPointForChain()
        await fetchFromPaymaster(network.paymasterUrl, 'pm_getPaymasterStubData', [
          stubUserOp,
          entryPoint,
          `0x${network.chainId.toString(16)}`,
        ])

        return {
          isRegistered: true,
          policy: {
            dailyLimit: '100000000000000000',
            dailyUsed: '0',
            perTxLimit: '10000000000000000',
          },
        }
      } catch {
        return {
          isRegistered: false,
          reason: 'Paymaster unavailable',
        }
      }
    }
  },

  // =========================================================================
  // Spending Limit Status
  // =========================================================================

  /**
   * Get spending limit status from on-chain hook module
   */
  stablenet_getSpendingLimitStatus: async (params) => {
    const [requestParams] = params as [{ account: Address; hookAddress: Address; chainId: number }]

    if (!requestParams?.account || !requestParams?.hookAddress) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Missing required parameters: account and hookAddress',
      })
    }

    const { account, hookAddress, chainId } = requestParams
    const network = walletState.getState().networks.networks.find((n) => n.chainId === chainId)
    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    const client = getPublicClient(network.rpcUrl)

    // Read spending limit hook contract state
    // Standard interface: getSpendingLimit(account) → (token, limit, spent, period, resetTime)
    try {
      const spendingLimitAbi = [
        {
          inputs: [{ name: 'account', type: 'address' }],
          name: 'getSpendingLimit',
          outputs: [
            { name: 'token', type: 'address' },
            { name: 'limit', type: 'uint256' },
            { name: 'spent', type: 'uint256' },
            { name: 'period', type: 'uint256' },
            { name: 'resetTime', type: 'uint256' },
          ],
          stateMutability: 'view',
          type: 'function',
        },
      ] as const

      const result = await client.readContract({
        address: hookAddress,
        abi: spendingLimitAbi,
        functionName: 'getSpendingLimit',
        args: [account],
      })

      const [token, limit, spent, period, resetTime] = result

      return {
        token: token as Address,
        limit: limit.toString(),
        spent: spent.toString(),
        period: period.toString(),
        resetTime: resetTime.toString(),
      }
    } catch {
      // Hook may not implement this interface — return empty state
      return {
        token: '0x0000000000000000000000000000000000000000' as Address,
        limit: '0',
        spent: '0',
        period: '0',
        resetTime: '0',
      }
    }
  },

  /**
   * Get EntryPoint deposit balance for an account
   */
  stablenet_getEntryPointBalance: async (params) => {
    const [account] = params as [Address]

    if (!account || !isAddress(account)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid account address',
      })
    }

    const network = walletState.getCurrentNetwork()
    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    const entryPoint = getEntryPointForChain(network.chainId)
    const client = getPublicClient(network.rpcUrl)

    const result = await client.readContract({
      address: entryPoint,
      abi: ENTRY_POINT_ABI,
      functionName: 'getDepositInfo',
      args: [account],
    })

    const info = result as { deposit: bigint; staked: boolean; stake: bigint; unstakeDelaySec: number; withdrawTime: number }
    return {
      deposit: info.deposit.toString(),
      staked: info.staked,
    }
  },

  /**
   * Deposit funds to the EntryPoint contract for an account
   */
  stablenet_depositToEntryPoint: async (params, origin, isExtension) => {
    const [depositParams] = params as [{ account: Address; amount: string }]

    if (!depositParams?.account || !isAddress(depositParams.account)) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid account address',
      })
    }

    if (!depositParams.amount || BigInt(depositParams.amount) <= 0n) {
      throw createRpcError({
        code: RPC_ERRORS.INVALID_PARAMS.code,
        message: 'Invalid deposit amount',
      })
    }

    if (!keyringController.isUnlocked()) {
      throw createRpcError({
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: 'Wallet is locked',
      })
    }

    const network = walletState.getCurrentNetwork()
    if (!network) {
      throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
    }

    const entryPoint = getEntryPointForChain(network.chainId)
    const client = getPublicClient(network.rpcUrl)
    const amount = BigInt(depositParams.amount)

    // Encode depositTo(account) call
    const data = encodeFunctionData({
      abi: ENTRY_POINT_ABI,
      functionName: 'depositTo',
      args: [depositParams.account],
    })

    // Build and send transaction to EntryPoint
    const from = depositParams.account
    const nonce = await client.getTransactionCount({ address: from })
    let gas: bigint
    try {
      gas = await client.estimateGas({
        account: from,
        to: entryPoint,
        value: amount,
        data,
      })
    } catch {
      gas = DEFAULT_VALUES.GAS_LIMIT
    }

    const gasPrice = await client.getGasPrice()

    const transaction = {
      to: entryPoint,
      value: amount,
      data,
      gas,
      nonce,
      chainId: network.chainId,
      gasPrice,
    }

    const signedTx = await keyringController.signTransaction(from, transaction)
    const txHash = await client.sendRawTransaction({ serializedTransaction: signedTx })

    return txHash
  },
}

/**
 * Handle an RPC request
 */
export async function handleRpcRequest(
  request: JsonRpcRequest,
  origin: string,
  isExtension = false
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

    const result = await handler(params, origin, isExtension)

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
