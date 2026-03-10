import type { Address, Hex } from 'viem'
import { createRpcError, getPublicClient, RPC_ERRORS, type RpcHandler, walletState } from './shared'

export const gasHandlers: Record<string, RpcHandler> = {
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
}
