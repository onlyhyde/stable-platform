import type { Address, Hex, LocalAccount, PublicClient } from 'viem'
import { encodeFunctionData, encodePacked, keccak256 } from 'viem'
import type {
  CreateSessionKeyParams,
  ExecutionRequest,
  PermissionInput,
  SessionKeyConfig,
  SessionKeyExecutorConfig,
  SessionKeyState,
} from './types'
import { SESSION_KEY_EXECUTOR_ABI } from './types'

/**
 * Session Key Executor client
 *
 * Provides methods to manage session keys and execute transactions
 * through the SessionKeyExecutor contract.
 */
export interface SessionKeyExecutorClient {
  /** The executor contract address */
  readonly executorAddress: Address
  /** The chain ID */
  readonly chainId: bigint

  // Management functions
  /** Encode calldata to add a session key */
  encodeAddSessionKey: (params: CreateSessionKeyParams) => Hex
  /** Encode calldata to revoke a session key */
  encodeRevokeSessionKey: (sessionKey: Address) => Hex
  /** Encode calldata to grant permission */
  encodeGrantPermission: (sessionKey: Address, permission: PermissionInput) => Hex
  /** Encode calldata to revoke permission */
  encodeRevokePermission: (sessionKey: Address, target: Address, selector: Hex) => Hex

  // Read functions (require publicClient)
  /** Get session key configuration */
  getSessionKey: (
    publicClient: PublicClient,
    account: Address,
    sessionKey: Address
  ) => Promise<SessionKeyConfig>
  /** Get session key state with computed values */
  getSessionKeyState: (
    publicClient: PublicClient,
    account: Address,
    sessionKey: Address
  ) => Promise<SessionKeyState>
  /** Check if session key has permission */
  hasPermission: (
    publicClient: PublicClient,
    account: Address,
    sessionKey: Address,
    target: Address,
    selector: Hex
  ) => Promise<boolean>
  /** Get all active session keys for an account */
  getActiveSessionKeys: (publicClient: PublicClient, account: Address) => Promise<Address[]>
  /** Get remaining spending limit */
  getRemainingSpendingLimit: (
    publicClient: PublicClient,
    account: Address,
    sessionKey: Address
  ) => Promise<bigint>

  // Execution functions
  /** Sign an execution request with session key */
  signExecution: (
    sessionKey: LocalAccount,
    account: Address,
    request: ExecutionRequest,
    nonce: bigint
  ) => Promise<Hex>
  /** Encode execute on behalf calldata */
  encodeExecuteOnBehalf: (account: Address, request: ExecutionRequest, signature: Hex) => Hex
  /** Encode execute as session key calldata */
  encodeExecuteAsSessionKey: (account: Address, request: ExecutionRequest) => Hex
}

/**
 * Create a Session Key Executor client
 *
 * @example
 * ```ts
 * import { createSessionKeyExecutor } from '@stablenet/plugin-session-keys'
 *
 * const executor = createSessionKeyExecutor({
 *   executorAddress: '0x...',
 *   chainId: 1n,
 * })
 *
 * // Encode add session key
 * const addData = executor.encodeAddSessionKey({
 *   account: '0x...',
 *   sessionKey: sessionKeyAccount,
 *   validUntil: BigInt(Date.now() / 1000 + 3600),
 *   spendingLimit: parseEther('1'),
 *   permissions: [
 *     { target: '0x...', selector: '0xa9059cbb' }, // transfer
 *   ],
 * })
 * ```
 */
export function createSessionKeyExecutor(
  config: SessionKeyExecutorConfig
): SessionKeyExecutorClient {
  const { executorAddress, chainId } = config

  // ============ Management Functions ============

  const encodeAddSessionKey = (params: CreateSessionKeyParams): Hex => {
    const {
      sessionKey,
      validAfter = BigInt(Math.floor(Date.now() / 1000)),
      validUntil = BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour default
      spendingLimit = 0n,
    } = params

    return encodeFunctionData({
      abi: SESSION_KEY_EXECUTOR_ABI,
      functionName: 'addSessionKey',
      args: [sessionKey.address, Number(validAfter), Number(validUntil), spendingLimit],
    })
  }

  const encodeRevokeSessionKey = (sessionKey: Address): Hex => {
    return encodeFunctionData({
      abi: SESSION_KEY_EXECUTOR_ABI,
      functionName: 'revokeSessionKey',
      args: [sessionKey],
    })
  }

  const encodeGrantPermission = (sessionKey: Address, permission: PermissionInput): Hex => {
    return encodeFunctionData({
      abi: SESSION_KEY_EXECUTOR_ABI,
      functionName: 'grantPermission',
      args: [
        sessionKey,
        permission.target,
        permission.selector || '0x00000000',
        permission.maxValue || 0n,
      ],
    })
  }

  const encodeRevokePermission = (sessionKey: Address, target: Address, selector: Hex): Hex => {
    return encodeFunctionData({
      abi: SESSION_KEY_EXECUTOR_ABI,
      functionName: 'revokePermission',
      args: [sessionKey, target, selector],
    })
  }

  // ============ Read Functions ============

  const getSessionKey = async (
    publicClient: PublicClient,
    account: Address,
    sessionKey: Address
  ): Promise<SessionKeyConfig> => {
    const result = (await publicClient.readContract({
      address: executorAddress,
      abi: SESSION_KEY_EXECUTOR_ABI,
      functionName: 'getSessionKey',
      args: [account, sessionKey],
    })) as {
      sessionKey: Address
      validAfter: number
      validUntil: number
      spendingLimit: bigint
      spentAmount: bigint
      nonce: bigint
      isActive: boolean
    }

    return {
      sessionKey: result.sessionKey,
      validAfter: BigInt(result.validAfter),
      validUntil: BigInt(result.validUntil),
      spendingLimit: result.spendingLimit,
      spentAmount: result.spentAmount,
      nonce: result.nonce,
      isActive: result.isActive,
    }
  }

  const getSessionKeyState = async (
    publicClient: PublicClient,
    account: Address,
    sessionKey: Address
  ): Promise<SessionKeyState> => {
    const config = await getSessionKey(publicClient, account, sessionKey)
    const now = BigInt(Math.floor(Date.now() / 1000))

    const isValid = config.isActive && now >= config.validAfter && now <= config.validUntil

    const timeRemaining = config.validUntil > now ? config.validUntil - now : 0n

    const remainingLimit =
      config.spendingLimit > config.spentAmount ? config.spendingLimit - config.spentAmount : 0n

    return {
      config,
      remainingLimit,
      isValid,
      timeRemaining,
    }
  }

  const hasPermission = async (
    publicClient: PublicClient,
    account: Address,
    sessionKey: Address,
    target: Address,
    selector: Hex
  ): Promise<boolean> => {
    const result = await publicClient.readContract({
      address: executorAddress,
      abi: SESSION_KEY_EXECUTOR_ABI,
      functionName: 'hasPermission',
      args: [account, sessionKey, target, selector],
    })
    return result as boolean
  }

  const getActiveSessionKeys = async (
    publicClient: PublicClient,
    account: Address
  ): Promise<Address[]> => {
    const result = await publicClient.readContract({
      address: executorAddress,
      abi: SESSION_KEY_EXECUTOR_ABI,
      functionName: 'getActiveSessionKeys',
      args: [account],
    })
    return result as Address[]
  }

  const getRemainingSpendingLimit = async (
    publicClient: PublicClient,
    account: Address,
    sessionKey: Address
  ): Promise<bigint> => {
    const result = await publicClient.readContract({
      address: executorAddress,
      abi: SESSION_KEY_EXECUTOR_ABI,
      functionName: 'getRemainingSpendingLimit',
      args: [account, sessionKey],
    })
    return result as bigint
  }

  // ============ Execution Functions ============

  const signExecution = async (
    sessionKey: LocalAccount,
    account: Address,
    request: ExecutionRequest,
    nonce: bigint
  ): Promise<Hex> => {
    // Compute the execution hash that needs to be signed
    const hash = computeExecutionHash(
      chainId,
      executorAddress,
      account,
      request.target,
      request.value,
      request.data,
      nonce
    )

    // Sign as Ethereum signed message
    return sessionKey.signMessage({
      message: { raw: hash },
    })
  }

  const encodeExecuteOnBehalf = (
    account: Address,
    request: ExecutionRequest,
    signature: Hex
  ): Hex => {
    return encodeFunctionData({
      abi: SESSION_KEY_EXECUTOR_ABI,
      functionName: 'executeOnBehalf',
      args: [account, request.target, request.value, request.data, signature],
    })
  }

  const encodeExecuteAsSessionKey = (account: Address, request: ExecutionRequest): Hex => {
    return encodeFunctionData({
      abi: SESSION_KEY_EXECUTOR_ABI,
      functionName: 'executeAsSessionKey',
      args: [account, request.target, request.value, request.data],
    })
  }

  return {
    executorAddress,
    chainId,
    encodeAddSessionKey,
    encodeRevokeSessionKey,
    encodeGrantPermission,
    encodeRevokePermission,
    getSessionKey,
    getSessionKeyState,
    hasPermission,
    getActiveSessionKeys,
    getRemainingSpendingLimit,
    signExecution,
    encodeExecuteOnBehalf,
    encodeExecuteAsSessionKey,
  }
}

/**
 * Compute the execution hash that needs to be signed
 * This matches the _getExecutionHash function in SessionKeyExecutor.sol
 */
function computeExecutionHash(
  chainId: bigint,
  executorAddress: Address,
  account: Address,
  target: Address,
  value: bigint,
  data: Hex,
  nonce: bigint
): Hex {
  return keccak256(
    encodePacked(
      ['uint256', 'address', 'address', 'address', 'uint256', 'bytes', 'uint256'],
      [chainId, executorAddress, account, target, value, data, nonce]
    )
  )
}

/**
 * Create a session key from a random private key
 */
export async function generateSessionKey(): Promise<LocalAccount> {
  const { generatePrivateKey, privateKeyToAccount } = await import('viem/accounts')
  const privateKey = generatePrivateKey()
  return privateKeyToAccount(privateKey)
}

/**
 * Create a session key from a private key
 */
export async function sessionKeyFromPrivateKey(privateKey: Hex): Promise<LocalAccount> {
  const { privateKeyToAccount } = await import('viem/accounts')
  return privateKeyToAccount(privateKey)
}
