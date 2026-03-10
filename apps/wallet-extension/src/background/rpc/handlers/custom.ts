import type { Address } from 'viem'
import { encodeFunctionData, isAddress } from 'viem/utils'
import {
  createRpcError,
  DEFAULT_VALUES,
  ENTRY_POINT_ABI,
  getEntryPointForChain,
  getPublicClient,
  keyringController,
  RPC_ERRORS,
  type RpcHandler,
  walletState,
} from './shared'

export const customHandlers: Record<string, RpcHandler> = {
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

    const info = result as {
      deposit: bigint
      staked: boolean
      stake: bigint
      unstakeDelaySec: number
      withdrawTime: number
    }
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
