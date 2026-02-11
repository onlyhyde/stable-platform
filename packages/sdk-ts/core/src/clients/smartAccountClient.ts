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
import { getUserOperationHash } from '../utils/userOperation'
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
    const { calls, paymaster = defaultPaymaster, maxFeePerGas, maxPriorityFeePerGas } = args

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
    let userOp: UserOperation = {
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

    // Get paymaster data if paymaster is provided
    if (paymaster) {
      const paymasterStubData = await paymaster.getPaymasterStubData(
        userOp,
        account.entryPoint,
        BigInt(chain.id)
      )
      userOp = {
        ...userOp,
        paymaster: paymasterStubData.paymaster,
        paymasterData: paymasterStubData.paymasterData,
        paymasterVerificationGasLimit: paymasterStubData.paymasterVerificationGasLimit,
        paymasterPostOpGasLimit: paymasterStubData.paymasterPostOpGasLimit,
      }
    }

    // Estimate gas
    const gasEstimation = await bundlerClient.estimateUserOperationGas(userOp)
    userOp = {
      ...userOp,
      callGasLimit: gasEstimation.callGasLimit,
      verificationGasLimit: gasEstimation.verificationGasLimit,
      preVerificationGas: gasEstimation.preVerificationGas,
      paymasterVerificationGasLimit:
        gasEstimation.paymasterVerificationGasLimit ?? userOp.paymasterVerificationGasLimit,
      paymasterPostOpGasLimit:
        gasEstimation.paymasterPostOpGasLimit ?? userOp.paymasterPostOpGasLimit,
    }

    // Get final paymaster data if paymaster is provided
    if (paymaster) {
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
    }

    // Calculate user operation hash and sign
    const userOpHash = getUserOperationHash(userOp, account.entryPoint, BigInt(chain.id))
    const signature = await account.signUserOperation(userOpHash)
    userOp = { ...userOp, signature }

    // Send to bundler
    return bundlerClient.sendUserOperation(userOp)
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
