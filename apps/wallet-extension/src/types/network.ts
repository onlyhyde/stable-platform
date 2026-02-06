/**
 * Network types
 */

export interface Network {
  chainId: number
  name: string
  rpcUrl: string
  bundlerUrl?: string
  paymasterUrl?: string
  explorerUrl?: string
  /** Indexer GraphQL/RPC endpoint URL for token balances and transaction history */
  indexerUrl?: string
  currency: {
    name: string
    symbol: string
    decimals: number
  }
  isTestnet?: boolean
  isCustom?: boolean
}

export interface NetworkState {
  networks: Network[]
  selectedChainId: number
}
