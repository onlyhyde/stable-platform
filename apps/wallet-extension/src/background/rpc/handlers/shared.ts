// Use SDK for bundler client, UserOperation utilities, and security modules

import { ENTRY_POINT_ADDRESS, getEntryPoint, isChainSupported } from '@stablenet/contracts'
import {
  // Gas constants
  BASE_TRANSFER_GAS,
  buildUserOpTypedData,
  createBundlerClient,
  // Module operations
  createModuleOperationClient,
  createRateLimiter,
  createTypedDataValidator,
  DEFAULT_CALL_GAS_LIMIT,
  DEFAULT_PRE_VERIFICATION_GAS,
  DEFAULT_VERIFICATION_GAS_LIMIT,
  EIP7702_AUTH_GAS,
  ENTRY_POINT_ABI,
  encodeValidatorNonceKey,
  GAS_BUFFER_DIVISOR,
  GAS_BUFFER_MULTIPLIER,
  GAS_PER_AUTHORIZATION,
  getModuleTypeName,
  getUserOperationHash,
  // Security utilities
  InputValidator,
  KERNEL_ABI,
  type ModuleType,
  packUserOperation,
  type UserOperation,
  VALIDATION_TYPE,
} from '@stablenet/core'
import type { Address, Hash, Hex } from 'viem'
import { createPublicClient, http } from 'viem'
import { concat, encodeFunctionData, getAddress, isAddress, pad, toHex } from 'viem/utils'
import { DEFAULT_VALUES, RPC_ERRORS } from '../../../shared/constants'
import { RpcError } from '../../../shared/errors/rpcErrors'
import { handleApprovalError } from '../../../shared/errors/WalletError'
import { sanitizeErrorMessage } from '../../../shared/security/errorSanitizer'
import {
  createAuthorization,
  createAuthorizationHash,
  createSignedAuthorization,
} from '../../../shared/utils/eip7702'
import { createLogger } from '../../../shared/utils/logger'
import type { JsonRpcRequest, JsonRpcResponse, SupportedMethod } from '../../../types'
import { approvalController } from '../../controllers/approvalController'
import { MultiModeTransactionController } from '../../controllers/MultiModeTransactionController'
import type {
  MultiModeTransactionParams,
  TransactionAccountInfo,
} from '../../controllers/multiModeTransactionController.types'
import { keyringController } from '../../keyring'
import { checkOrigin } from '../../security/phishingGuard'
import { walletState } from '../../state/store'
import { eventBroadcaster } from '../../utils/eventBroadcaster'
import { createValidatorRegistry, type ValidatorRegistry } from '../../validators/validatorRegistry'
import { buildKernelInstallData } from '../kernelInitData'
import { fetchFromPaymaster, sponsorAndSign } from '../paymaster'
import {
  createRpcError,
  decodeStringResult,
  formatBalance,
  formatBlock,
  formatTransactionType,
  parseUserOperation,
} from '../utils'
import { validateRpcParams } from '../validation'

export const logger = createLogger('RpcHandler')

/** Generate a crypto-safe hex string of `n` bytes */
export function cryptoHex(n: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(n))
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Create singleton instances for security utilities
export const rateLimiter = createRateLimiter()
export const typedDataValidator = createTypedDataValidator()

// Singleton validator instance
export const inputValidator = new InputValidator()

// Singleton validator registry for multi-validator support
export const validatorRegistry: ValidatorRegistry = createValidatorRegistry()
// Load persisted state — store the promise to await before first use
export const registryReady = validatorRegistry.load().catch(() => {})

// Lazy singleton MultiModeTransactionController — recreated when network changes
let _multiModeController: MultiModeTransactionController | null = null
let _multiModeNetworkKey = ''

/**
 * Get or create the MultiModeTransactionController singleton.
 * Automatically recreates when the active network changes.
 */
export function getMultiModeController(): MultiModeTransactionController {
  const network = walletState.getCurrentNetwork()
  if (!network) {
    throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
  }

  const networkKey = `${network.chainId}:${network.rpcUrl}:${network.bundlerUrl ?? ''}:${network.paymasterUrl ?? ''}`

  if (_multiModeController && _multiModeNetworkKey === networkKey) {
    return _multiModeController
  }

  _multiModeController = new MultiModeTransactionController({
    chainId: network.chainId,
    rpcUrl: network.rpcUrl,
    bundlerUrl: network.bundlerUrl,
    paymasterUrl: network.paymasterUrl,
    entryPointAddress: getEntryPointForChain(network.chainId),

    getSelectedAccount: (): TransactionAccountInfo | null => {
      const state = walletState.getState()
      const selected = state.accounts.selectedAccount
      if (!selected) return null
      const account = state.accounts.accounts.find(
        (a) => a.address.toLowerCase() === selected.toLowerCase()
      )
      if (!account) return null

      return {
        address: account.address,
        type: account.type,
        smartAccountAddress: account.type === 'smart' ? account.address : undefined,
        isDelegated: account.type === 'delegated',
        delegateTo: account.delegateAddress,
      }
    },

    signTransaction: async (_address: Address): Promise<Hex> => {
      // EOA raw tx signing — not used for Smart Account path
      // For full EOA support, delegate to eth_sendTransaction handler
      throw new Error(
        'EOA transaction signing via MultiMode not yet supported — use eth_sendTransaction'
      )
    },

    signUserOperation: async (address: Address, userOpHash: Hex): Promise<Hex> => {
      const signerAddr = resolveSignerAddress(address)

      if (isDelegatedSender(address)) {
        // EIP-7702: Kernel calls _verify7702Signature(toEthSignedMessageHash(userOpHash), sig)
        // Must sign with EIP-191 prefix (signMessage adds the prefix)
        return keyringController.signMessage(signerAddr, userOpHash)
      }

      // Smart Account: raw ECDSA sign for MultiMode callback
      // The main signUserOp path uses EIP-712 signTypedData instead
      const result = await keyringController.signAuthorizationHash(signerAddr, userOpHash)
      return result.signature
    },

    signAuthorization: async (address: Address, authHash: Hex) => {
      const result = await keyringController.signAuthorizationHash(address, authHash)
      return { r: result.r, s: result.s, v: result.v }
    },

    publishTransaction: async (rawTx: Hex): Promise<Hex> => {
      // Read current network inside callback to avoid stale closure
      const currentNetwork = walletState.getCurrentNetwork()
      if (!currentNetwork) throw createRpcError(RPC_ERRORS.CHAIN_DISCONNECTED)
      const client = getPublicClient(currentNetwork.rpcUrl)
      return client.sendRawTransaction({ serializedTransaction: rawTx })
    },
  })

  _multiModeNetworkKey = networkKey
  logger.info(`[MultiMode] Controller initialized: chain=${network.chainId}`)

  return _multiModeController
}

/**
 * Get the nonce key for the active validator of an account.
 * Returns 0n for ECDSA (root), encoded key for WebAuthn/MultiSig.
 */
export async function getNonceKeyForAccount(account: Address, chainId?: number): Promise<bigint> {
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
export function getEntryPointForChain(chainId?: number): Address {
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
export async function resolveFactory(
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
export function resolveSignerAddress(sender: Address): Address {
  const account = walletState
    .getState()
    .accounts.accounts.find((a) => a.address.toLowerCase() === sender.toLowerCase())

  if (account?.ownerAddress) {
    logger.info(
      `[resolveSignerAddress] ${sender.slice(0, 10)}... → owner=${account.ownerAddress.slice(0, 10)}... (type=${account.type})`
    )
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
export function isDelegatedSender(sender: Address): boolean {
  const account = walletState
    .getState()
    .accounts.accounts.find((a) => a.address.toLowerCase() === sender.toLowerCase())
  return account?.type === 'delegated'
}

/**
 * Convert an object tree so that BigInt values become decimal strings.
 * Required because Chrome extension messaging and JSON.stringify cannot
 * serialize BigInt natively.
 */
export function toJsonSafe(obj: unknown): unknown {
  if (typeof obj === 'bigint') return obj.toString()
  if (Array.isArray(obj)) return obj.map(toJsonSafe)
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, toJsonSafe(v)])
    )
  }
  return obj
}

/**
 * Sign a UserOperation for submission.
 *
 * Before signing, the user is shown exactly what data they will sign
 * (EIP-712 typed data or EIP-191 message hash) and must explicitly confirm.
 *
 * For EIP-7702 delegated accounts (Kernel VALIDATION_TYPE_7702):
 *   - Signs with EIP-191: signMessage(userOpHash) → adds "\x19Ethereum Signed Message:\n32" prefix
 *   - Kernel verifies: ECDSA.recover(toEthSignedMessageHash(userOpHash), sig) == address(this)
 *
 * For regular smart accounts (Kernel VALIDATION_TYPE_ROOT):
 *   - Signs with EIP-712: signTypedData(typedData) → structured PackedUserOperation hash
 *   - Kernel verifies via installed ECDSA validator module
 */
export async function signUserOp(
  userOp: UserOperation,
  entryPoint: Address,
  chainId: number,
  origin: string
): Promise<Hex> {
  const signerAddr = resolveSignerAddress(userOp.sender)

  if (isDelegatedSender(userOp.sender)) {
    // EIP-7702 path: Kernel validateUserOp calls
    //   _verify7702Signature(ECDSA.toEthSignedMessageHash(userOpHash), userOpSig)
    // which then does ECDSA.recover(wrappedHash, sig) == address(this)
    // So we must sign with EIP-191 prefix (signMessage adds "\x19Ethereum Signed Message:\n32")
    const userOpHash = getUserOperationHash(userOp, entryPoint, BigInt(chainId))
    logger.info(
      `[signUserOp] EIP-7702 path: sender=${userOp.sender.slice(0, 10)}..., signerAddr=${signerAddr.slice(0, 10)}..., userOpHash=${userOpHash.slice(0, 14)}...`
    )

    // Build typed data for display purposes (even though we sign with EIP-191)
    // This allows the approval UI to show human-readable UserOp details
    const typedData = buildUserOpTypedData(userOp, entryPoint, BigInt(chainId))

    await approvalController.requestSignature(
      origin,
      'personal_sign',
      signerAddr,
      userOpHash,
      toJsonSafe(typedData)
    )

    return keyringController.signMessage(signerAddr, userOpHash)
  }

  // Standard smart account path: EIP-712 typed data signing
  const typedData = buildUserOpTypedData(userOp, entryPoint, BigInt(chainId))
  logger.info(
    `[signUserOp] EIP-712 path: sender=${userOp.sender.slice(0, 10)}..., signerAddr=${signerAddr.slice(0, 10)}...`
  )

  // Show EIP-712 typed data and wait for user confirmation
  // BigInt values are converted to strings for Chrome messaging serialization
  await approvalController.requestSignature(
    origin,
    'eth_signTypedData_v4',
    signerAddr,
    '',
    toJsonSafe(typedData)
  )

  return keyringController.signTypedData(signerAddr, typedData)
}

/**
 * Normalize accountId to a canonical form.
 * Handles both "kernel.advanced.v0.3.3" (old) and "kernel.advanced.0.3.3" (new) formats.
 */
export function normalizeAccountId(accountId: string): string {
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

export function getPublicClient(rpcUrl: string): ReturnType<typeof createPublicClient> {
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
export function encodeKernelExecute(to: Address, value: bigint = 0n, data: Hex = '0x'): Hex {
  const execMode = pad('0x00' as Hex, { size: 32 })
  const executionCalldata = concat([to, pad(toHex(value), { size: 32 }), data]) as Hex
  return encodeFunctionData({
    abi: KERNEL_ABI,
    functionName: 'execute',
    args: [execMode, executionCalldata],
  })
}

/**
 * Encode a Kernel v0.3.3 executeBatch call for multiple calls in one UserOp.
 * Uses Kernel's native executeBatch(Call[]) where Call = (address target, uint256 value, bytes callData).
 */
export function encodeKernelExecuteBatch(
  calls: ReadonlyArray<{ to: Address; value: bigint; data: Hex }>
): Hex {
  return encodeFunctionData({
    abi: KERNEL_ABI,
    functionName: 'executeBatch',
    args: [calls.map((c) => ({ target: c.to, value: c.value, callData: c.data }))],
  })
}

/**
 * Encode Kernel.initialize() calldata for EIP-7702 delegation.
 * Sets the root validator (ECDSA) and registers the EOA as its owner.
 *
 * @param validatorAddress - ECDSA validator contract address
 * @param ownerAddress - EOA address to register as the signer/owner
 */
export function _encodeKernelInitialize(validatorAddress: Address, ownerAddress: Address): Hex {
  // rootValidator is bytes21: 0x01 (MODULE_TYPE.VALIDATOR) + 20-byte validator address
  const rootValidator = concat([pad(toHex(1), { size: 1 }), validatorAddress]) as Hex
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

export type RpcHandler = (
  params: unknown[] | undefined,
  origin: string,
  isExtension: boolean
) => Promise<unknown>

// Re-export everything needed by handler files
export {
  ENTRY_POINT_ADDRESS,
  getEntryPoint,
  isChainSupported,
  BASE_TRANSFER_GAS,
  buildUserOpTypedData,
  createBundlerClient,
  createModuleOperationClient,
  DEFAULT_CALL_GAS_LIMIT,
  DEFAULT_PRE_VERIFICATION_GAS,
  DEFAULT_VERIFICATION_GAS_LIMIT,
  EIP7702_AUTH_GAS,
  ENTRY_POINT_ABI,
  encodeValidatorNonceKey,
  GAS_BUFFER_DIVISOR,
  GAS_BUFFER_MULTIPLIER,
  GAS_PER_AUTHORIZATION,
  getModuleTypeName,
  getUserOperationHash,
  InputValidator,
  KERNEL_ABI,
  packUserOperation,
  VALIDATION_TYPE,
  createPublicClient,
  http,
  encodeFunctionData,
  getAddress,
  isAddress,
  pad,
  toHex,
  concat,
  DEFAULT_VALUES,
  RPC_ERRORS,
  RpcError,
  handleApprovalError,
  sanitizeErrorMessage,
  approvalController,
  keyringController,
  checkOrigin,
  walletState,
  eventBroadcaster,
  buildKernelInstallData,
  fetchFromPaymaster,
  sponsorAndSign,
  createRpcError,
  decodeStringResult,
  formatBalance,
  formatBlock,
  formatTransactionType,
  parseUserOperation,
  validateRpcParams,
  createAuthorization,
  createAuthorizationHash,
  createSignedAuthorization,
}
export type {
  Address,
  Hash,
  Hex,
  ModuleType,
  UserOperation,
  JsonRpcRequest,
  JsonRpcResponse,
  SupportedMethod,
  MultiModeTransactionParams,
}
