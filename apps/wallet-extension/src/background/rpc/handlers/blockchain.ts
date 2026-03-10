import type { Address, Hex } from 'viem'
import {
  createRpcError,
  formatBlock,
  formatTransactionType,
  getPublicClient,
  RPC_ERRORS,
  type RpcHandler,
  walletState,
} from './shared'

export const blockchainHandlers: Record<string, RpcHandler> = {
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
}
