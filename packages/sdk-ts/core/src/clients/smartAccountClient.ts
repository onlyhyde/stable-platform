import type {
  Call,
  PaymasterClient,
  SmartAccount,
  SmartAccountClientConfig,
  UserOperation,
  UserOperationReceipt,
} from '@stablenet/sdk-types'
import type { Address, Chain, Hex, Transport } from 'viem'
import { ConfigurationError } from '../errors'
import { createViemProvider, type RpcProvider } from '../providers'
import { getUserOperationHashVersioned } from '../utils/userOperation'
import { createBundlerClient } from './bundlerClient'

/**
 * Smart Account Client for sending UserOperations
 */
export interface SmartAccountClientActions {
  /** Send a user operation */
  sendUserOperation: (args: SendUserOperationArgs) => Promise<Hex>
  /** Send a transaction (convenience wrapper) */
  sendTransaction: (args: SendTransactionArgs) => Promise<Hex>
  /** Wait for a user operation receipt */
  waitForUserOperationReceipt: (hash: Hex) => Promise<UserOperationReceipt>
  /** Get the account address */
  getAddress: () => Address
  /** Get the account's current nonce */
  getNonce: () => Promise<bigint>
  /** Check if the account is deployed */
  isDeployed: () => Promise<boolean>
}

export interface SendUserOperationArgs {
  calls: Call | Call[]
  paymaster?: PaymasterClient
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
  /**
   * PostOp gas multiplier (default: 100 = no extra buffer).
   * Increase to add safety margin for paymaster postOp execution.
   * E.g., 120 = 20% extra postOp gas.
   */
  postOpGasMultiplier?: bigint
  /**
   * If true, falls back to self-pay (no paymaster) when paymaster fails.
   * Default: false — paymaster failure throws an error.
   */
  fallbackToSelfPay?: boolean
}

export interface SendTransactionArgs {
  to: Address
  value?: bigint
  data?: Hex
  paymaster?: PaymasterClient
}

/**
 * Create a smart account client
 */
export function createSmartAccountClient<
  TTransport extends Transport = Transport,
  TChain extends Chain = Chain,
  TAccount extends SmartAccount = SmartAccount,
>(
  config: SmartAccountClientConfig<TTransport, TChain, TAccount> & {
    /** Optional RPC Provider (DIP: allows dependency injection) */
    provider?: RpcProvider
  }
): SmartAccountClientActions & { account: TAccount; chain: TChain } {
  const {
    account,
    chain,
    transport,
    bundlerTransport,
    paymaster: defaultPaymaster,
    provider: injectedProvider,
  } = config

  // DIP: Use injected provider or create one from transport URL
  const rpcUrl = getRpcUrl(transport)
  const provider: RpcProvider =
    injectedProvider ??
    createViemProvider({
      rpcUrl,
      chainId: chain.id,
    })

  // Create bundler client
  const bundlerUrl = getBundlerUrl(bundlerTransport || transport)
  const bundlerClient = createBundlerClient({
    url: bundlerUrl,
    entryPoint: account.entryPoint,
    chainId: BigInt(chain.id),
  })

  const getAddress = (): Address => {
    return account.address
  }

  const getNonce = async (): Promise<bigint> => {
    return account.getNonce()
  }

  const isDeployed = async (): Promise<boolean> => {
    return account.isDeployed()
  }

  const sendUserOperation = async (args: SendUserOperationArgs): Promise<Hex> => {
    const {
      calls,
      paymaster = defaultPaymaster,
      maxFeePerGas,
      maxPriorityFeePerGas,
      postOpGasMultiplier,
      fallbackToSelfPay = false,
    } = args

    // Encode call data
    const callData = await account.encodeCallData(calls)

    // Get nonce
    const nonce = await account.getNonce()

    // Get init code if account not deployed
    const deployed = await account.isDeployed()
    const factory = deployed ? undefined : await account.getFactory()
    const factoryData = deployed ? undefined : await account.getFactoryData()

    // Get gas prices if not provided
    let gasPrices: { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }
    if (maxFeePerGas && maxPriorityFeePerGas) {
      gasPrices = { maxFeePerGas, maxPriorityFeePerGas }
    } else {
      const feeData = await provider.getGasPrices()
      gasPrices = {
        maxFeePerGas: maxFeePerGas ?? feeData.maxFeePerGas,
        maxPriorityFeePerGas: maxPriorityFeePerGas ?? feeData.maxPriorityFeePerGas,
      }
    }

    // Build partial user operation
    const baseUserOp: UserOperation = {
      sender: account.address,
      nonce,
      factory,
      factoryData,
      callData,
      callGasLimit: 0n,
      verificationGasLimit: 0n,
      preVerificationGas: 0n,
      maxFeePerGas: gasPrices.maxFeePerGas,
      maxPriorityFeePerGas: gasPrices.maxPriorityFeePerGas,
      signature: '0x',
    }

    // Try with paymaster first, fallback to self-pay if configured
    if (paymaster) {
      try {
        return await buildAndSendWithPaymaster(baseUserOp, paymaster, postOpGasMultiplier)
      } catch (err) {
        if (!fallbackToSelfPay) throw err
        // Paymaster failed — fall back to self-pay (no paymaster)
      }
    }

    // Self-pay path (no paymaster)
    return await buildAndSend(baseUserOp)
  }

  /**
   * Build and send UserOp with paymaster.
   * Applies postOp gas multiplier for safety margin.
   */
  const buildAndSendWithPaymaster = async (
    baseOp: UserOperation,
    paymaster: PaymasterClient,
    postOpGasMultiplier?: bigint
  ): Promise<Hex> => {
    // Phase 1: Get paymaster stub data for gas estimation
    const paymasterStubData = await paymaster.getPaymasterStubData(
      baseOp,
      account.entryPoint,
      BigInt(chain.id)
    )
    let userOp: UserOperation = {
      ...baseOp,
      paymaster: paymasterStubData.paymaster,
      paymasterData: paymasterStubData.paymasterData,
      paymasterVerificationGasLimit: paymasterStubData.paymasterVerificationGasLimit,
      paymasterPostOpGasLimit: paymasterStubData.paymasterPostOpGasLimit,
    }

    // Phase 2: Estimate gas
    const gasEstimation = await bundlerClient.estimateUserOperationGas(userOp)
    let postOpGas = gasEstimation.paymasterPostOpGasLimit ?? userOp.paymasterPostOpGasLimit

    // Apply postOp gas multiplier if configured
    if (postOpGas && postOpGasMultiplier && postOpGasMultiplier > 100n) {
      postOpGas = (postOpGas * postOpGasMultiplier) / 100n
    }

    userOp = {
      ...userOp,
      callGasLimit: gasEstimation.callGasLimit,
      verificationGasLimit: gasEstimation.verificationGasLimit,
      preVerificationGas: gasEstimation.preVerificationGas,
      paymasterVerificationGasLimit:
        gasEstimation.paymasterVerificationGasLimit ?? userOp.paymasterVerificationGasLimit,
      paymasterPostOpGasLimit: postOpGas,
    }

    // Phase 3: Get final paymaster data
    const paymasterData = await paymaster.getPaymasterData(
      userOp,
      account.entryPoint,
      BigInt(chain.id)
    )
    userOp = {
      ...userOp,
      paymaster: paymasterData.paymaster,
      paymasterData: paymasterData.paymasterData,
    }

    // Sign and send
    return await signAndSend(userOp)
  }

  /**
   * Build and send UserOp without paymaster (self-pay).
   */
  const buildAndSend = async (baseOp: UserOperation): Promise<Hex> => {
    const gasEstimation = await bundlerClient.estimateUserOperationGas(baseOp)
    const userOp: UserOperation = {
      ...baseOp,
      callGasLimit: gasEstimation.callGasLimit,
      verificationGasLimit: gasEstimation.verificationGasLimit,
      preVerificationGas: gasEstimation.preVerificationGas,
    }
    return await signAndSend(userOp)
  }

  /**
   * Sign UserOp and send to bundler.
   */
  const signAndSend = async (userOp: UserOperation): Promise<Hex> => {
    const userOpHash = getUserOperationHashVersioned(userOp, account.entryPoint, BigInt(chain.id))
    const signature = await account.signUserOperation(userOpHash)
    return bundlerClient.sendUserOperation({ ...userOp, signature })
  }

  const sendTransaction = async (args: SendTransactionArgs): Promise<Hex> => {
    return sendUserOperation({
      calls: {
        to: args.to,
        value: args.value,
        data: args.data,
      },
      paymaster: args.paymaster,
    })
  }

  const waitForUserOperationReceipt = async (hash: Hex): Promise<UserOperationReceipt> => {
    return bundlerClient.waitForUserOperationReceipt(hash)
  }

  return {
    account,
    chain,
    getAddress,
    getNonce,
    isDeployed,
    sendUserOperation,
    sendTransaction,
    waitForUserOperationReceipt,
  }
}

/**
 * Extract URL from transport
 */
function getUrlFromTransport(transport: Transport): string {
  // For http transport, extract the URL
  // This is a simplified implementation
  const transportConfig = transport({ chain: undefined, retryCount: 0 } as Parameters<Transport>[0])
  if ('url' in transportConfig && typeof transportConfig.url === 'string') {
    return transportConfig.url
  }
  throw new ConfigurationError('Could not extract URL from transport', 'transport', {
    operation: 'getUrlFromTransport',
  })
}

/**
 * Extract bundler URL from transport
 */
function getBundlerUrl(transport: Transport): string {
  return getUrlFromTransport(transport)
}

/**
 * Extract RPC URL from transport
 */
function getRpcUrl(transport: Transport): string {
  return getUrlFromTransport(transport)
}
